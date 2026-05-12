import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    supabase_db_url: str = os.getenv("SUPABASE_DB_URL", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    jwt_issuer: str = os.getenv("JWT_ISSUER", "fraud-detection-app")
    jwt_expires_minutes: int = int(os.getenv("JWT_EXPIRES_MINUTES", "120"))
    admin_invite_code: str = os.getenv("ADMIN_INVITE_CODE", "")
    cookie_secure: bool = _as_bool(os.getenv("COOKIE_SECURE"), False)
    cookie_name: str = "auth_token"


config = Config()
