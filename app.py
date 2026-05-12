from datetime import date, datetime
from decimal import Decimal
import os
from uuid import UUID

from flask import Flask, g, jsonify, redirect, render_template, request, url_for
from psycopg import errors

from auth import (
    account_to_public,
    authenticate,
    clear_auth_cookie,
    create_token,
    invalidate_tokens,
    json_error,
    login_required,
    register_account,
    role_required,
    scoped_transactions_query,
    set_auth_cookie,
)
from db import DatabaseNotConfigured, fetch_all


def json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    return value


def row_to_json(row: dict):
    return {key: json_safe(value) for key, value in row.items()}


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def home():
        return redirect(url_for("dashboard_page"))

    @app.get("/login")
    def login_page():
        return render_template("login.html")

    @app.get("/register")
    def register_page():
        return render_template("register.html")

    @app.get("/dashboard")
    def dashboard_page():
        return render_template("dashboard.html")

    @app.get("/profile")
    def profile_page():
        return render_template("profile.html")

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "service": "fraud-auth"})

    @app.post("/api/auth/register")
    def register():
        account, error, status = register_account(request.get_json(silent=True) or {})
        if error:
            return json_error(error, status)

        token = create_token(account)
        response = jsonify({"ok": True, "account": account_to_public(account)})
        return set_auth_cookie(response, token), status

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        account = authenticate(payload.get("email", ""), payload.get("password", ""))
        if not account:
            return json_error("Invalid email or password.", 401)

        token = create_token(account)
        response = jsonify({"ok": True, "account": account_to_public(account)})
        return set_auth_cookie(response, token)

    @app.post("/api/auth/logout")
    @login_required
    def logout():
        invalidate_tokens(str(g.account["id"]))
        response = jsonify({"ok": True})
        return clear_auth_cookie(response)

    @app.get("/api/me")
    @login_required
    def me():
        return jsonify({"ok": True, "account": account_to_public(g.account)})

    @app.get("/api/admin/accounts")
    @role_required("admin")
    def list_accounts():
        accounts = fetch_all(
            """
            select id, email, full_name, role, merchant_id, is_active,
                   created_at, last_login_at
            from accounts
            order by created_at desc
            limit 200
            """
        )
        return jsonify({"ok": True, "accounts": [account_to_public(row) for row in accounts]})

    @app.get("/api/transactions")
    @login_required
    def list_transactions():
        sql, params = scoped_transactions_query(g.account)
        try:
            rows = fetch_all(sql, params)
        except errors.UndefinedTable:
            return json_error(
                "Transaction table is not created yet. Import the CSV data before using this API.",
                503,
            )
        except errors.UndefinedColumn:
            return json_error(
                "Transaction table does not match the expected columns: merchant_id, transaction_time, amount.",
                503,
            )
        return jsonify({"ok": True, "transactions": [row_to_json(row) for row in rows]})

    @app.errorhandler(DatabaseNotConfigured)
    def db_not_configured(error):
        return json_error(str(error), 500)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=True)
