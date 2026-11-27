# Hướng Dẫn Test Toàn Bộ API BrewLite Bằng Postman (37 Requests / 9 Nhóm)

Tài liệu này hướng dẫn import và kiểm thử **đầy đủ 100% các API** trong `BrewLite_API.postman_collection.json` (không bỏ sót bất kỳ API nào).

---

## 1. Chuẩn bị & Import vào Postman

1. Mở **Postman** → bấm **Import** → chọn các file trong thư mục `apps/api/postman/`:
   - **Collection đầy đủ:** `BrewLite_API.postman_collection.json` *(37 requests)*
   - *(Tuỳ chọn chỉ API Frontend dùng)*: `BrewLite_Frontend_API.postman_collection.json` *(34 requests)*
   - **Environment:**
     - Test máy local / Docker: `BrewLite_Local.postman_environment.json` (`baseUrl = http://localhost:4000/api`)
     - Test server Render: `BrewLite_Production.postman_environment.json` (`baseUrl = https://brewlite-a2-syoc.onrender.com/api`)
2. Ở góc trên bên phải Postman, chọn Environment tương ứng (**BrewLite Local** hoặc **BrewLite Production**).
3. Nếu test trên Production Render (Free tier), gọi `GET /api/health` trước 1 lần để đánh thức server (~30 giây nếu server đang sleep).

---

## 2. Đăng nhập lấy đủ 3 Token (Nhóm 1 — Auth)

Collection đã gắn script tự động lưu token vào biến môi trường ngay khi gọi login thành công:

| STT | Request | Method & URL | Tài khoản mẫu (Body) | Token tự động lưu |
|---|---|---|---|---|
| 1 | Đăng ký tài khoản mới | `POST {{baseUrl}}/auth/register` | `{"email":"customer.new@brewlite.com","password":"Password@123","fullName":"Nguyễn Văn A"}` | *(201 Created)* |
| 2 | 1. Đăng nhập Khách | `POST {{baseUrl}}/auth/login` | `{"email":"demo@brewlite.com","password":"Demo@1234"}` | `{{customerToken}}` |
| 3 | 2. Đăng nhập Barista | `POST {{baseUrl}}/auth/login` | `{"email":"barista@brewlite.com","password":"Barista@123"}` | `{{baristaToken}}` |
| 4 | 3. Đăng nhập Manager | `POST {{baseUrl}}/auth/login` | `{"email":"manager@brewlite.com","password":"Manager@123"}` | `{{managerToken}}` |
| 5 | Lấy thông tin user | `GET {{baseUrl}}/auth/me` | *(Bearer `{{customerToken}}`)* | *(200 OK)* |

> **Lưu ý:** Chạy lần lượt 3 request **Login** (Khách, Barista, Manager) trước để Postman có sẵn cả 3 token.

---

## 3. Danh sách test toàn bộ 32 API còn lại (theo đúng thứ tự nhóm)

### Nhóm 2 — Products (Thực đơn & Công thức món)
| STT | API | Auth | Tham số / Body mẫu | Kỳ vọng |
|---|---|---|---|---|
| 6 | `GET {{baseUrl}}/products` | Không | Query tuỳ chọn: `?page=1&limit=20&category=...&search=...` | `200` Danh sách món + phân trang |
| 7 | `GET {{baseUrl}}/products/:id` | Không | Path param `id = 1` | `200` Chi tiết món, `sizes`, `toppings` (`404` nếu sai ID) |
| 8 | `GET {{baseUrl}}/products/:id/recipe` | `{{baristaToken}}` | Path param `id = 1` | `200` Công thức size M (`403` nếu dùng `customerToken`) |
| 9 | `PUT {{baseUrl}}/products/:id/recipe` | `{{managerToken}}` | Path `id = 1`, Body: `{"items":[{"ingredientId":1,"quantity":18}]}` | `200` Cập nhật công thức (`403` nếu dùng `baristaToken`) |

---

### Nhóm 3 — Toppings (Topping & Công thức topping)
| STT | API | Auth | Tham số / Body mẫu | Kỳ vọng |
|---|---|---|---|---|
| 10 | `GET {{baseUrl}}/toppings` | Không | — | `200` Danh sách topping đang kích hoạt |
| 11 | `GET {{baseUrl}}/toppings/:id/recipe` | `{{baristaToken}}` | Path `id = 1` | `200` Định lượng 1 phần topping |
| 12 | `PUT {{baseUrl}}/toppings/:id/recipe` | `{{managerToken}}` | Path `id = 1`, Body: `{"items":[{"ingredientId":1,"quantity":18}]}` | `200` Cập nhật công thức topping (`403` nếu dùng `baristaToken`) |

