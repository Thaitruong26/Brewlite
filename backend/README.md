# ☕ BrewLite — Backend (NestJS)

API server cho hệ thống quản lý quán cà phê BrewLite, xây dựng với **NestJS + Prisma + PostgreSQL**.

---

## Yêu cầu môi trường

| Công cụ | Phiên bản tối thiểu |
|---|---|
| Node.js | v22.22.3 (xem `.nvmrc`) |
| npm | v10+ |
| Docker Desktop | đang chạy |

> **Windows PowerShell:** nếu gặp lỗi chặn lệnh npm, chạy một lần:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

---

## Bước 0 — Bật Database (PostgreSQL qua Docker)

> Chạy tại **thư mục gốc** của repo (cùng cấp với `docker-compose.yml`):

```bash
docker compose up -d
```

Kiểm tra đã lên:

```bash
docker compose ps
```

Container `db` ở trạng thái **healthy / running** là đúng.
Postgres lắng nghe tại `localhost:5433` (ánh xạ từ port 5432 bên trong container).

---

## Bước 1 — Cài đặt & Cấu hình

```bash
cd backend

# 1. Sao chép file biến môi trường
cp .env.example .env

# 2. Cài dependencies (tự động chạy `prisma generate` sau khi cài)
npm install
```

Giá trị mặc định trong `.env` đã khớp với Docker Compose, không cần sửa khi chạy local:

```
PORT=4000
DATABASE_URL=postgresql://brewlite:brewlite@localhost:5433/brewlite
JWT_SECRET=change-me
JWT_EXPIRES_IN=1d
```

> ⚠️ Đổi `JWT_SECRET` thành một giá trị ngẫu nhiên trước khi deploy lên môi trường thật.

---

## Bước 2 — Migrate Database

Tạo schema trong database lần đầu (hoặc áp dụng migration mới):

```bash
npx prisma migrate dev
```

Nếu chỉ muốn áp migration mà **không** tạo migration mới (ví dụ môi trường staging):

```bash
npx prisma migrate deploy
```

---

## Bước 3 — Seed Dữ liệu Mẫu

```bash
npx prisma db seed
```

Tạo sẵn các tài khoản và sản phẩm mẫu:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | `demo@brewlite.com` | `Demo@1234` |
| Barista (Nhân viên) | `barista@brewlite.com` | `Barista@123` |

---

## Bước 4 — Chạy Backend

```bash
# Development (hot-reload)
npm run start:dev

# Debug mode
npm run start:debug

# Production
npm run start:prod
```

Sau khi khởi động:

| Endpoint | URL |
|---|---|
| REST API base | http://localhost:4000/api |
| Swagger UI (test API) | http://localhost:4000/api/docs |
| Health check | http://localhost:4000/api/health |

---

## Bước 5 — Chạy Frontend (Terminal riêng)

```bash
cd frontend

cp .env.example .env.local
npm install
npm run dev
```

| Giao diện | URL |
|---|---|
| Web App | http://localhost:3000 |
| Dự phòng (nếu 3000 bị chiếm) | http://localhost:3001 |

---

## Xem Database trực quan (Prisma Studio)

```bash
npx prisma studio
```

Truy cập http://localhost:5555 để duyệt và chỉnh sửa dữ liệu qua giao diện web.

---

## Kiểm thử

```bash
# Unit tests
npm run test

# Unit tests (watch mode)
npm run test:watch

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## Lint & Format

```bash
# Lint (oxlint)
npm run lint

# Format (prettier)
npm run format
```

---

## Tóm tắt lệnh khởi động nhanh

```bash
# Terminal 0 — DB (thư mục gốc)
docker compose up -d

# Terminal 1 — Backend
cd backend && cp .env.example .env && npm install
npx prisma migrate dev && npx prisma db seed
npm run start:dev

# Terminal 2 — Frontend
cd frontend && cp .env.example .env.local && npm install && npm run dev
```
