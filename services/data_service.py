from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from .preprocess_service import DataPreprocessor, CustomerSegmenter


@dataclass(frozen=True)
class FilterParams:
    location: str | None = None
    payment_method: str | None = None
    merchant_category: str | None = None


class CashlessDataService:
    def __init__(self, csv_path: Path) -> None:
        self.csv_path = csv_path
        self._df: pd.DataFrame | None = None
        self._preprocessor = DataPreprocessor()
        self._segmenter = CustomerSegmenter(n_clusters=4)

    def _load_if_needed(self) -> pd.DataFrame:
        # Cache DataFrame trong memory để các API gọi lặp lại không phải đọc CSV nhiều lần.
        if self._df is None:
            df = pd.read_csv(self.csv_path)
            df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce")
            df["Amount_VND"] = pd.to_numeric(df["Amount_VND"], errors="coerce").fillna(0)
            df["Is_Fraud"] = pd.to_numeric(df["Is_Fraud"], errors="coerce").fillna(0).astype(int)
            df = df.dropna(subset=["Timestamp"])
            self._df = df
        return self._df

    def change_csv(self, csv_path: Path) -> None:
        """Đổi file CSV và xóa cache dữ liệu cũ."""
        self.csv_path = csv_path
        self._df = None # Xóa cache để lần gọi sau sẽ load file mới

    def list_filter_values(self) -> dict[str, list[str]]:
        df = self._load_if_needed()
        locations = sorted(df["Location"].dropna().astype(str).unique().tolist())
        methods = sorted(df["Payment_Method"].dropna().astype(str).unique().tolist())
        categories = sorted(df["Merchant_Category"].dropna().astype(str).unique().tolist())
        return {
            "locations": locations, 
            "payment_methods": methods,
            "merchant_categories": categories
        }

    def _apply_filters(self, params: FilterParams) -> pd.DataFrame:
        df = self._load_if_needed()
        result = df
        if params.location:
            result = result[result["Location"] == params.location]
        if params.payment_method:
            result = result[result["Payment_Method"] == params.payment_method]
        if params.merchant_category:
            result = result[result["Merchant_Category"] == params.merchant_category]
        return result

    def get_summary(self, params: FilterParams) -> dict[str, Any]:
        df = self._apply_filters(params)
        if df.empty:
            return {
                "total_gmv": 0,
                "total_transactions": 0,
                "fraud_rate": 0.0,
                "top_city": None,
                "top_category": None,
                "peak_hour": None,
                "active_users_daily_avg": 0,
                "active_users_monthly_avg": 0,
            }

        grouped_city = df.groupby("Location", as_index=False)["Amount_VND"].sum()
        top_city_row = grouped_city.sort_values("Amount_VND", ascending=False).iloc[0]
        grouped_category = df.groupby("Merchant_Category", as_index=False)["Amount_VND"].sum()
        top_category_row = grouped_category.sort_values("Amount_VND", ascending=False).iloc[0]

        working_df = df.copy()
        working_df["date"] = working_df["Timestamp"].dt.date
        working_df["month"] = working_df["Timestamp"].dt.to_period("M")
        daily_active_avg = (
            working_df.groupby("date")["User_ID"].nunique().mean() if not working_df.empty else 0
        )
        monthly_active_avg = (
            working_df.groupby("month")["User_ID"].nunique().mean() if not working_df.empty else 0
        )
        peak_hour = int(working_df["Timestamp"].dt.hour.value_counts().idxmax())

        return {
            "total_gmv": int(df["Amount_VND"].sum()),
            "total_transactions": int(len(df)),
            "fraud_rate": float((df["Is_Fraud"].sum() / len(df)) * 100),
            "top_city": str(top_city_row["Location"]),
            "top_category": str(top_category_row["Merchant_Category"]),
            "peak_hour": peak_hour,
            "active_users_daily_avg": float(daily_active_avg),
            "active_users_monthly_avg": float(monthly_active_avg),
        }

    def get_distributions(self, params: FilterParams) -> dict[str, list[dict[str, Any]]]:
        df = self._apply_filters(params)
        if df.empty:
            return {
                "payment_method_share": [],
                "merchant_category_spend": [],
                "location_sales": [],
            }

        payment = (
            df.groupby("Payment_Method", as_index=False)["Amount_VND"]
            .sum()
            .sort_values("Amount_VND", ascending=False)
        )
        category = (
            df.groupby("Merchant_Category", as_index=False)["Amount_VND"]
            .sum()
            .sort_values("Amount_VND", ascending=False)
        )
        location = (
            df.groupby("Location", as_index=False)["Amount_VND"]
            .sum()
            .sort_values("Amount_VND", ascending=False)
        )

        return {
            "payment_method_share": payment.rename(
                columns={"Payment_Method": "label", "Amount_VND": "value"}
            ).to_dict(orient="records"),
            "merchant_category_spend": category.rename(
                columns={"Merchant_Category": "label", "Amount_VND": "value"}
            ).to_dict(orient="records"),
            "location_sales": location.rename(
                columns={"Location": "label", "Amount_VND": "value"}
            ).to_dict(orient="records"),
        }

    def get_trend(self, params: FilterParams, time_granularity: str = "month") -> list[dict[str, Any]]:
        df = self._apply_filters(params)
        if df.empty:
            return []

        granularity = (time_granularity or "month").lower()
        if granularity not in {"month", "quarter"}:
            granularity = "month"
        period = "M" if granularity != "quarter" else "Q"
        grouped = df.groupby(df["Timestamp"].dt.to_period(period))["Amount_VND"].sum().reset_index()
        grouped["period"] = grouped["Timestamp"].astype(str)
        return grouped.rename(columns={"Amount_VND": "value"})[["period", "value"]].to_dict(
            orient="records"
        )

    def get_hourly_distribution(self, params: FilterParams) -> list[dict[str, Any]]:
        df = self._apply_filters(params)
        if df.empty:
            return []
        hours = (
            df.assign(hour=df["Timestamp"].dt.hour)
            .groupby("hour", as_index=False)["Amount_VND"]
            .sum()
            .sort_values("hour")
        )
        return hours.rename(columns={"hour": "label", "Amount_VND": "value"}).to_dict(orient="records")

    def get_user_analytics(self, params: FilterParams) -> dict[str, Any]:
        df = self._apply_filters(params)
        if df.empty:
            return {"segments": [], "top_users": [], "by_hour": [], "by_day": []}

        user_spend = df.groupby("User_ID", as_index=False)["Amount_VND"].sum()
        p33 = user_spend["Amount_VND"].quantile(0.33)
        p66 = user_spend["Amount_VND"].quantile(0.66)

        def classify(value: float) -> str:
            if value <= p33:
                return "Người tiết kiệm"
            if value <= p66:
                return "Người chi tiêu cân bằng"
            return "Người chi tiêu mạnh"

        user_spend["segment"] = user_spend["Amount_VND"].apply(classify)
        segments = (
            user_spend.groupby("segment", as_index=False)
            .agg(user_count=("User_ID", "count"), total_spend=("Amount_VND", "sum"))
            .sort_values("user_count", ascending=False)
        )

        # Trả về 10 người dùng chi tiêu cao nhất thay vì chỉ 1
        top_users_df = user_spend.sort_values("Amount_VND", ascending=False).head(10)
        top_users = []
        for _, u_row in top_users_df.iterrows():
            u_id = str(u_row["User_ID"])
            u_df = df[df["User_ID"] == u_id]
            top_users.append({
                "user_id": u_id,
                "total_spend": int(u_row["Amount_VND"]),
                "transaction_count": int(len(u_df)),
                "preferred_payment_method": str(u_df["Payment_Method"].mode().iloc[0] if not u_df.empty else "N/A"),
                "segment": u_row["segment"]
            })

        by_hour = (
            df.assign(hour=df["Timestamp"].dt.hour)
            .groupby("hour", as_index=False)["Transaction_ID"]
            .count()
            .rename(columns={"hour": "label", "Transaction_ID": "value"})
            .to_dict(orient="records")
        )
        by_day = (
            df.assign(day=df["Timestamp"].dt.day_name())
            .groupby("day", as_index=False)["Transaction_ID"]
            .count()
            .rename(columns={"day": "label", "Transaction_ID": "value"})
            .to_dict(orient="records")
        )

        return {
            "segments": segments.to_dict(orient="records"),
            "top_users": top_users,
            "by_hour": by_hour,
            "by_day": by_day,
        }

    def get_transactions(
        self,
        params: FilterParams,
        search: str = "",
        sort_by: str = "Timestamp",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        df = self._apply_filters(params).copy()
        if search:
            keyword = search.lower()
            df = df[
                df["Transaction_ID"].astype(str).str.lower().str.contains(keyword)
                | df["User_ID"].astype(str).str.lower().str.contains(keyword)
                | df["Merchant_Category"].astype(str).str.lower().str.contains(keyword)
            ]

        valid_sort = {"Timestamp", "Amount_VND", "User_ID", "Payment_Method", "Merchant_Category", "Location"}
        if sort_by not in valid_sort:
            sort_by = "Timestamp"
        ascending = sort_order.lower() == "asc"
        df = df.sort_values(sort_by, ascending=ascending)

        total = int(len(df))
        start = max((page - 1) * page_size, 0)
        end = start + page_size
        page_df = df.iloc[start:end]

        rows = []
        for _, row in page_df.iterrows():
            rows.append(
                {
                    "transaction_id": str(row["Transaction_ID"]),
                    "user_id": str(row["User_ID"]),
                    "amount_vnd": int(row["Amount_VND"]),
                    "timestamp": row["Timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                    "payment_method": str(row["Payment_Method"]),
                    "merchant_category": str(row["Merchant_Category"]),
                    "location": str(row["Location"]),
                    "risk_score": int(row.get("Risk_Score", 0)),
                    "is_fraud": int(row.get("Is_Fraud", 0)),
                }
            )

        return {"total": total, "page": page, "page_size": page_size, "rows": rows}

    def get_ai_insights(self, params: FilterParams) -> list[str]:
        df = self._apply_filters(params)
        if df.empty:
            return ["Không có dữ liệu cho bộ lọc hiện tại."]

        insights: list[str] = []
        weekend = df[df["Timestamp"].dt.dayofweek >= 5]["Amount_VND"].sum()
        weekday = df[df["Timestamp"].dt.dayofweek < 5]["Amount_VND"].sum()
        if weekend > weekday * 0.5:
            insights.append("Người dùng có xu hướng chi tiêu mạnh vào cuối tuần.")

        method_share = (
            df.groupby("Payment_Method")["Amount_VND"].sum().sort_values(ascending=False)
        )
        if not method_share.empty:
            insights.append(f"Phương thức dẫn đầu hiện tại là {method_share.index[0]}.")

        peak_hour = int(df["Timestamp"].dt.hour.value_counts().idxmax())
        insights.append(f"Khung giờ hoạt động cao nhất là {peak_hour}:00 - {peak_hour + 1}:00.")

        return insights

    def get_sankey_data(self, params: FilterParams) -> list[dict[str, Any]]:
        df = self._apply_filters(params)
        if df.empty:
            return []
        
        # We group by Payment_Method -> Merchant_Category
        grouped = df.groupby(["Payment_Method", "Merchant_Category"], as_index=False)["Amount_VND"].sum()
        # Filter out very small flows (0.5%) to avoid clutter
        threshold = grouped["Amount_VND"].sum() * 0.005
        grouped = grouped[grouped["Amount_VND"] >= threshold]
        
        return grouped.rename(
            columns={"Payment_Method": "from", "Merchant_Category": "to", "Amount_VND": "value"}
        ).to_dict(orient="records")

    def get_funnel_data(self, params: FilterParams) -> list[dict[str, Any]]:
        """
        Xây dựng phễu giao dịch: 
        Người dùng có GD -> Người dùng có > 2 GD -> Người dùng có > 5 GD.
        """
        df = self._apply_filters(params)
        if df.empty:
            return []
        
        user_counts = df.groupby("User_ID")["Transaction_ID"].count()
        
        total_users = int(user_counts.count())
        users_2plus = int((user_counts >= 2).sum())
        users_5plus = int((user_counts >= 5).sum())
        
        return [
            {"label": "Tất cả người dùng", "value": total_users},
            {"label": "Người dùng > 2 GD", "value": users_2plus},
            {"label": "Người dùng > 5 GD (Trung thành)", "value": users_5plus},
        ]

    def get_ml_customer_segments(self) -> dict[str, Any]:
        """
        Sử dụng K-Means Clustering để phân khúc khách hàng chuyên sâu.
        """
        df = self._load_if_needed()
        if df.empty:
            return {"segments": [], "summary": {}}
            
        # Thực hiện phân cụm
        segments_df = self._segmenter.cluster_customers(df)
        
        # Thống kê theo phân khúc
        stats = segments_df.groupby('Segment_Name').agg({
            'User_ID': 'count',
            'Recency': 'mean',
            'Frequency': 'mean',
            'Monetary': 'mean'
        }).reset_index()
        
        # Chuyển đổi sang dạng danh sách dict để trả về client
        return {
            "segments": segments_df.to_dict(orient="records"),
            "summary": stats.to_dict(orient="records")
        }
