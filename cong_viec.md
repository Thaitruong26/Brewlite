# Phân công nhiệm vụ BrewLite (hạn nộp 30/10)

*Cập nhật: 17/10/2026, người soạn: Thái*

## Mục tiêu chung

BrewLite là app đặt cà phê không dùng tiền mặt. Khách xem menu, chọn size và topping, bỏ vào giỏ, đăng nhập, thanh toán rồi nhận mã đơn. Cả nhóm phải chạy được trọn luồng này trước hạn nộp **30/10**.

- **Backend (NestJS)** làm các API. **Frontend (Next.js)** làm giao diện và gọi các API đó.
- Hai bên nói chuyện với nhau qua file `docs/api.md`. Muốn đổi tên trường hoặc mã lỗi thì sửa file này **trong cùng PR** và báo cho bên kia.
- Tiền luôn là **số nguyên VND** (ví dụ 45000). **Giá do server tính**, Frontend chỉ hiển thị.
- Mọi người nhớ chạy `git pull origin main` để kéo code mới nhất về máy trước khi code tiếp.

## Nhóm Backend (4 người)

Cách làm: mỗi người làm lần lượt theo giai đoạn. Xong hết việc giai đoạn trước mới sang giai đoạn sau. Ai xong sớm thì báo trong Daily Scrum để giúp người khác. Ngày trong ngoặc là hạn xong.

### BE1: Trưởng nhóm BE, kiêm DevOps

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Sửa setup: thêm `PricingModule` vào `AppModule` (thiếu thì BE3 không dùng được hàm tính giá), cố định `package-lock.json` và bản Node (`.nvmrc`), CORS đọc từ biến môi trường | 18/10 |
| | Chốt `docs/api.md`, quy tắc Git và mẫu PR. Đảm bảo cả 7 người chạy được dự án trên máy | 18/10 |
| 1. Menu (19-21/10) | `GET /products` và `GET /products/:id` (DTO, Swagger, lọc theo danh mục) | 20/10 |
| | `GET /toppings` và viết test cho `PricingService` | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | Viết Dockerfile cho backend và frontend, đưa vào `docker-compose.yml` để một lệnh chạy cả 3 phần | 25/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Viết README bàn giao, thử chạy docker-compose từ máy sạch | 28/10 |
| | Test luồng chính từ đầu đến cuối (cần DB riêng cho test), chuẩn bị kịch bản demo, chốt đóng băng tính năng chiều 28/10 | 29/10 |

### BE2: Auth, khuyến mãi, điểm thưởng

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Tạo khung đăng nhập dùng chung: `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser`. Từ đó API nào cần đăng nhập chỉ việc gắn guard | 18/10 |
| 1. Menu (19-21/10) | `POST /auth/register` và `POST /auth/login`: mật khẩu băm bằng bcrypt, đăng nhập xong trả JWT, có test | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | `POST /promotions/validate`: kiểm tra mã còn hạn, đủ giá trị đơn tối thiểu, còn lượt dùng và tính số tiền được giảm | 24/10 |
| | `GET /auth/me`, gắn guard cho các API orders và payments | 25/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Áp mã giảm giá lúc tạo đơn và tăng số lượt dùng mã (`usedCount`) trong cùng transaction | 27/10 |
| | Điểm thưởng: khi đơn chuyển `PAID` thì cộng 1 điểm cho mỗi 1.000đ, ghi vào `LoyaltyTransaction` (mỗi đơn chỉ được cộng một lần) | 28/10 |

### BE3: Đơn hàng, trạng thái, tồn kho

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Dựng khung máy trạng thái đơn hàng: bảng chuyển trạng thái và hàm `assertTransition` | 18/10 |
| 1. Menu (19-21/10) | Hoàn thiện máy trạng thái: đơn chỉ đi theo `PENDING → PAID → PREPARING → READY → COMPLETED`, mọi bước nhảy sai bị chặn (ví dụ `PENDING` nhảy thẳng `COMPLETED`). Viết test chứng minh | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | `POST /orders`: kiểm tra dữ liệu, tính lại giá bằng `PricingService` (không tin giá Frontend gửi), lưu đơn trạng thái `PENDING` | 24/10 |
| | `GET /orders/me` (có phân trang) và `GET /orders/:id` | 25/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Tồn kho khi nhiều người đặt cùng lúc: dùng transaction và cột `version` của Product (optimistic locking: nếu người khác vừa sửa tồn kho thì đọc lại rồi thử lại) để không bán quá số còn. Viết test đặt đồng thời trên Cà phê muối (chỉ còn 5 ly) | 28/10 |
| | `POST /orders/:id/cancel`: hoàn lại tồn kho, hoàn tiền giả lập, thu hồi điểm thưởng | 28/10 |

