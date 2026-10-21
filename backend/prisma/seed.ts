// Dữ liệu mẫu cho BrewLite. Chạy: npx prisma db seed
// Chạy nhiều lần vẫn an toàn (dùng upsert), không tạo trùng.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Ảnh nằm trong frontend/public/img/<tên>.jpg (bạn tự bỏ ảnh vào, hoặc dùng ảnh tạm).
const products = [
  // Nhóm 1 — Trà sữa (6 món)
  { name: 'Trà Sữa Truyền Thống', price: 35000, category: 'Trà sữa', stock: 50, imageUrl: '/img/tra-sua-truyen-thong.jpg', description: 'Trà đen đậm đà kết hợp sữa thơm béo' },
  { name: 'Ô Long Sữa', price: 38000, category: 'Trà sữa', stock: 50, imageUrl: '/img/o-long-sua.jpg', description: 'Trà ô long thanh mát hòa quyện vị sữa béo ngậy' },
  { name: 'Trà Sữa Khoai Môn', price: 42000, category: 'Trà sữa', stock: 40, imageUrl: '/img/tra-sua-khoai-mon.jpg', description: 'Vị khoai môn bùi béo tự nhiên, màu tím bắt mắt' },
  { name: 'Trà Sữa Oreo Phô Mai', price: 45000, category: 'Trà sữa', stock: 40, imageUrl: '/img/tra-sua-oreo-pho-mai.jpg', description: 'Vụn bánh Oreo giòn tan kết hợp lớp kem phô mai béo ngậy' },
  { name: 'Trà Sữa Trân Châu Đen', price: 40000, category: 'Trà sữa', stock: 50, imageUrl: '/img/tra-sua-tran-chau-den.jpg', description: 'Trà sữa truyền thống kèm trân châu đen dẻo dai' },
  { name: 'Trà Sữa Trân Châu Đường Đen', price: 45000, category: 'Trà sữa', stock: 45, imageUrl: '/img/tra-sua-duong-den.jpg', description: 'Đường đen thơm lừng quyện cùng sữa tươi và trân châu' },

  // Nhóm 2 — Trà trái cây (5 món)
  { name: 'Trà Đào Cam Sả', price: 39000, category: 'Trà trái cây', stock: 40, imageUrl: '/img/tra-dao-cam-sa.jpg', description: 'Trà đen thanh mát kết hợp đào ngâm giòn, cam tươi và sả thơm' },
  { name: 'Trà Vải', price: 42000, category: 'Trà trái cây', stock: 35, imageUrl: '/img/tra-vai.jpg', description: 'Trà hoa nhài thanh khiết với trái vải mọng nước' },
  { name: 'Trà Chanh Dây', price: 35000, category: 'Trà trái cây', stock: 40, imageUrl: '/img/tra-chanh-day.jpg', description: 'Vị chua ngọt thanh mát giải nhiệt tức thì' },
  { name: 'Trà Dâu Tây', price: 42000, category: 'Trà trái cây', stock: 35, imageUrl: '/img/tra-dau-tay.jpg', description: 'Dâu tây tươi ngọt ngào hòa quyện cùng cốt trà hoa quả' },
  { name: 'Trà Xoài', price: 40000, category: 'Trà trái cây', stock: 35, imageUrl: '/img/tra-xoai.jpg', description: 'Thịt xoài chín thơm ngọt thanh mát trên nền trà xanh' },

  // Nhóm 3 — Trà nguyên vị và ô long (3 món)
  { name: 'Ô Long Sữa Nhài', price: 40000, category: 'Trà nguyên vị và ô long', stock: 35, imageUrl: '/img/o-long-sua-nhai.jpg', description: 'Hương hoa nhài thoang thoảng hòa cùng cốt trà ô long sữa' },
  { name: 'Ô Long Sữa Tươi Nướng', price: 45000, category: 'Trà nguyên vị và ô long', stock: 40, imageUrl: '/img/o-long-nuong.jpg', description: 'Vị trà nướng đậm đà đặc trưng kết hợp sữa tươi thanh trùng' },
  { name: 'Ô Long Sữa Tươi Xoài', price: 45000, category: 'Trà nguyên vị và ô long', stock: 35, imageUrl: '/img/o-long-xoai.jpg', description: 'Trà ô long sữa thơm ngậy kết hợp mứt xoài ngọt dịu' },

  // Nhóm 4 — Matcha (3 món)
  { name: 'Matcha Latte', price: 48000, category: 'Matcha', stock: 35, imageUrl: '/img/matcha-latte.jpg', description: 'Bột trà xanh Nhật Bản nguyên chất hòa cùng sữa tươi' },
  { name: 'Matcha Sữa Dâu', price: 50000, category: 'Matcha', stock: 30, imageUrl: '/img/matcha-sua-dau.jpg', description: 'Hai tầng đẹp mắt: mứt dâu tây chua ngọt và matcha thơm đậm' },
  { name: 'Matcha Đậu Đỏ', price: 52000, category: 'Matcha', stock: 30, imageUrl: '/img/matcha-dau-do.jpg', description: 'Matcha đậm vị kết hợp topping đậu đỏ bùi ngọt truyền thống' },

  // Nhóm 5 — Cà phê và món đặc biệt (3 món)
  { name: 'Cà Phê Sữa', price: 35000, category: 'Cà phê và món đặc biệt', stock: 50, imageUrl: '/img/ca-phe-sua.jpg', description: 'Cà phê phin truyền thống pha sữa đặc đậm đà' },
  { name: 'Bạc Xỉu', price: 38000, category: 'Cà phê và món đặc biệt', stock: 40, imageUrl: '/img/bac-xiu.jpg', description: 'Nhiều sữa ít cà phê, ngọt béo thơm lừng' },
  { name: 'Cà Phê Muối', price: 42000, category: 'Cà phê và món đặc biệt', stock: 5, imageUrl: '/img/ca-phe-muoi.jpg', description: 'Lớp kem muối béo mặn độc đáo trên nền cà phê phin đậm đặc' },
];

