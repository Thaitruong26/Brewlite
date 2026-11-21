# BrewLite A1 Postman Workspace (`backend/postman`)

Thư mục này chứa đầy đủ tài nguyên kiểm thử API của hệ thống BrewLite Assignment 1 dành riêng cho **Postman**:

## 📁 Danh sách tệp tin
1. **`BrewLite_API.postman_collection.json`**: Bộ sưu tập 26 API chia theo 9 Module:
   - `Auth Module` (Đăng ký, Đăng nhập, Me)
   - `Products Module` (Thực đơn, Size, Topping, Công thức pha chế)
   - `Toppings Module` (Topping, Định lượng)
   - `Ingredients Module` (Tồn kho, Cảnh báo an toàn, Nhập kho, Kiểm kê)
   - `Orders Module` (Tạo đơn, Đơn của tôi, Xem đơn, Cập nhật trạng thái pha chế, Hủy đơn)
   - `Payments Module` (Thanh toán trực tiếp tiền mặt, Idempotency-Key)
   - `Promotions Module` (Kiểm tra mã giảm giá)
   - `Health Module` (Kiểm tra máy chủ & cơ sở dữ liệu)
   - `App Module` (Root API)
2. **`BrewLite_Local.postman_environment.json`**: Môi trường chạy local (`http://localhost:4000/api`).
3. **`BrewLite_Production.postman_environment.json`**: Môi trường chạy Cloud Render.
4. **`brewlite-api.swagger.json`**: Bản chuẩn OpenAPI 3.0 / Swagger JSON.

---

## 🚀 Hướng dẫn Import vào Postman trong 10 giây
1. Mở **Postman**, bấm nút **Import** (trên cùng bên trái).
2. Kéo thả đồng thời cả 3 file:
   - `BrewLite_API.postman_collection.json`
   - `BrewLite_Local.postman_environment.json`
   - `BrewLite_Production.postman_environment.json`
3. Ở góc trên cùng bên phải của Postman, chọn Environment là **`BrewLite A1 Local`** (hoặc `BrewLite A1 Production`).
4. Chạy request đầu tiên: **Auth Module > POST Đăng nhập**:
   - Token JWT sẽ **tự động** được lưu vào biến `{{accessToken}}`!
   - Các request sau đó tự động có quyền xác thực Bearer token mà không cần cấu hình thêm.

---

## 🔄 Cách tạo lại bộ sưu tập sau khi sửa API
Tại thư mục `backend`:
```bash
npm run export:postman
```
Toàn bộ collection và openapi specs sẽ tự động cập nhật lại ngay lập tức.