### BE4: Thanh toán

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Chưa có việc riêng. Đọc kỹ `docs/api.md` mục `POST /payments` và chạy thử dự án trên máy | 18/10 |
| 1. Menu (19-21/10) | Cổng thanh toán giả: mô phỏng Ví và Thẻ, có cách ép thất bại (`mockResult`) để demo lỗi | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | Khung `POST /payments`: nhận `orderId`, phương thức và header `Idempotency-Key`, lưu Payment ở trạng thái `PROCESSING`. Số tiền lấy từ đơn, không nhận từ Frontend | 25/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Chuyển đơn sang `PAID` (thành công) hoặc `PAYMENT_FAILED` (lỗi) qua máy trạng thái, rồi gọi hàm cộng điểm của BE2 | 27/10 |
| | Idempotent đầy đủ (không trừ tiền hai lần): gửi lại cùng key thì trả đúng kết quả cũ, không tạo thanh toán mới. Viết test gửi 2 lần cùng key chỉ tạo 1 đơn | 28/10 |

## Nhóm Frontend (3 người)

Nhóm Frontend cũng làm theo giai đoạn như Backend. Trong lúc API chưa xong, dùng **dữ liệu giả theo `docs/api.md`** để làm giao diện trước, đừng chờ Backend.

### FE1: Trưởng nhóm FE

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Dựng khung chung: layout, `QueryClientProvider`, file gọi API (`lib/api`), thư mục `store/` và `components/` để 3 người FE dùng cùng một cấu trúc. Đổi tiêu đề "Create Next App" thành BrewLite, thêm ảnh dự phòng khi ảnh sản phẩm lỗi | 18/10 |
| 1. Menu (19-21/10) | Trang Menu: gọi `GET /products`, hiển thị lưới sản phẩm (hình, tên, giá), có trạng thái đang tải, danh sách trống và báo lỗi, lọc theo danh mục | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | Trang đăng nhập / đăng ký: form có kiểm tra dữ liệu, lưu token, bảo vệ các trang cần đăng nhập (nhận 401 thì chuyển về trang đăng nhập) | 24/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Thanh điều hướng (header), trạng thái đang tải / lỗi dùng chung cho toàn app, giao diện dùng được trên điện thoại | 28/10 |

### FE2: Chi tiết sản phẩm, giỏ hàng, lịch sử

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Chưa có việc riêng. Đọc `docs/api.md` mục sản phẩm, topping và cách tính giá (mục 4.1), chạy thử dự án trên máy | 18/10 |
| 1. Menu (19-21/10) | Trang chi tiết sản phẩm: chọn size S/M/L và topping (tối đa 3), giá thay đổi ngay khi chọn. Công thức: giá gốc + phụ thu size + giá topping | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | Giỏ hàng bằng Zustand: thêm, sửa số lượng, xóa món; tự tính tổng tiền; hiện số lượng trên biểu tượng giỏ; lưu `localStorage` để tải lại trang không mất | 24/10 |
| | Trang giỏ hàng | 25/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Trang lịch sử đơn: gọi `GET /orders/me`, hiển thị từng đơn (mã đơn, trạng thái, tổng tiền) | 28/10 |
| | Ô nhập mã giảm giá trong giỏ hàng (gọi `POST /promotions/validate`, báo lỗi rõ khi mã sai hoặc hết hạn) và hiển thị điểm thưởng | 28/10 |

### FE3: Thanh toán và xác nhận đơn

| Giai đoạn | Việc cần làm | Hạn |
|---|---|---|
| 0. Chuẩn bị (17-18/10) | Chưa có việc riêng. Đọc `docs/api.md` mục `POST /orders` và `POST /payments`, chạy thử dự án trên máy | 18/10 |
| 1. Menu (19-21/10) | Dựng giao diện trang thanh toán bằng dữ liệu giả theo `docs/api.md`: hiển thị tổng tiền, chọn Ví hoặc Thẻ | 21/10 |
| 2. Giỏ hàng, đặt đơn, đăng nhập (22-25/10) | Nối trang thanh toán với `POST /orders` bằng API thật | 25/10 |
| 3. Thanh toán, nghiệp vụ nâng cao (26-29/10) | Nối `POST /payments`: sinh `Idempotency-Key` bằng `crypto.randomUUID()` **một lần cho mỗi lần bấm xác nhận**, giữ nguyên nếu bấm lại. Khi lỗi (mã 402) thì báo lỗi, giữ nguyên giỏ hàng, cho thử lại với key mới. Thành công thì xóa giỏ | 28/10 |
| | Trang xác nhận đơn: mã đơn, trạng thái `PAID` và dòng "Mời tới quầy lấy nước" | 28/10 |

