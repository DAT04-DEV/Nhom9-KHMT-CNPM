# Fraud Detection Auth Module

Phần này triển khai nhiệm vụ 3: đăng nhập, đăng xuất, đăng ký, phân quyền và bảo mật cho hệ thống Flask + HTML/CSS/JS + Supabase Postgres.

## Chạy lần đầu

1. Tạo virtual environment và cài thư viện:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Sao chép `.env.example` thành `.env`, rồi điền `SUPABASE_DB_URL`, `JWT_SECRET`, `ADMIN_INVITE_CODE`.

3. Chạy nội dung `schema.sql` trong Supabase SQL Editor.

4. Khởi động Flask:

```powershell
python app.py
```

Ứng dụng chạy tại `http://127.0.0.1:5000`.

## Phân quyền

- `admin`: xem toàn bộ tài khoản và toàn bộ giao dịch.
- `merchant`: chỉ xem giao dịch có `merchant_id` trùng với tài khoản.
- `user`: chỉ xem giao dịch có `merchant_id` trùng với tài khoản.

Tài khoản được lưu trong bảng `accounts`, tách biệt với dữ liệu khách hàng/giao dịch import từ CSV. Mật khẩu được hash bằng Werkzeug, phiên đăng nhập dùng JWT trong HttpOnly cookie. Khi logout, `token_version` tăng để vô hiệu hóa token cũ.

## API chính

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/admin/accounts`
- `GET /api/transactions`

`GET /api/transactions` giả định bảng giao dịch tên `transactions` có các cột tối thiểu: `merchant_id`, `transaction_time`, `amount`. Nếu nhóm chọn tên bảng/cột khác ở nhiệm vụ database, cập nhật hàm `scoped_transactions_query` trong `auth.py`.
