from datetime import date, datetime
from decimal import Decimal
import os
from pathlib import Path
from uuid import UUID

from flask import Flask, g, jsonify, redirect, render_template, request, url_for
from psycopg import errors

from auth import (
    account_to_public,
    authenticate,
    clear_auth_cookie,
    create_token,
    get_current_account,
    invalidate_tokens,
    json_error,
    login_required,
    page_login_required,
    register_account,
    role_required,
    scoped_transactions_query,
    set_auth_cookie,
)
from db import DatabaseNotConfigured, fetch_all
from services.data_service import CashlessDataService, FilterParams


# ── Data service (CSV-based dashboard) ──────────────────────────────────────
CSV_PATH = Path(__file__).resolve().parent / "vn_cashless_2026.csv"
data_service = CashlessDataService(CSV_PATH)


def _build_filters() -> FilterParams:
    return FilterParams(
        location=request.args.get("location") or None,
        payment_method=request.args.get("payment_method") or None,
        merchant_category=request.args.get("merchant_category") or None,
    )


# ── JSON helpers ─────────────────────────────────────────────────────────────
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

    # ── Page routes ──────────────────────────────────────────────────────────

    @app.get("/")
    def home():
        """Trang chủ: luôn hiển thị, trạng thái đăng nhập do JS xử lý."""
        return render_template("index.html")

    @app.get("/login")
    def login_page():
        """Trang login đã được tích hợp vào modal — redirect về trang chủ."""
        return redirect(url_for("home"), 301)

    @app.get("/register")
    def register_page():
        """Trang register đã được tích hợp vào modal — redirect về trang chủ."""
        return redirect(url_for("home"), 301)

    @app.get("/profile")
    def profile_page():
        return render_template("profile.html")

    @app.get("/dashboard")
    def dashboard_page():
        return render_template("dashboard.html")

    @app.get("/users")
    def users_page():
        return render_template("users.html")

    @app.get("/transactions")
    def transactions_page():
        return render_template("transactions.html")

    @app.get("/predictions")
    @page_login_required
    def predictions_page():
        return render_template("predictions.html")

    @app.get("/insights")
    @page_login_required
    def insights_page():
        return render_template("insights.html")

    @app.get("/about")
    def about_page():
        return render_template("about.html")

    @app.get("/charts/payment-method")
    def payment_method_page():
        return render_template("payment_method.html")

    @app.get("/charts/category-spend")
    def category_spend_page():
        return render_template("category_spend.html")

    @app.get("/charts/trend")
    def trend_page():
        return render_template("trend.html")

    @app.get("/charts/location-sales")
    def location_sales_page():
        return render_template("location_sales.html")

    # ── Auth API ─────────────────────────────────────────────────────────────

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "service": "fraud-detection"})

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

    @app.get("/api/db-transactions")
    @login_required
    def list_db_transactions():
        """Giao dịch lấy từ database (scoped theo role)."""
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
                "Transaction table does not match the expected columns.",
                503,
            )
        return jsonify({"ok": True, "transactions": [row_to_json(row) for row in rows]})

    # ── CSV Dashboard API ─────────────────────────────────────────────────────

    @app.get("/api/filters")
    def filters():
        return jsonify(data_service.list_filter_values())

    @app.get("/api/summary")
    def summary():
        return jsonify(data_service.get_summary(_build_filters()))

    @app.get("/api/distributions")
    def distributions():
        return jsonify(data_service.get_distributions(_build_filters()))

    @app.get("/api/trend")
    def trend():
        time_granularity = request.args.get("time_granularity", "month")
        return jsonify(data_service.get_trend(_build_filters(), time_granularity))

    @app.get("/api/hourly-distribution")
    def hourly_distribution():
        return jsonify(data_service.get_hourly_distribution(_build_filters()))

    @app.get("/api/user-analytics")
    def user_analytics():
        return jsonify(data_service.get_user_analytics(_build_filters()))

    @app.get("/api/transactions")
    def transactions_api():
        search = request.args.get("search", "")
        sort_by = request.args.get("sort_by", "Timestamp")
        sort_order = request.args.get("sort_order", "desc")
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 20))
        return jsonify(
            data_service.get_transactions(
                _build_filters(),
                search=search,
                sort_by=sort_by,
                sort_order=sort_order,
                page=page,
                page_size=page_size,
            )
        )

    @app.get("/api/ai-insights")
    def ai_insights_api():
        return jsonify({"insights": data_service.get_ai_insights(_build_filters())})

    @app.get("/api/segmentation")
    def segmentation_api():
        return jsonify(data_service.get_ml_customer_segments())

    @app.get("/api/sankey")
    def sankey_api():
        return jsonify(data_service.get_sankey_data(_build_filters()))

    @app.get("/api/funnel")
    def funnel_api():
        return jsonify(data_service.get_funnel_data(_build_filters()))

    @app.get("/api/settings/current-dataset")
    def current_dataset():
        return jsonify({"filename": data_service.csv_path.name})

    @app.post("/api/settings/change-dataset")
    def change_dataset():
        target = request.json.get("target")
        base_path = Path(__file__).resolve().parent
        if target == "enhanced":
            new_path = base_path / "vn_cashless_enhanced_2026.csv"
        else:
            new_path = base_path / "vn_cashless_2026.csv"
        if new_path.exists():
            data_service.change_csv(new_path)
            return jsonify({"success": True, "filename": new_path.name})
        return jsonify({"success": False, "error": "File not found"}), 404

    @app.post("/api/settings/upload-csv")
    def upload_csv():
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file part"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"success": False, "error": "No selected file"}), 400
        if file and file.filename.endswith(".csv"):
            upload_path = Path(__file__).resolve().parent / "uploaded_data.csv"
            file.save(str(upload_path))
            data_service.change_csv(upload_path)
            return jsonify({"success": True, "filename": file.filename})
        return jsonify({"success": False, "error": "Invalid file format"}), 400

    # ── Error handlers ────────────────────────────────────────────────────────

    @app.errorhandler(DatabaseNotConfigured)
    def db_not_configured(error):
        return json_error(str(error), 500)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=True)
