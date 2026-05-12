# Tài liệu Hệ thống Bảo mật & Xác thực - Nhóm 9

Tài liệu này tóm tắt các cơ chế bảo mật đã được triển khai trong dự án **Fraud Detection VN**.

## 1. Xác thực người dùng (Authentication)

### 1.1. Mã hóa mật khẩu
- **Cơ chế**: Sử dụng thuật toán Hashing mạnh mẽ từ thư viện `werkzeug.security`.
- **Triển khai**:
  - Mật khẩu **không bao giờ** được lưu dưới dạng văn bản thuần túy (plain text).
  - Khi đăng ký: Sử dụng `generate_password_hash(password)` để tạo bản hash.
  - Khi đăng nhập: Sử dụng `check_password_hash(hash, password)` để xác minh.
- **Vị trí code**: `auth.py` (Hàm `register_account` và `authenticate`).

### 1.2. Quản lý phiên đăng nhập (JWT & Cookies)
- **Công nghệ**: JSON Web Token (JWT).
- **Cơ chế lưu trữ**: Token được trả về và lưu trữ tại trình duyệt dưới dạng **HttpOnly Cookie**.
- **Ưu điểm**:
  - `HttpOnly`: Ngăn chặn hacker đánh cắp token qua các cuộc tấn công XSS (Javascript không thể đọc được cookie này).
  - `SameSite=Lax`: Hạn chế các cuộc tấn công CSRF.
- **Vị trí code**: `auth.py` (Hàm `create_token` và `set_auth_cookie`).

## 2. Kiểm soát truy cập (Authorization)

### 2.1. Middleware & Decorators
Hệ thống sử dụng các bộ lọc (Decorators) để bảo vệ các API:
- `@login_required`: Yêu cầu người dùng phải đăng nhập mới được truy cập.
- `@role_required('admin', 'merchant')`: Kiểm tra quyền hạn của người dùng trước khi thực thi hành động.

### 2.2. Vô hiệu hóa Token (Token Versioning)
- Mỗi tài khoản có một `token_version` trong Database.
- Khi người dùng đăng xuất, `token_version` sẽ được tăng lên (+1).
- Mọi Token cũ (có version thấp hơn) sẽ lập tức bị coi là không hợp lệ, ngay cả khi chưa hết hạn (Expired).
- **Vị trí code**: `auth.py` (Hàm `invalidate_tokens` và `get_current_account`).

## 3. Phân quyền dữ liệu (Data Scoping)

Để đảm bảo tính riêng tư, dữ liệu được lọc trực tiếp từ câu lệnh SQL dựa trên vai trò:
- **Admin**: Có quyền xem toàn bộ giao dịch.
- **Merchant/User**: Chỉ có quyền xem các giao dịch thuộc về `merchant_id` của chính họ. Hệ thống tự động thêm điều kiện `WHERE merchant_id = ...` vào mọi truy vấn liên quan.
- **Vị trí code**: `auth.py` (Hàm `scoped_transactions_query`).

## 4. Danh sách API Bảo mật

| Method | Endpoint | Mô tả | Bảo mật |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản | Invite Code (cho Admin) |
| `POST` | `/api/auth/login` | Đăng nhập | Hash Check |
| `POST` | `/api/auth/logout` | Đăng xuất | Token Invalidation |
| `GET` | `/api/me` | Lấy thông tin cá nhân | JWT Required |
| `GET` | `/api/admin/accounts` | Danh sách tài khoản | Admin Role Required |

---
*Tài liệu được cập nhật ngày 12/05/2026 bởi Hệ thống Hỗ trợ Lập trình.*
