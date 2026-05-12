from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row

from config import config


class DatabaseNotConfigured(RuntimeError):
    pass


def _require_db_url() -> str:
    if not config.supabase_db_url:
        raise DatabaseNotConfigured("SUPABASE_DB_URL is not configured.")
    return config.supabase_db_url


@contextmanager
def get_conn():
    conn = psycopg.connect(_require_db_url(), row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_one(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def fetch_all(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())


def execute(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description:
                return cur.fetchone()
            return None