const toppings = [
  { name: 'Trân châu đen', price: 5000 },
  { name: 'Trân châu đường đen', price: 7000 },
  { name: 'Thạch củ năng', price: 6000 },
  { name: 'Thạch đen', price: 5000 },
  { name: 'Trân châu popping vị trái cây', price: 8000 },
  { name: 'Đậu đỏ', price: 7000 },
  { name: 'Oreo nghiền', price: 6000 },
  { name: 'Kem cheese', price: 10000 },
  { name: 'Thạch dừa', price: 5000 },
  { name: 'Pudding trứng', price: 8000 },
];

const promoCodes = [
  {
    code: 'BREW10',
    type: 'PERCENT' as const,
    value: 10,
    minOrderValue: 50000,
    maxDiscount: 30000,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2027-12-31T23:59:59Z'),
    usageLimit: null,
  },
  {
    code: 'GIAM15K',
    type: 'FIXED' as const,
    value: 15000,
    minOrderValue: 80000,
    maxDiscount: null,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2027-12-31T23:59:59Z'),
    usageLimit: 100,
  },
  {
    // mã đã hết hạn, để test lỗi PROMO_EXPIRED
    code: 'HETHAN',
    type: 'PERCENT' as const,
    value: 20,
    minOrderValue: 0,
    maxDiscount: null,
    startsAt: new Date('2025-01-01T00:00:00Z'),
    expiresAt: new Date('2025-12-31T23:59:59Z'),
    usageLimit: null,
  },
];

async function main() {
  console.log('Seeding BrewLite...');

  await prisma.orderItem.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.loyaltyTransaction.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.topping.deleteMany({});

  for (const p of products) {
    await prisma.product.create({ data: p });
  }
  for (const t of toppings) {
    await prisma.topping.create({ data: t });
  }
  for (const c of promoCodes) {
    await prisma.promoCode.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  const users = [
    { email: 'demo@brewlite.com', fullName: 'Khách Demo', password: 'Demo@1234', role: 'CUSTOMER' as const },
    { email: 'barista@brewlite.com', fullName: 'Barista Demo', password: 'Barista@123', role: 'BARISTA' as const },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash },
    });
  }

  console.log(
    `Done: ${products.length} sản phẩm, ${toppings.length} topping, ${promoCodes.length} mã giảm giá, ${users.length} tài khoản.`,
  );
  console.log('Tài khoản demo: demo@brewlite.com / Demo@1234, barista@brewlite.com / Barista@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
