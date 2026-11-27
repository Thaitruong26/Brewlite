# Tóm tắt Assignment 2 – BrewLite

Tiếp tục đề tài BrewLite của Assignment 1. Làm tuần tự **5 task (16 task con)**, tổng **10 điểm**, mỗi task 2 điểm.

## 1. Quy tắc chung

- Luồng nghiệp vụ tối thiểu: **Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn**.
- Công nghệ bắt buộc: **Next.js** (mobile-first/PWA), **NestJS**, **PostgreSQL**. Được thêm công nghệ khác nhưng không được thay 3 thành phần này.
- Task sau chỉ được nghiệm thu khi tạo phẩm bắt buộc của task trước đã có trên repo và có lịch sử thay đổi rõ ràng.
- Quy trình: Yêu cầu → Mô hình hóa → Kiến trúc → Sprint 1 → Sprint 2 → CI/CD → Production.

## 2. Nội dung từng task

### Task 1 – Khai thác và đặc tả yêu cầu

| Task con | Nội dung |
|---|---|
| 1.1 Bối cảnh, stakeholder, phạm vi | Vấn đề nghiệp vụ; stakeholder (khách hàng, nhân viên quầy, quản lý cửa hàng, giảng viên/khách hàng nghiệm thu, nhóm phát triển, đơn vị thanh toán); mục tiêu và kỳ vọng từng bên; phạm vi MVP, mở rộng, không thực hiện; giả định, ràng buộc, rủi ro |
| 1.2 Yêu cầu chức năng và phi chức năng | SRS rút gọn: FR-01…, NFR-01…, ưu tiên MoSCoW, tiêu chí chấp nhận kiểm chứng được, use-case diagram tổng quát. Các nhóm tối thiểu: menu, chi tiết sản phẩm, giỏ hàng, xác thực, đặt đơn, thanh toán, lịch sử đơn, quản lý trạng thái đơn, hiệu năng, bảo mật, tính khả dụng, khả năng triển khai |
| 1.3 Đặc tả một use-case | Chọn 1 use-case (khuyến nghị Đặt và thanh toán): use-case diagram, actor, trigger, tiền/hậu điều kiện, luồng chính/thay thế/ngoại lệ, liên kết mã yêu cầu |

**Bắt buộc:** `docs/requirements/context-and-scope.md` có bảng stakeholder, in-scope, out-of-scope, giả định và ràng buộc.

### Task 2 – Mô hình hóa hệ thống

| Task con | Nội dung |
|---|---|
| 2.1 Activity diagram | Luồng end-to-end: điểm bắt đầu/kết thúc, hành động người dùng và hệ thống, decision/merge, swimlane, các trường hợp hết hàng, chưa đăng nhập, thanh toán thất bại |
| 2.2 Sequence diagram | Cho use-case ở 1.3. Lifeline: Customer → Next.js UI → NestJS API → Database → Payment Service. Thể hiện request/response, kiểm tra JWT và validate, transaction tạo đơn và cập nhật tồn kho, nhánh alt thanh toán thành công/thất bại, idempotency, thông báo kết quả |
| 2.3 Class diagram | Mức domain, tối thiểu: User, Product, Order, OrderItem, Payment, Promotion, LoyaltyTransaction. Có thuộc tính chính, quan hệ, multiplicity, enum trạng thái |

**Bắt buộc:** lưu cả file nguồn và ảnh/PDF, ví dụ `docs/diagrams/sequence-checkout.puml` và `.svg`.
**Nghiệm thu:** ba loại sơ đồ không mâu thuẫn với SRS, use-case và mô hình dữ liệu.

### Task 3 – Thiết kế kiến trúc

| Task con | Nội dung |
|---|---|
| 3.1 Phương pháp và quyết định kiến trúc | Kiến trúc C4 hoặc phân lớp: frontend Next.js/PWA, backend NestJS theo module, PostgreSQL và migration, dịch vụ thanh toán mô phỏng, logging, health check, cấu hình; lý do chọn, ưu nhược điểm, trade-off |
| 3.2 Deployment diagram | UML production: thiết bị người dùng, CDN/dịch vụ phục vụ Next.js, container NestJS API, PostgreSQL có persistent storage, container registry và nền tảng triển khai, HTTPS/kết nối nội bộ/cổng, secret/biến môi trường/health check/log, ranh giới local-CI-production |

**Bắt buộc:** mỗi quyết định quan trọng ghi thành ADR ngắn trong `docs/architecture/adr/` (ví dụ `001-monorepo.md`).
**Lưu ý:** được chọn Render, Railway, Fly.io, Azure, AWS, VPS…, nhưng sơ đồ phải khớp nền tảng thực tế.
**Nghiệm thu:** mỗi container/dịch vụ trong sơ đồ truy vết được đến thành phần trong mô tả kiến trúc và mã nguồn.

