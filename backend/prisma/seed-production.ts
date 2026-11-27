// ==============================================================================
// Script Nạp Dữ Liệu Production An Toàn (Non-Destructive Seed with Upsert)
// Mục đích: Thêm mới hoặc cập nhật sản phẩm, topping, nguyên liệu, công thức
//           HOÀN TOÀN KHÔNG XÓA (không dùng deleteMany) dữ liệu đơn hàng hay người dùng cũ.
// Cách chạy:
//   $env:DATABASE_URL="<External Database URL từ Render>"
//   npx tsx prisma/seed-production.ts
// ==============================================================================

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ LỖI: Biến môi trường DATABASE_URL chưa được thiết lập!');
  console.error('Vui lòng gán DATABASE_URL trước khi chạy, ví dụ:');
  console.error('  $env:DATABASE_URL="postgresql://user:pass@dpg-...singapore.render.com/brewlite"');
  process.exit(1);
}

// Ẩn mật khẩu khi in URL ra màn hình để bảo mật
const maskedUrl = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
console.log(`🔌 Đang kết nối tới Cơ sở dữ liệu: ${maskedUrl}`);

const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('@db:') || dbUrl.includes('@brewlite-a2-db:');
const adapter = new PrismaPg({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

// 1. Danh sách sản phẩm (20 món)
const products = [
  // Nhóm 1 — Trà sữa (6 món)
  { name: 'Trà Sữa Truyền Thống', price: 35000, category: 'Trà sữa', imageUrl: '/img/tra-sua-truyen-thong.jpg', description: 'Trà đen đậm đà kết hợp sữa thơm béo' },
  { name: 'Ô Long Sữa', price: 38000, category: 'Trà sữa', imageUrl: '/img/o-long-sua.jpg', description: 'Trà ô long thanh mát hòa quyện vị sữa béo ngậy' },
  { name: 'Trà Sữa Khoai Môn', price: 42000, category: 'Trà sữa', imageUrl: '/img/tra-sua-khoai-mon.jpg', description: 'Vị khoai môn bùi béo tự nhiên, màu tím bắt mắt' },
  { name: 'Trà Sữa Oreo Phô Mai', price: 45000, category: 'Trà sữa', imageUrl: '/img/tra-sua-oreo-pho-mai.jpg', description: 'Vụn bánh Oreo giòn tan kết hợp lớp kem phô mai béo ngậy' },
  { name: 'Trà Sữa Trân Châu Đen', price: 40000, category: 'Trà sữa', imageUrl: '/img/tra-sua-tran-chau-den.jpg', description: 'Trà sữa truyền thống kèm trân châu đen dẻo dai' },
  { name: 'Trà Sữa Trân Châu Đường Đen', price: 45000, category: 'Trà sữa', imageUrl: '/img/tra-sua-duong-den.jpg', description: 'Đường đen thơm lừng quyện cùng sữa tươi và trân châu' },

  // Nhóm 2 — Trà trái cây (5 món)
  { name: 'Trà Đào Cam Sả', price: 39000, category: 'Trà trái cây', imageUrl: '/img/tra-dao-cam-sa.jpg', description: 'Trà đen thanh mát kết hợp đào ngâm giòn, cam tươi và sả thơm' },
  { name: 'Trà Vải', price: 42000, category: 'Trà trái cây', imageUrl: '/img/tra-vai.jpg', description: 'Trà hoa nhài thanh khiết với trái vải mọng nước' },
  { name: 'Trà Chanh Dây', price: 35000, category: 'Trà trái cây', imageUrl: '/img/tra-chanh-day.jpg', description: 'Vị chua ngọt thanh mát giải nhiệt tức thì' },
  { name: 'Trà Dâu Tây', price: 42000, category: 'Trà trái cây', imageUrl: '/img/tra-dau-tay.jpg', description: 'Dâu tây tươi ngọt ngào hòa quyện cùng cốt trà hoa quả' },
  { name: 'Trà Xoài', price: 40000, category: 'Trà trái cây', imageUrl: '/img/tra-xoai.jpg', description: 'Thịt xoài chín thơm ngọt thanh mát trên nền trà xanh' },

  // Nhóm 3 — Trà nguyên vị và ô long (3 món)
  { name: 'Ô Long Sữa Nhài', price: 40000, category: 'Trà nguyên vị và ô long', imageUrl: '/img/o-long-sua-nhai.jpg', description: 'Hương hoa nhài thoang thoảng hòa cùng cốt trà ô long sữa' },
  { name: 'Ô Long Sữa Tươi Nướng', price: 45000, category: 'Trà nguyên vị và ô long', imageUrl: '/img/o-long-nuong.jpg', description: 'Vị trà nướng đậm đà đặc trưng kết hợp sữa tươi thanh trùng' },
  { name: 'Ô Long Sữa Tươi Xoài', price: 45000, category: 'Trà nguyên vị và ô long', imageUrl: '/img/o-long-xoai.jpg', description: 'Trà ô long sữa thơm ngậy kết hợp mứt xoài ngọt dịu' },

  // Nhóm 4 — Matcha (3 món)
  { name: 'Matcha Latte', price: 48000, category: 'Matcha', imageUrl: '/img/matcha-latte.jpg', description: 'Bột trà xanh Nhật Bản nguyên chất hòa cùng sữa tươi' },
  { name: 'Matcha Sữa Dâu', price: 50000, category: 'Matcha', imageUrl: '/img/matcha-sua-dau.jpg', description: 'Hai tầng đẹp mắt: mứt dâu tây chua ngọt và matcha thơm đậm' },
  { name: 'Matcha Đậu Đỏ', price: 52000, category: 'Matcha', imageUrl: '/img/matcha-dau-do.jpg', description: 'Matcha đậm vị kết hợp topping đậu đỏ bùi ngọt truyền thống' },

  // Nhóm 5 — Cà phê và món đặc biệt (3 món)
  { name: 'Cà Phê Sữa', price: 35000, category: 'Cà phê và món đặc biệt', imageUrl: '/img/ca-phe-sua.jpg', description: 'Cà phê phin truyền thống pha sữa đặc đậm đà' },
  { name: 'Bạc Xỉu', price: 38000, category: 'Cà phê và món đặc biệt', imageUrl: '/img/bac-xiu.jpg', description: 'Nhiều sữa ít cà phê, ngọt béo thơm lừng' },
  { name: 'Cà Phê Muối', price: 42000, category: 'Cà phê và món đặc biệt', imageUrl: '/img/ca-phe-muoi.jpg', description: 'Lớp kem muối béo mặn độc đáo trên nền cà phê phin đậm đặc' },
];

// 2. Danh sách Topping (10 loại)
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

// 3. Danh sách Nguyên liệu tồn kho ban đầu (22 loại)
const ingredientsData: { name: string; unit: 'G' | 'ML' | 'PCS'; stock: number; lowThreshold: number }[] = [
  { name: 'Cốt trà đen đã pha', unit: 'ML', stock: 5000, lowThreshold: 300 },
  { name: 'Cốt trà ô long đã pha', unit: 'ML', stock: 5000, lowThreshold: 300 },
  { name: 'Cốt trà xanh đã pha', unit: 'ML', stock: 3000, lowThreshold: 200 },
  { name: 'Cốt trà hoa nhài đã pha', unit: 'ML', stock: 3000, lowThreshold: 200 },
  { name: 'Sữa tươi', unit: 'ML', stock: 10000, lowThreshold: 400 },
  { name: 'Bột kem béo', unit: 'G', stock: 2000, lowThreshold: 100 },
  { name: 'Sữa đặc', unit: 'G', stock: 2000, lowThreshold: 120 },
  { name: 'Đường nước / syrup đường', unit: 'ML', stock: 3000, lowThreshold: 200 },
  { name: 'Bột khoai môn', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Bánh Oreo nghiền', unit: 'G', stock: 1000, lowThreshold: 80 },
  { name: 'Kem cheese', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Trân châu đen đã nấu', unit: 'G', stock: 2500, lowThreshold: 200 },
  { name: 'Trân châu đường đen đã nấu', unit: 'G', stock: 2000, lowThreshold: 150 },
  { name: 'Syrup đường đen', unit: 'ML', stock: 1500, lowThreshold: 100 },
  { name: 'Đào ngâm', unit: 'G', stock: 2000, lowThreshold: 100 },
  { name: 'Cam tươi', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Sả', unit: 'G', stock: 500, lowThreshold: 50 },
  { name: 'Vải ngâm', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Syrup chanh dây', unit: 'ML', stock: 1500, lowThreshold: 100 },
  { name: 'Dâu tây / puree dâu', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Xoài / puree xoài', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Bột matcha', unit: 'G', stock: 1000, lowThreshold: 50 },
  { name: 'Đậu đỏ đã nấu', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Cà phê espresso/phin đã pha', unit: 'ML', stock: 3000, lowThreshold: 150 },
  { name: 'Muối', unit: 'G', stock: 500, lowThreshold: 20 },
  { name: 'Kem nền / whipping cream', unit: 'ML', stock: 1500, lowThreshold: 100 },
  { name: 'Thạch củ năng đã chuẩn bị', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Thạch đen đã chuẩn bị', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Trân châu popping', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Thạch dừa', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Pudding trứng', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Mứt dâu', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Mứt xoài', unit: 'G', stock: 1500, lowThreshold: 100 },
  { name: 'Nước lọc', unit: 'ML', stock: 10000, lowThreshold: 500 },
];

// 4. Định nghĩa công thức món (Product Recipes)
const productRecipeDefinitions: Record<string, { ingredient: string; quantity: number }[]> = {
  'Trà Sữa Truyền Thống': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 150 },
    { ingredient: 'Sữa tươi', quantity: 120 },
    { ingredient: 'Bột kem béo', quantity: 20 },
    { ingredient: 'Đường nước / syrup đường', quantity: 20 },
  ],
  'Ô Long Sữa': [
    { ingredient: 'Cốt trà ô long đã pha', quantity: 180 },
    { ingredient: 'Sữa tươi', quantity: 100 },
    { ingredient: 'Bột kem béo', quantity: 15 },
    { ingredient: 'Đường nước / syrup đường', quantity: 20 },
  ],
  'Trà Sữa Khoai Môn': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 130 },
    { ingredient: 'Sữa tươi', quantity: 100 },
    { ingredient: 'Bột khoai môn', quantity: 25 },
    { ingredient: 'Bột kem béo', quantity: 15 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Trà Sữa Oreo Phô Mai': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 130 },
    { ingredient: 'Sữa tươi', quantity: 100 },
    { ingredient: 'Bột kem béo', quantity: 15 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
    { ingredient: 'Bánh Oreo nghiền', quantity: 10 },
    { ingredient: 'Kem cheese', quantity: 30 },
  ],
  'Trà Sữa Trân Châu Đen': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 150 },
    { ingredient: 'Sữa tươi', quantity: 120 },
    { ingredient: 'Bột kem béo', quantity: 20 },
    { ingredient: 'Đường nước / syrup đường', quantity: 20 },
    { ingredient: 'Trân châu đen đã nấu', quantity: 40 },
  ],
  'Trà Sữa Trân Châu Đường Đen': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 140 },
    { ingredient: 'Sữa tươi', quantity: 120 },
    { ingredient: 'Bột kem béo', quantity: 15 },
    { ingredient: 'Syrup đường đen', quantity: 20 },
    { ingredient: 'Trân châu đường đen đã nấu', quantity: 40 },
  ],
  'Trà Đào Cam Sả': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 200 },
    { ingredient: 'Đào ngâm', quantity: 40 },
    { ingredient: 'Cam tươi', quantity: 30 },
    { ingredient: 'Sả', quantity: 5 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Trà Vải': [
    { ingredient: 'Cốt trà hoa nhài đã pha', quantity: 200 },
    { ingredient: 'Vải ngâm', quantity: 40 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Trà Chanh Dây': [
    { ingredient: 'Cốt trà đen đã pha', quantity: 180 },
    { ingredient: 'Syrup chanh dây', quantity: 30 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Trà Dâu Tây': [
    { ingredient: 'Cốt trà hoa nhài đã pha', quantity: 180 },
    { ingredient: 'Dâu tây / puree dâu', quantity: 40 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Trà Xoài': [
    { ingredient: 'Cốt trà xanh đã pha', quantity: 180 },
    { ingredient: 'Xoài / puree xoài', quantity: 50 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Ô Long Sữa Nhài': [
    { ingredient: 'Cốt trà ô long đã pha', quantity: 140 },
    { ingredient: 'Cốt trà hoa nhài đã pha', quantity: 40 },
    { ingredient: 'Sữa tươi', quantity: 100 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Ô Long Sữa Tươi Nướng': [
    { ingredient: 'Cốt trà ô long đã pha', quantity: 160 },
    { ingredient: 'Sữa tươi', quantity: 120 },
    { ingredient: 'Bột kem béo', quantity: 10 },
  ],
  'Ô Long Sữa Tươi Xoài': [
    { ingredient: 'Cốt trà ô long đã pha', quantity: 150 },
    { ingredient: 'Sữa tươi', quantity: 100 },
    { ingredient: 'Mứt xoài', quantity: 35 },
    { ingredient: 'Đường nước / syrup đường', quantity: 10 },
  ],
  'Matcha Latte': [
    { ingredient: 'Sữa tươi', quantity: 220 },
    { ingredient: 'Bột matcha', quantity: 4 },
    { ingredient: 'Đường nước / syrup đường', quantity: 15 },
  ],
  'Matcha Sữa Dâu': [
    { ingredient: 'Sữa tươi', quantity: 200 },
    { ingredient: 'Bột matcha', quantity: 4 },
    { ingredient: 'Mứt dâu', quantity: 35 },
  ],
  'Matcha Đậu Đỏ': [
    { ingredient: 'Sữa tươi', quantity: 200 },
    { ingredient: 'Bột matcha', quantity: 4 },
    { ingredient: 'Đậu đỏ đã nấu', quantity: 40 },
  ],
  'Cà Phê Sữa': [
    { ingredient: 'Cà phê espresso/phin đã pha', quantity: 50 },
    { ingredient: 'Sữa đặc', quantity: 35 },
    { ingredient: 'Nước lọc', quantity: 30 },
  ],
  'Bạc Xỉu': [
    { ingredient: 'Cà phê espresso/phin đã pha', quantity: 30 },
    { ingredient: 'Sữa tươi', quantity: 150 },
    { ingredient: 'Sữa đặc', quantity: 25 },
  ],
  'Cà Phê Muối': [
    { ingredient: 'Cà phê espresso/phin đã pha', quantity: 50 },
    { ingredient: 'Sữa đặc', quantity: 20 },
    { ingredient: 'Kem nền / whipping cream', quantity: 30 },
    { ingredient: 'Muối', quantity: 1 },
  ],
};

// 5. Định nghĩa công thức Topping
const toppingRecipeDefinitions: Record<string, { ingredient: string; quantity: number }[]> = {
  'Trân châu đen': [{ ingredient: 'Trân châu đen đã nấu', quantity: 40 }],
  'Trân châu đường đen': [
    { ingredient: 'Trân châu đường đen đã nấu', quantity: 40 },
    { ingredient: 'Syrup đường đen', quantity: 10 },
  ],
  'Thạch củ năng': [{ ingredient: 'Thạch củ năng đã chuẩn bị', quantity: 40 }],
  'Thạch đen': [{ ingredient: 'Thạch đen đã chuẩn bị', quantity: 40 }],
  'Trân châu popping vị trái cây': [{ ingredient: 'Trân châu popping', quantity: 40 }],
  'Đậu đỏ': [{ ingredient: 'Đậu đỏ đã nấu', quantity: 40 }],
  'Oreo nghiền': [{ ingredient: 'Bánh Oreo nghiền', quantity: 15 }],
  'Kem cheese': [{ ingredient: 'Kem cheese', quantity: 30 }],
  'Thạch dừa': [{ ingredient: 'Thạch dừa', quantity: 40 }],
  'Pudding trứng': [{ ingredient: 'Pudding trứng', quantity: 40 }],
};

// 6. Mã giảm giá mẫu
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
    code: 'FREESHIP',
    type: 'FIXED' as const,
    value: 20000,
    minOrderValue: 100000,
    maxDiscount: null,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2027-12-31T23:59:59Z'),
    usageLimit: 50,
  },
];

async function main() {
  console.log('🚀 Bắt đầu quá trình nạp dữ liệu Production an toàn (UPSERT ONLY)...');

  // 1. Upsert Products
  console.log('📦 1/6: Đang nạp danh mục sản phẩm...');
  const productMap = new Map<string, number>();
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { name: p.name },
      update: {
        price: p.price,
        category: p.category,
        imageUrl: p.imageUrl,
        description: p.description,
        isActive: true,
      },
      create: p,
    });
    productMap.set(prod.name, prod.id);
  }
  console.log(`    Đã nạp ${productMap.size} sản phẩm.`);

  // 2. Upsert Toppings
  console.log('🧋 2/6: Đang nạp danh mục topping...');
  const toppingMap = new Map<string, number>();
  for (const t of toppings) {
    const top = await prisma.topping.upsert({
      where: { name: t.name },
      update: {
        price: t.price,
        isActive: true,
      },
      create: t,
    });
    toppingMap.set(top.name, top.id);
  }
  console.log(`    Đã nạp ${toppingMap.size} topping.`);

  // 3. Upsert Ingredients
  console.log('🌾 3/6: Đang nạp kho nguyên liệu...');
  const ingredientMap = new Map<string, number>();
  for (const ing of ingredientsData) {
    const existing = await prisma.ingredient.findUnique({ where: { name: ing.name } });
    let ingredientId: number;

    if (existing) {
      // Nếu nguyên liệu đã có, chỉ cập nhật threshold & unit, KHÔNG ghi đè tồn kho đang hoạt động
      const updated = await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          unit: ing.unit,
          lowThreshold: ing.lowThreshold,
        },
      });
      ingredientId = updated.id;
    } else {
      // Nếu nguyên liệu mới tạo, khởi tạo tồn kho
      const created = await prisma.ingredient.create({
        data: {
          name: ing.name,
          unit: ing.unit,
          stock: ing.stock,
          lowThreshold: ing.lowThreshold,
          version: 0,
        },
      });
      ingredientId = created.id;

      // Ghi nhận log nhập kho ban đầu
      await prisma.stockMovement.create({
        data: {
          ingredientId: created.id,
          type: 'RESTOCK',
          quantity: ing.stock,
          reason: 'Khởi tạo tồn kho ban đầu',
        },
      });
    }
    ingredientMap.set(ing.name, ingredientId);
  }
  console.log(`    Đã nạp ${ingredientMap.size} nguyên liệu.`);

  // 4. Upsert Product Recipes
  console.log('📖 4/6: Đang nạp công thức sản phẩm...');
  let productRecipeCount = 0;
  for (const [productName, items] of Object.entries(productRecipeDefinitions)) {
    const productId = productMap.get(productName);
    if (!productId) continue;

    for (const item of items) {
      const ingredientId = ingredientMap.get(item.ingredient);
      if (!ingredientId) continue;

      await prisma.productRecipe.upsert({
        where: {
          productId_ingredientId: { productId, ingredientId },
        },
        update: {
          quantity: item.quantity,
        },
        create: {
          productId,
          ingredientId,
          quantity: item.quantity,
        },
      });
      productRecipeCount++;
    }
  }
  console.log(`    Đã nạp ${productRecipeCount} định lượng công thức món.`);

  // 5. Upsert Topping Recipes
  console.log('🍒 5/6: Đang nạp công thức topping...');
  let toppingRecipeCount = 0;
  for (const [toppingName, items] of Object.entries(toppingRecipeDefinitions)) {
    const toppingId = toppingMap.get(toppingName);
    if (!toppingId) continue;

    for (const item of items) {
      const ingredientId = ingredientMap.get(item.ingredient);
      if (!ingredientId) continue;

      await prisma.toppingRecipe.upsert({
        where: {
          toppingId_ingredientId: { toppingId, ingredientId },
        },
        update: {
          quantity: item.quantity,
        },
        create: {
          toppingId,
          ingredientId,
          quantity: item.quantity,
        },
      });
      toppingRecipeCount++;
    }
  }
  console.log(`    Đã nạp ${toppingRecipeCount} định lượng công thức topping.`);

  // 6. Upsert PromoCodes & Demo Accounts
  console.log('🎟️ 6/6: Đang nạp mã giảm giá và tài khoản mẫu...');
  for (const c of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: c.code },
      update: {
        value: c.value,
        type: c.type,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        isActive: true,
      },
      create: c,
    });
  }

  const users = [
    { email: 'demo@brewlite.com', fullName: 'Khách Hàng Demo', password: 'Demo@1234', role: 'CUSTOMER' as const },
    { email: 'barista@brewlite.com', fullName: 'Barista Quầy', password: 'Barista@123', role: 'BARISTA' as const },
    { email: 'manager@brewlite.com', fullName: 'Quản Lý Kho', password: 'Manager@123', role: 'MANAGER' as const },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
      },
      create: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        passwordHash,
      },
    });
  }

  // Đồng bộ lại PostgreSQL sequence của các bảng để tránh lỗi P2002 duplicate key
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 1), (SELECT COUNT(*) > 0 FROM "Product"))`
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Topping"', 'id'), COALESCE((SELECT MAX(id) FROM "Topping"), 1), (SELECT COUNT(*) > 0 FROM "Topping"))`
    );
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Order"', 'id'), COALESCE((SELECT MAX(id) FROM "Order"), 1), (SELECT COUNT(*) > 0 FROM "Order"))`
    );
  } catch (err) {
    // Sequence sync có thể bỏ qua nếu bảng chưa có dữ liệu
  }

  console.log('\n🎉 ========================================================');
  console.log(' NẠP DỮ LIỆU PRODUCTION THÀNH CÔNG!');
  console.log(' - Dữ liệu cũ, đơn hàng và lịch sử thanh toán được bảo toàn 100%.');
  console.log(' - Tài khoản đăng nhập kiểm thử:');
  console.log('   * Khách hàng: demo@brewlite.com | Mật khẩu: Demo@1234');
  console.log('   * Nhân viên Barista: barista@brewlite.com | Mật khẩu: Barista@123');
  console.log('========================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nạp dữ liệu:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

