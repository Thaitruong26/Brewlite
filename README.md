# ☕ BrewLite — Hệ Thống Đặt Cà Phê & Quản Lý Quầy Không Dùng Tiền Mặt

> **Trường Đại học Sài Gòn (SGU) — Khoa Công nghệ Thông tin**  
> **Môn học:** Công nghệ Phần mềm | **Học kỳ:** I, Năm học 2026–2027  
> **Quy trình phát triển:** Agile Scrum

---

##  1. Giới thiệu tổng quan (Project Overview)

**BrewLite** là nền tảng ứng dụng đặt đồ uống và quản lý vận hành quầy pha chế theo định hướng **không dùng tiền mặt (cashless)**. Hệ thống giải quyết bài toán quá tải, giảm thiểu thời gian xếp hàng chờ đợi vào các khung giờ cao điểm tại quầy cà phê khuôn viên trường học/văn phòng.

### 🎯 Sứ mệnh & Tầm nhìn (Product Vision)
> *"BrewLite giúp khách hàng đặt và thanh toán đồ uống không dùng tiền mặt chỉ trong vài chạm, giảm thời gian xếp hàng và nhận đơn nhanh tại quầy; đồng thời cung cấp công cụ quản lý hàng đợi và kiểm soát kho nguyên liệu chính xác cho Barista."*

### 👥 Đối tượng người dùng & Phạm vi
* **Khách hàng (Customer):** Tự đặt đồ uống qua điện thoại/máy tính, tùy chỉnh size/topping, áp dụng mã giảm giá, sử dụng điểm tích lũy, quét mã QR thanh toán và theo dõi tiến độ đơn hàng theo thời gian thực.
* **Nhân viên pha chế (Barista):** Sử dụng hệ thống màn hình điều phối quầy (KDS - Kitchen Display System), nhận đơn thanh toán QR, chuyển bước pha chế, theo dõi định lượng công thức và giám sát tồn kho nguyên liệu.

---

## 🛠️ 2. Kiến trúc & Công nghệ (Tech Stack)

Hệ thống được thiết kế theo kiến trúc phân lớp hiện đại, tách biệt hoàn toàn giữa Frontend (Client-side) và Backend (Server-side):

```
Client (Next.js App Router) ──[REST API / JWT]──> Controller (NestJS) ──> Service (Business Logic) ──> Prisma ORM ──> PostgreSQL 16
```

