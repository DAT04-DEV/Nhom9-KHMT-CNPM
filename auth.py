from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable

import jwt
from flask import Response, g, jsonify, request
from psycopg import errors
from werkzeug.security import check_password_hash, generate_password_hash

from config import config
from db import execute, fetch_one


ALLOWED_ROLES = {"admin", "user"}
PUBLIC_REGISTRATION_ROLES = {"user"}


def json_error(message: str, status: int) -> tuple[Response, int]:
    return jsonify({"ok": False, "error": message}), status


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_token(account: dict[str, Any]) -> str:
    now = _utc_now()
    payload = {
        "iss": config.jwt_issuer,
        "sub": str(account["id"]),
        "email": account["email"],
        "role": account["role"],
        "merchant_id": account.get("merchant_id"),
        "token_version": account["token_version"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=config.jwt_expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, config.jwt_secret, algorithm="HS256")


def set_auth_cookie(response: Response, token: str) -> Response:
    response.set_cookie(
        config.cookie_name,
        token,
        httponly=True,
        secure=config.cookie_secure,
        samesite="Lax",
        max_age=config.jwt_expires_minutes * 60,
        path="/",
    )
    return response


def clear_auth_cookie(response: Response) -> Response:
    response.delete_cookie(config.cookie_name, path="/")
    return response


def _extract_token() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.cookies.get(config.cookie_name)


def get_current_account() -> dict[str, Any] | None:
    token = _extract_token()
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            config.jwt_secret,
            algorithms=["HS256"],
            issuer=config.jwt_issuer,
        )
        account = fetch_one(
            """
            select id, email, full_name, role, merchant_id, is_active, token_version,
                   created_at, last_login_at
            from accounts
            where id = %s
            """,
            (payload.get("sub"),),
        )
        if not account or not account["is_active"]:
            return None
        if account["token_version"] != payload.get("token_version"):
            return None
        return account
    except Exception:
        return None


def login_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        account = get_current_account()
        if not account:
            return json_error("Authentication required.", 401)
        g.account = account
        return fn(*args, **kwargs)

    return wrapper


def page_login_required(fn: Callable) -> Callable:
    """Decorator cho page routes: redirect về / nếu chưa đăng nhập (login qua modal)."""
    from flask import redirect, request

    @wraps(fn)
    def wrapper(*args, **kwargs):
        account = get_current_account()
        if not account:
            return redirect("/")
        g.account = account
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles: str) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            if g.account["role"] not in roles:
                return json_error("You do not have permission to access this resource.", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def account_to_public(account: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(account["id"]),
        "email": account["email"],
        "full_name": account["full_name"],
        "role": account["role"],
        "merchant_id": account.get("merchant_id"),
        "created_at": account.get("created_at").isoformat() if account.get("created_at") else None,
        "last_login_at": account.get("last_login_at").isoformat()
        if account.get("last_login_at")
        else None,
    }


def register_account(payload: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None, int]:
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    full_name = (payload.get("full_name") or "").strip()
    role = (payload.get("role") or "user").strip().lower()
    invite_code = payload.get("invite_code") or ""

    if not email or "@" not in email:
        return None, "Valid email is required.", 400
    if len(password) < 8:
        return None, "Password must be at least 8 characters.", 400
    if not full_name:
        return None, "Full name is required.", 400
    if role not in ALLOWED_ROLES:
        return None, "Invalid role.", 400
    if role == "admin":
        if not config.admin_invite_code or invite_code != config.admin_invite_code:
            return None, "Admin registration requires a valid invite code.", 403
    elif role not in PUBLIC_REGISTRATION_ROLES:
        return None, "Invalid public registration role.", 400

    try:
        account = execute(
            """
            insert into accounts (email, password_hash, full_name, role)
            values (%s, %s, %s, %s)
            returning id, email, full_name, role, merchant_id, is_active,
                      token_version, created_at, last_login_at
            """,
            (
                email,
                generate_password_hash(password),
                full_name,
                role,
            ),
        )
    except errors.UniqueViolation:
        return None, "Email is already registered.", 409

    return account, None, 201


def authenticate(email: str, password: str) -> dict[str, Any] | None:
    account = fetch_one(
        """
        select id, email, password_hash, full_name, role, merchant_id,
               is_active, token_version, created_at, last_login_at
        from accounts
        where email = %s
        """,
        (email.strip().lower(),),
    )
    if not account or not account["is_active"]:
        return None
    if not check_password_hash(account["password_hash"], password):
        return None

    updated = execute(
        """
        update accounts
        set last_login_at = now()
        where id = %s
        returning id, email, full_name, role, merchant_id, is_active,
                  token_version, created_at, last_login_at
        """,
        (account["id"],),
    )
    return updated


def invalidate_tokens(account_id: str) -> None:
    execute(
        "update accounts set token_version = token_version + 1 where id = %s",
        (account_id,),
    )


def scoped_transactions_query(account: dict[str, Any]) -> tuple[str, tuple[Any, ...]]:
    base_sql = """
        select *
        from transactions
    """
    # Admin xem toàn bộ; user thông thường cũng xem toàn bộ (không còn phân scope theo merchant)
    return base_sql + " order by transaction_time desc limit 100", ()
