# ☕ BrewLite - Hướng Dẫn Chạy Dự Án

### Yêu cầu trước khi chạy:
- Bật sẵn **Docker Desktop**.
- Cài sẵn **Node.js** v22.22.3 trở lên (khuyến nghị dùng [nvm](https://github.com/nvm-sh/nvm): `nvm use` tại thư mục gốc).
- *(Nếu dùng Windows PowerShell bị lỗi chặn lệnh npm)*: Chạy `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

---

## 1. Bật Database
Tại thư mục gốc dự án:
```bash
docker compose up -d
```

---

## 2. Chạy Backend (Terminal 1)
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```
- **API URL:** http://localhost:4000/api
- **Swagger Docs (Xem và test API):** http://localhost:4000/api/docs
- **Xem DB trực quan trên web:** `npx prisma studio` (truy cập http://localhost:5555)

---

## 3. Chạy Frontend (Terminal 2)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
- **Web App:** http://localhost:3000 *(hoặc http://localhost:3001 nếu cổng 3000 bị chiếm)*

---

## 4. Tài khoản test có sẵn
- **Khách hàng:** `demo@brewlite.com` | Pass: `Demo@1234`
- **Barista (Nhân viên):** `barista@brewlite.com` | Pass: `Barista@123`