### 💻 Công nghệ cốt lõi
* **Frontend:** 
  * [Next.js 16](https://nextjs.org/) (App Router, Turbopack) & [React 19](https://react.dev/)
  * [Tailwind CSS v4](https://tailwindcss.com/) — Giao diện responsive, hiện đại
  * [Zustand](https://github.com/pmndrs/zustand) — Quản lý state giỏ hàng, thông tin phiên đăng nhập
  * [TanStack Query](https://tanstack.com/query) — Caching và đồng bộ trạng thái server
  * [Lucide React](https://lucide.dev/) — Hệ thống icon trực quan
* **Backend:** 
  * [NestJS 11](https://nestjs.com/) (Node.js/TypeScript, chuẩn ESM)
  * [Prisma ORM 7](https://www.prisma.io/) — Quản lý schema, migration và tương tác CSDL
  * [PostgreSQL 16](https://www.postgresql.org/) — Hệ quản trị cơ sở dữ liệu quan hệ
  * [class-validator](https://github.com/typestack/class-validator) & [class-transformer](https://github.com/typestack/class-transformer) — Validation DTO tự động
  * [Passport.js](http://www.passportjs.org/) & [JWT](https://jwt.io/) — Xác thực và phân quyền (RBAC)
  * [Swagger / OpenAPI](https://swagger.io/) — Tài liệu hóa API tương tác
* **DevOps & Testing:**
  * [Docker & Docker Compose](https://www.docker.com/) — Container hóa toàn bộ CSDL và ứng dụng
  * [Vitest](https://vitest.dev/) — Chạy toàn bộ Unit Tests & End-to-End (E2E) Tests siêu tốc

---

## 🌟 3. Các tính năng nổi bật (Key Features)

### 3.1. Phân hệ Khách hàng (Customer Web Portal)
* **Thực đơn trực quan & Đa dạng:** 20 món đồ uống tiêu chuẩn chia thành các nhóm (Trà sữa, Trà trái cây, Trà nguyên vị, Matcha, Cà phê đặc biệt).
* **Tùy biến món linh hoạt:** Chọn kích cỡ (Size S / M / L) và lựa chọn thêm topping (Trân châu đen, Trân châu đường đen, Thạch củ năng, Kem cheese...) kèm ghi chú đặc biệt cho barista.
* **Giỏ hàng & Khuyến mãi:** Tự động tính toán giá tiền, hỗ trợ áp dụng mã giảm giá (Promo Code) và dùng điểm tích lũy thành viên (Loyalty Points) giảm trực tiếp vào hóa đơn.
* **Thanh toán MoMo QR tiện lợi:** Sinh mã QR thanh toán động kèm mã đơn hàng, bộ đếm ngược 15 phút, tự động hủy nếu quá hạn và tự động chuyển màn hình lấy nước ngay khi Barista xác nhận.
* **Theo dõi đơn hàng:** Xem trạng thái đơn từ lúc chờ thanh toán, đang pha chế đến khi sẵn sàng nhận nước.

### 3.2. Phân hệ Quầy pha chế (Barista KDS & Quản lý Kho)
* **Màn hình điều phối đơn (KDS):** Phân loại tab thông minh (`Chờ thanh toán`, `Đang làm`, `Làm xong`, `Lịch sử`, `Đã hủy`).
* **Xác nhận thanh toán một chạm:** Nút bấm `✓ Xác nhận đã nhận tiền (PAID)` giúp Barista xác nhận tiền vào tài khoản và tự động đẩy đơn sang hàng đợi làm món.
* **Quản lý kho theo nguyên liệu:** Theo dõi chính xác 34 nguyên liệu (sữa, cà phê, cốt trà, muối, kem whipping...) thay vì đếm số ly đơn thuần. Cảnh báo tự động nguyên liệu *Sắp hết* hoặc *Tạm hết*.
* **Công thức định lượng & Dự báo:** Xem chi tiết công thức chuẩn size M của từng món, tự động tính số ly tối đa có thể pha được dựa theo lượng nguyên liệu tồn thực tế.
* **Đồng bộ thực đơn tức thì:** Bật/tắt trạng thái món bán hoặc tạm hết để ẩn/hiển thị ngay trên menu khách hàng.

### 3.3. Điểm nhấn kỹ thuật Backend
1. **Optimistic Locking (`version`):** Ngăn chặn race condition khi nhiều khách hàng cùng đặt một món có nguyên liệu sắp cạn kho cùng một thời điểm.
2. **State Machine chặt chẽ:** Kiểm soát vòng đời đơn hàng không thể nhảy cóc (`PENDING → PAID → PREPARING → READY → COMPLETED / CANCELLED`).
3. **Nguồn chân lý duy nhất (Single Source of Truth):** Giá tiền, phụ thu size/topping và lượng nguyên liệu tiêu thụ luôn do Server tính lại độc lập, không tin tưởng giá từ client gửi lên.
4. **Idempotency & Rollback an toàn:** Hỗ trợ khóa Idempotency Key chống thanh toán trùng lặp; tự động hoàn trả nguyên liệu (dựa theo snapshot tiêu thụ) và hoàn điểm loyalty khi đơn bị hủy.

---

## 🚀 4. Hướng dẫn khởi chạy (Getting Started)

### Cách 1: Chạy trọn gói qua Docker Compose (Khuyên dùng khi chấm bài)

Chỉ với **một lệnh duy nhất**, toàn bộ PostgreSQL, Backend (NestJS) và Frontend (Next.js) sẽ tự động build, migrate schema, nạp dữ liệu mẫu và khởi chạy đồng bộ:

```bash
docker compose up --build
```

Sau khi khởi chạy thành công:
* 🌐 **Website khách hàng:** [http://localhost:3000](http://localhost:3000)
* 🍵 **Quầy pha chế Barista:** [http://localhost:3000/barista](http://localhost:3000/barista)
* 🔌 **Backend API:** [http://localhost:4000/api](http://localhost:4000/api)
* 📚 **Swagger API Docs:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

### Cách 2: Chạy môi trường Development (Thủ công)

#### Yêu cầu trước khi chạy:
* Cài đặt **Node.js** v22 trở lên.
* Bật sẵn **Docker Desktop** để chạy Database PostgreSQL.

#### 1. Khởi động Cơ sở dữ liệu:
```bash
docker compose up -d db
```

#### 2. Khởi động Backend (Terminal 1):
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

#### 3. Khởi động Frontend (Terminal 2):
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

---

## 🔑 5. Tài khoản kiểm thử có sẵn (Demo Accounts)

Hệ thống đã nạp sẵn dữ liệu mẫu (`seed data`) để kiểm thử ngay:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn & Chức năng |
|---|---|---|---|
| **Barista (Nhân viên quầy)** | `barista@brewlite.com` | `Barista@123` | Toàn quyền quầy Barista: xác nhận tiền QR, đổi trạng thái pha chế, quản lý kho nguyên liệu, nhập hàng |
| **Khách hàng thân thiết** | `demo@brewlite.com` | `Demo@1234` | Đặt hàng, áp mã giảm giá, sử dụng điểm tích lũy thành viên, xem lịch sử |
| **Mã giảm giá mẫu** | `WELCOME50` (Giảm 50%, tối đa 25.000đ), `FREESHIP` (Giảm 15.000đ) |

---

## 📁 6. Cấu trúc thư mục dự án (Project Structure)

```
brewlite/
├── backend/                  # Mã nguồn Backend (NestJS)
│   ├── prisma/               # Schema CSDL, migrations và file nạp dữ liệu mẫu seed.ts
│   ├── src/
│   │   ├── auth/             # Module xác thực JWT, đăng ký, đăng nhập & phân quyền Roles
│   │   ├── common/           # Bộ lọc lỗi AllExceptionsFilter, PricingService, RecipeService
│   │   ├── ingredients/      # Quản lý 34 nguyên liệu, tồn kho, xuất nhập kho
│   │   ├── loyalty/          # Tích điểm thành viên và lịch sử giao dịch điểm
│   │   ├── orders/           # Tạo đơn, State Machine, Optimistic Locking trừ kho
│   │   ├── payments/         # Xử lý giao dịch thanh toán Idempotent
│   │   ├── products/         # Danh mục 20 sản phẩm và công thức đồ uống
│   │   ├── promotions/       # Quản lý và kiểm tra tính hợp lệ của mã giảm giá
│   │   └── toppings/         # Danh mục topping và công thức tiêu thụ
│   └── test/                 # Bộ kiểm thử tích hợp End-to-End (E2E)
├── frontend/                 # Mã nguồn Frontend (Next.js 16 + Tailwind CSS)
│   ├── public/               # Tài nguyên tĩnh (Logo, hình ảnh đồ uống, mã QR)
│   └── src/
│       ├── app/              # App Router (/, /menu, /cart, /checkout, /payment, /barista...)
│       ├── components/       # Các UI Component dùng chung (Header, Footer, Dialog, Modal)
│       ├── lib/              # Client API, hàm tiện ích, cấu hình kết nối Backend
│       └── store/            # Quản lý trạng thái toàn cục với Zustand (Auth, Cart, Stock)
├── api.md                    # Tài liệu đặc tả chi tiết toàn bộ các REST API
├── .github/
│   └── workflows/            # Quy trình tự động hóa CI/CD (GitHub Actions)
│       ├── ci.yml            # Tự động lint, test & build Backend/Frontend/Docker khi push PR
│       └── cd.yml            # Tự động build & publish Docker Image lên GHCR khi merge main
├── docker-compose.yml        # Cấu hình khởi chạy trọn gói các dịch vụ
└── README.md                 # Tài liệu giới thiệu và hướng dẫn đồ án
```

---

## 🧪 7. Kiểm thử tự động (Automated Testing)

Toàn bộ các quy tắc nghiệp vụ trọng yếu (tính giá, trừ tồn kho đồng thời, idempotent thanh toán, state machine) đều được kiểm thử tự động với Vitest:

```bash
# Chạy Unit Tests Backend (86 tests)
npm --prefix backend run test

# Chạy End-to-End Tests Backend (11 tests)
npm --prefix backend run test:e2e

# Kiểm tra build Frontend
npm --prefix frontend run build
```

---

## 🔄 8. Quy trình CI/CD (GitHub Actions)

Dự án tích hợp sẵn quy trình CI/CD tự động qua GitHub Actions:

1. **Continuous Integration (`ci.yml`):**
   * Kích hoạt khi có `push` hoặc `pull_request` vào 2 nhánh `main` và `develop`.
   * **Backend Job:** Khởi tạo container PostgreSQL 16 dịch vụ, chạy Prisma migrations, nạp seed data, chạy linter (Oxlint), chạy toàn bộ 86 Unit Tests, 11 E2E Tests và build NestJS.
   * **Frontend Job:** Cài đặt dependencies, chạy linter (ESLint) và build ứng dụng Next.js.
   * **Docker Check Job:** Kiểm tra tính hợp lệ của `docker-compose.yml` và build thử nghiệm các Docker containers.
2. **Continuous Deployment (`cd.yml`):**
   * Kích hoạt tự động khi merge vào nhánh `main`.
   * Đóng gói Docker Images cho cả Backend và Frontend, gắn thẻ version theo commit SHA & `latest`, tự động phát hành lên **GitHub Container Registry (GHCR)**.

---

## 📄 9. Tài liệu tham khảo
* Tài liệu đặc tả API chi tiết: [`api.md`](./api.md)
* Giao diện tương tác Swagger UI: `http://localhost:4000/api/docs`