### Task 4 – Triển khai Sprint 1

*Sprint Goal: nền tảng kỹ thuật, tài liệu có kiểm soát phiên bản và MVP đầu tiên cho luồng xem menu.*

| Task con | Nội dung |
|---|---|
| 4.1 Thiết lập repository | Cấu trúc `apps/web`, `apps/api`, `docs`; chiến lược branch và PR; `README.md`, `.gitignore`, `.env.example`; issue board/Product Backlog cho Sprint 1–2; quy ước commit; Definition of Done |
| 4.2 Quản lý tài liệu | Đưa toàn bộ tạo phẩm Task 1–3 vào `docs`. Mọi thay đổi đi qua commit/PR kèm lý do |
| 4.3 MVP Sprint 1 | `GET /products`, `GET /products/:id`; màn hình menu mobile-first; trạng thái loading/empty/error; seed; test tối thiểu cho API và luồng chính. MVP phải chạy được, không phải mockup tĩnh |
| 4.4 Continuous Integration | Pipeline khi mở PR: **Install → Lint → Unit Test → Build**. PR không được merge nếu lint/test/build thất bại |

**Minh chứng:** link PR đã chạy CI, ảnh hoặc log 1 lần pipeline thành công và 1 lần phát hiện lỗi.

### Task 5 – Triển khai Sprint 2, CI/CD và Delivery

*Sprint Goal: hoàn thành luồng end-to-end, tự động hóa đóng gói và triển khai bản production truy cập được.*

| Task con | Nội dung |
|---|---|
| 5.1 Hoàn thiện MVP | Chi tiết sản phẩm, size, topping; giỏ hàng và tổng tiền; đăng ký, đăng nhập, JWT; tạo đơn; thanh toán Ví/Thẻ mô phỏng; xác nhận, trạng thái, lịch sử đơn; xử lý lỗi và validate cả frontend lẫn backend |
| 5.2 Tích hợp và kiểm thử | Unit test cho nghiệp vụ quan trọng; integration test cho API tạo đơn/thanh toán; ít nhất 1 E2E từ menu đến xác nhận đơn; migration/seed tái tạo được database; `docker-compose.yml` chạy web, API, DB ở local; health endpoint (ví dụ `GET /health`) |
| 5.3 Continuous Delivery/Deployment | Push/Tag → Lint và Test → Build → Docker image → Push registry → Deploy → Smoke test. Phải: quality gate; image tag bằng commit SHA hoặc semver; push registry; deploy bằng secret của CI; migration an toàn; health check/smoke test sau deploy; dừng pipeline và có cách rollback khi lỗi |
| 5.4 Triển khai và bàn giao | URL frontend production qua HTTPS; URL API và health check; DB production không public trực tiếp; secret không lộ trong repo/log CI; release/tag và release notes; README (chạy local, test, build, deploy, rollback); video/demo trực tiếp luồng end-to-end; Sprint Review và Sprint Retrospective |

**Nghiệm thu:** người ngoài nhóm clone repo, chạy theo README và truy cập được bản production từ các URL cung cấp.

## 3. Truy vết

Tạo `docs/traceability-matrix.md` nối: **Mã yêu cầu → Use-case/User Story → Thiết kế/Sơ đồ → Code/API → Test**.

| Mã yêu cầu | Use-case/User Story | Thiết kế/Sơ đồ | Code/API | Test |
|---|---|---|---|---|
| FR-01 | US-01 Xem menu | Activity-01, Class-01 | GET /products | API-T01 |
| FR-05 | UC-01 Thanh toán | Sequence-01 | POST /payments | INT-T03 |

- Task trước thiếu tạo phẩm bắt buộc thì task sau **không được tính điểm truy vết**.
- Không có URL production hoạt động lúc chấm thì phần triển khai của Task 5 **không được tính hoàn thành**.

## 4. Cấu trúc repository

```
brewlite/
|-- apps/
|   |-- web/                  # Next.js mobile-first/PWA
|   `-- api/                  # NestJS
|-- docs/
|   |-- requirements/         # Task 1
|   |-- diagrams/             # Task 2
|   |-- architecture/         # Task 3
|   |-- traceability-matrix.md
|   `-- deployment.md
|-- tests/                    # Integration/E2E
|-- .github/workflows/        # CI/CD
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

## 5. Checklist nộp bài

- [ ] Link repository và quyền truy cập cho giảng viên
- [ ] SRS, đặc tả use-case và ma trận truy vết
- [ ] Activity, sequence, class và deployment diagram
- [ ] Source code frontend, backend và migration
- [ ] Unit, integration và end-to-end test
- [ ] Pipeline CI/CD chạy thành công
- [ ] URL production, API và health check
- [ ] Release notes, README và hướng dẫn rollback
- [ ] Video/demo và Sprint Retrospective