---

### Nhóm 4 — Ingredients (Kho nguyên liệu & Thẻ kho)
| STT | API | Auth | Tham số / Body mẫu | Kỳ vọng |
|---|---|---|---|---|
| 13 | `GET {{baseUrl}}/ingredients` | Không | Query tuỳ chọn: `?page=1&limit=50` | `200` Danh sách nguyên liệu + cờ `low` |
| 14 | `POST {{baseUrl}}/ingredients` | `{{managerToken}}` | `{"name":"Matcha Nhật Test","unit":"G","stock":1000,"lowThreshold":200}` *(unit: `G` \| `ML` \| `PCS`)* | `201` Tạo mới (`409` nếu trùng tên, `403` nếu không phải Manager) |
| 15 | `PATCH {{baseUrl}}/ingredients/:id` | `{{managerToken}}` | Path `id = 1`, Body: `{"name":"Đường mía","lowThreshold":300}` | `200` Cập nhật tên / ngưỡng cảnh báo |
| 16 | `POST {{baseUrl}}/ingredients/:id/stock` | `{{baristaToken}}` *(hoặc không)* | Path `id = 1`, Body: `{"quantity":500,"note":"Nhập kho sáng"}` | `200` Cộng thêm tồn kho, ghi nhận `RESTOCK` |
| 17 | `POST {{baseUrl}}/ingredients/:id/adjust` | `{{baristaToken}}` | Path `id = 1`, Body: `{"actualStock":950,"reason":"Hao hụt khi pha chế"}` | `200` Kiểm kê thực tế, ghi `ADJUST` (`400` nếu thiếu lý do ≥ 3 ký tự) |
| 18 | `GET {{baseUrl}}/ingredients/:id/movements` | `{{baristaToken}}` | Path `id = 1`, Query: `?page=1&limit=20` | `200` Nhật ký biến động tồn kho |

---

### Nhóm 5 — Orders (Đặt đơn, Pha chế, Hủy đơn & Hoàn tiền)
| STT | API | Auth | Tham số / Body mẫu | Kỳ vọng |
|---|---|---|---|---|
| 19 | `POST {{baseUrl}}/orders` | `{{customerToken}}` | `{"items":[{"productId":1,"size":"M","quantity":1,"toppingIds":[1],"note":"Ít đường"}],"promoCode":"BREW10","usePoints":false}` | `201` Tạo đơn `PENDING` + giữ kho (`409` nếu hết nguyên liệu). Lưu `id` vào `{{currentOrderId}}`. |
| 20 | `GET {{baseUrl}}/orders` | `{{baristaToken}}` | Query tuỳ chọn: `?status=PAID&page=1&limit=20` | `200` Hàng đợi đơn của quán (`403` nếu dùng `customerToken`) |
| 21 | `GET {{baseUrl}}/orders/me` | `{{customerToken}}` | Query: `?page=1&limit=20` | `200` Lịch sử đơn của khách đang đăng nhập |
| 22 | `GET {{baseUrl}}/orders/:id` | `{{customerToken}}` | Path `id = {{currentOrderId}}` | `200` Chi tiết đơn (`403` nếu xem đơn của người khác) |
| 23 | `POST {{baseUrl}}/orders/:id/cancel` | `{{customerToken}}` | Path `id = {{currentOrderId}}`. Nếu đơn `PENDING`: `{}`. Nếu đơn `PAID`: `{"refundBank":"MB","refundAccount":"0901234567"}` | `200` Chuyển `CANCELLED` (`409` nếu đã sang `PREPARING`) |
| 24 | `PATCH {{baseUrl}}/orders/:id/status` | `{{baristaToken}}` | Path `id = {{currentOrderId}}`, Body lần lượt: `{"status":"PREPARING"}` → `"READY"` → `"COMPLETED"` | `200` Chuyển trạng thái hợp lệ (`409` nếu nhảy cóc trạng thái) |
| 25 | `PATCH {{baseUrl}}/orders/:id/confirm-refund` | `{{baristaToken}}` | *(Dùng cho đơn `PAID` đã hủy)* Body: `{"refundRef":"FT2401928374"}` | `200` Đánh dấu đã hoàn tiền VietQR (`409` nếu gọi lặp 2 lần) |
| 26 | `PATCH {{baseUrl}}/orders/:id/refund-points` | `{{baristaToken}}` | *(Dùng cho đơn `PAID` đã hủy chưa hoàn tiền)* Body: `{}` | `200` Quy đổi `order.total / 10` thành điểm thưởng cộng cho khách |
| 27 | `PATCH {{baseUrl}}/orders/:id/fail-refund` | `{{baristaToken}}` | *(Dùng cho đơn `PAID` đã hủy chưa hoàn tiền)* Body: `{"reason":"Sai số tài khoản"}` | `200` Chuyển `refundStatus = FAILED` |
| 28 | `PATCH {{baseUrl}}/orders/:id/hold-refund` | `{{baristaToken}}` | *(Dùng cho đơn `PAID` đã hủy chưa hoàn tiền)* Body: `{"note":"Napas nghẽn lệnh, chờ đối soát"}` | `200` Chuyển `refundStatus = UNKNOWN`, khóa retry |
| 29 | `PATCH {{baseUrl}}/orders/:id/retry-refund` | `{{baristaToken}}` | *(Dùng sau `fail-refund`)* Body: `{"refundBank":"VCB","refundAccount":"0123456789"}` | `200` Về `PENDING` (`409` nếu đang ở `UNKNOWN`) |