## Yêu cầu tiêu chuẩn (SOP) cho cả nhóm

- **Chuẩn hóa API:** mọi endpoint phải bám `docs/api.md`. Lỗi luôn trả đúng dạng chuẩn (`statusCode`, `code`, `message`) để Frontend dựa vào `code` mà xử lý. Người dùng gửi thiếu hoặc thừa dữ liệu thì phải bị chặn (validate).
- **Kiểm thử bảo mật** (Swagger tại `localhost:4000/api/docs` hoặc Thunder Client): code xong API nào phải tự test kỹ API đó:
  - Không gắn header `Authorization`: phải bị chặn và báo lỗi **401**.
  - Có gắn header `Authorization` kèm token: phải cho qua và xử lý thành công.
- **Frontend:** mỗi màn hình phải có trạng thái đang tải và thông báo lỗi cơ bản. Không tự tính giá làm số chính thức: số đúng là số server trả về.
- **Quy trình Git:** không code trực tiếp lên nhánh `main`. Mỗi người tự tạo nhánh mới (ví dụ `feature/be3-orders`, `feature/fe2-cart`). Xong thì đẩy lên GitHub và mở Pull Request (PR) để người khác review trước khi cho gộp.
  - **Review chéo:** BE1 ↔ BE3, BE2 ↔ BE4, FE1 ↔ FE2, FE3 nhờ FE1.
- **Commit và PR:** mô tả rõ đã làm gì. Mỗi task coi là xong khi chạy được, không lỗi build, có validate, đã được review và có hướng dẫn trong README.
- **Daily Scrum 15 phút mỗi ngày:** mỗi người nói hôm qua làm gì, hôm nay làm gì, có bị kẹt ở đâu không. Cuối ngày cập nhật trạng thái trong file `BrewLite_Sprint_Backlog.xlsx` và biểu đồ burndown.

## Thời hạn hoàn thành

Cả dự án nộp vào **30/10**. Chia làm 5 giai đoạn liên tiếp (cùng mốc với từng người ở trên). Ngày 30/10 cả nhóm cùng demo và nộp bài.

| Giai đoạn | Thời gian | Nội dung |
|---|---|---|
| Sprint 0 | 17-18/10 | Sửa setup, dựng khung chung, chốt `docs/api.md`. Mọi người chạy được dự án trên máy |
| Sprint 1 | 19-21/10 | API sản phẩm, trang Menu, trang chi tiết. BE3 và BE4 làm sớm phần nền (máy trạng thái, cổng thanh toán giả) |
| Sprint 2 | 22-25/10 | Giỏ hàng, tạo đơn, đăng ký/đăng nhập |
| Sprint 3 | 26-29/10 | Thanh toán, xác nhận và lịch sử đơn, tồn kho đồng thời, khuyến mãi, điểm thưởng. **Đóng băng tính năng chiều 28/10**, ngày 29/10 chỉ sửa lỗi và tập demo |
| Bàn giao | 30/10 | Demo trọn luồng, bàn giao mã nguồn, họp Retrospective, nộp bài |

Mọi người cố gắng hoàn thành càng sớm càng tốt. Ai bị kẹt thì nói ngay trong Daily Scrum, đừng đợi đến cuối Sprint.

---

## Phụ lục: việc chưa có người nhận (đề xuất, chưa chốt)

Đối chiếu `api.md` với bảng phân công ở trên, các việc sau chưa có tên ai. Đây là **đề xuất**, cả nhóm cần thống nhất trước khi áp dụng.

| Việc | Nguồn trong `api.md` | Đề xuất người nhận |
|---|---|---|
| `PATCH /orders/:id/status` (barista đổi trạng thái, để demo PAID → PREPARING → READY → COMPLETED) và seed tài khoản `barista@brewlite.com` | Mục 6.13 | BE3 |
| `GET /health` (kiểm tra DB bằng `SELECT 1`, dùng cho Docker healthcheck) | Mục 6.14 | BE1 |
| Prisma schema và seed dữ liệu mẫu (sản phẩm, topping, mã giảm giá) | Mục 3, mục 8 (Task 1) | BE1 (hoặc BE4 vì có thời gian rảnh ở giai đoạn 0) |
| Chốt với giảng viên: giá có đổi theo size không (wireframe cho thấy không đổi, `api.md` đang giả định S +0, M +5.000, L +10.000) | Mục 4.1, mục 11 | BE1 và FE2 cùng hỏi |