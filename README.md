# Hệ thống Phân tích Giao dịch & Phát hiện Gian lận - Nhóm 9

Ứng dụng Web chuyên sâu tích hợp hệ thống quản lý người dùng (Auth) và bảng điều khiển phân tích dữ liệu (Dashboard) dành cho các giao dịch không tiền mặt tại Việt Nam 2026.

## 🚀 Tính năng chính

### 1. Quản lý & Bảo mật (Auth Module)
- **Xác thực**: Đăng ký, đăng nhập bằng JWT Token (HttpOnly Cookie).
- **Phân quyền (RBAC)**: Chia làm 3 vai trò Admin, Merchant và User.
- **Bảo mật**: Mật khẩu được mã hóa (Hashing), chống tấn công XSS/CSRF, vô hiệu hóa Token khi logout.
- **Hồ sơ cá nhân**: Trang Profile đồng bộ dữ liệu thực tế từ hệ thống.

### 2. Dashboard Phân tích dữ liệu (Analytics)
- **Tổng quan (Overview)**: GMV, Số lượng giao dịch, Active Users và Tốc độ tăng trưởng.
- **Trực quan hóa**: Biểu đồ xu hướng (Trend), Phân bổ phương thức thanh toán, Ngành hàng chi tiêu cao nhất.
- **Bản đồ địa lý**: Bản đồ nhiệt phân bổ giao dịch theo các tỉnh thành.
- **Phễu giao dịch**: Theo dõi tỷ lệ giữ chân người dùng trung thành.

### 3. Trí tuệ nhân tạo (AI & Machine Learning)
- **Phân khúc khách hàng**: Sử dụng thuật toán **K-Means Clustering** để phân loại khách hàng dựa trên mô hình RFM (Recency, Frequency, Monetary).
- **Dự báo chi tiêu**: Sử dụng mô hình baseline để dự đoán xu hướng chi tiêu trong tương lai.
- **AI Insights**: Tự động đưa ra các nhận định thông minh về hành vi người dùng.

## 🛠 Hướng dẫn cài đặt

1. **Khởi tạo môi trường**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

2. **Cấu hình môi trường**:
   - Sao chép `.env.example` thành `.env`.
   - Điền các thông tin: `SUPABASE_DB_URL`, `JWT_SECRET`, `ADMIN_INVITE_CODE`.

3. **Cấu hình Database**:
   - Chạy nội dung file `schema.sql` trong SQL Editor của Supabase để khởi tạo bảng `accounts`.

4. **Khởi động ứng dụng**:
   ```powershell
   python app.py
   ```
   Mở trình duyệt tại: `http://127.0.0.1:5000`

## 📁 Cấu trúc thư mục chính

- `app.py`: Server Flask chính, tích hợp toàn bộ API.
- `auth.py`: Logic xử lý bảo mật và xác thực.
- `services/`: Các dịch vụ xử lý dữ liệu CSV và mô hình Machine Learning.
- `templates/`: Giao diện HTML (Jinja2).
- `static/`: Tài nguyên tĩnh (CSS premium, Javascript, Images).
- `vn_cashless_2026.csv`: Dữ liệu giao dịch mẫu.

## 🔒 Tài liệu bảo mật
Chi tiết về các cơ chế mã hóa và chặn truy cập trái phép có thể xem tại: **[SECURITY_DOCUMENTATION.md](./SECURITY_DOCUMENTATION.md)**

---
**Nhóm 9 - Khoa học Máy tính & Công nghệ Phần mềm**