---

### Nhóm 6 — Payments (Thanh toán, VNPay Sandbox, Simulator & IPN)
| STT | API | Auth | Tham số / Body mẫu | Kỳ vọng |
|---|---|---|---|---|
| 30 | `POST {{baseUrl}}/payments` | `{{customerToken}}` | Header `Idempotency-Key: test-key-1`, Body: `{"orderId":1,"method":"WALLET","mockResult":"SUCCESS"}` | `200/201` Thanh toán giả lập; gọi lại cùng key không trừ/cộng trùng |
| 31 | `POST {{baseUrl}}/payments/vnpay/create-url` | `{{customerToken}}` | Header `Idempotency-Key: vnpay-key-1`, Body: `{"orderId":1}` | `201` Trả về `paymentUrl` đã ký HMAC-SHA512 |
| 32 | `POST {{baseUrl}}/payments/vnpay/simulate-complete` | `{{customerToken}}` | Body: `{"orderId":1,"responseCode":"00"}` | `200` Trả về query string có `vnp_SecureHash` hợp lệ (dùng để test API 33 & 34) |
| 33 | `GET {{baseUrl}}/payments/vnpay/verify` | Không | Copy toàn bộ query params từ API 32 gắn vào URL `?vnp_Amount=...&vnp_SecureHash=...` | `200` Xác thực Return URL cho UI hiển thị |
| 34 | `GET {{baseUrl}}/payments/vnpay/ipn` | Không | Copy toàn bộ query params từ API 32 gắn vào URL `?vnp_Amount=...&vnp_SecureHash=...` | `200` `{ "RspCode": "00", "Message": "Confirm Success" }`, chuyển đơn sang `PAID` |

---

### Nhóm 7, 8, 9 — Promotions, Health & App
| STT | Nhóm | API | Auth | Tham số / Body mẫu | Kỳ vọng |
|---|---|---|---|---|---|
| 35 | Promotions | `POST {{baseUrl}}/promotions/validate` | Không | `{"code":"BREW10","orderValue":60000}` | `200` Trả về số tiền giảm hợp lệ |
| 36 | Health | `GET {{baseUrl}}/health` | Không | — | `200` `{"status":"ok","database":"up"}` |
| 37 | App | `GET {{baseUrl}}` | Không | — | `200` Thông điệp chào mừng Root API |

---

## 4. Kịch bản test End-to-End nhanh (gợi ý)
1. **Luồng đặt đơn → thanh toán VNPay → pha chế:** `#2 (Login Khách)` → `#6 (Menu)` → `#35 (Check voucher)` → `#19 (Tạo đơn)` → `#32 (Simulate VNPay)` → `#34 (Gọi IPN)` → `#3 (Login Barista)` → `#24 (PREPARING → READY → COMPLETED)`.
2. **Luồng hủy đơn `PAID` & hoàn tiền VietQR:** `#19 (Tạo đơn)` → `#30 (Thanh toán SUCCESS)` → `#23 (Hủy với STK)` → `#27 (Fail refund)` → `#29 (Retry refund)` → `#25 (Confirm refund)`.
3. **Luồng quản lý kho (Manager vs Barista):** `#4 (Login Manager)` → `#14 (Tạo NL mới)` → `#15 (Sửa ngưỡng)` → `#9 (Sửa công thức món)` → `#3 (Login Barista)` → `#16 (Nhập thêm kho)` → `#17 (Kiểm kê)` → `#18 (Xem thẻ kho)`.

