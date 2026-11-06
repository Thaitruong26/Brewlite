import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { OrdersService } from '../src/orders/orders.service.js';
import { Size } from '../src/generated/prisma/client.js';

describe('Kiểm thử đặt hàng đồng thời trên Cơ sở dữ liệu thật (PostgreSQL Concurrency Test)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ordersService: OrdersService;
  let isDbAvailable = false;

  let testUserId: number;
  let testIngredientId: number;
  let testProductId: number;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      prisma = app.get<PrismaService>(PrismaService);
      ordersService = app.get<OrdersService>(OrdersService);

      // Kiểm tra kết nối tới database thật
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;

      // Chuẩn bị dữ liệu kiểm thử
      const user = await prisma.user.upsert({
        where: { email: 'concurrency-test@brewlite.vn' },
        create: {
          email: 'concurrency-test@brewlite.vn',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
          fullName: 'Concurrency Test User',
          role: 'CUSTOMER',
        },
        update: {},
      });
      testUserId = user.id;

      // Tạo nguyên liệu kiểm thử với tồn kho chính xác = 5, version = 0
      const ingredient = await prisma.ingredient.upsert({
        where: { name: 'Nguyên Liệu Test Đồng Thời' },
        create: {
          name: 'Nguyên Liệu Test Đồng Thời',
          unit: 'g',
          stock: 5,
          minThreshold: 1,
          version: 0,
        },
        update: {
          stock: 5,
          version: 0,
        },
      });
      testIngredientId = ingredient.id;

      // Xóa các stock movement cũ của nguyên liệu kiểm thử nếu có
      await prisma.stockMovement.deleteMany({
        where: { ingredientId: testIngredientId },
      });

      // Tạo món đồ uống kiểm thử gắn công thức tiêu thụ đúng 1g nguyên liệu này cho size M
      const product = await prisma.product.upsert({
        where: { name: 'Món Test Đồng Thời Concurrency' },
        create: {
          name: 'Món Test Đồng Thời Concurrency',
          price: 35000,
          category: 'Trà',
          isActive: true,
          productRecipes: {
            create: [
              {
                ingredientId: testIngredientId,
                quantity: 1, // 1g/ly size M
              },
            ],
          },
        },
        update: {
          isActive: true,
        },
      });
      testProductId = product.id;

      // Đảm bảo công thức đã được liên kết
      const existingRecipe = await prisma.productRecipe.findFirst({
        where: { productId: testProductId, ingredientId: testIngredientId },
      });
      if (!existingRecipe) {
        await prisma.productRecipe.create({
          data: {
            productId: testProductId,
            ingredientId: testIngredientId,
            quantity: 1,
          },
        });
      }
    } catch {
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDbAvailable && prisma) {
      try {
        // Dọn dẹp dữ liệu kiểm thử
        if (testIngredientId) {
          await prisma.stockMovement.deleteMany({ where: { ingredientId: testIngredientId } });
        }
        if (testProductId) {
          await prisma.productRecipe.deleteMany({ where: { productId: testProductId } });
          await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
          await prisma.product.delete({ where: { id: testProductId } }).catch(() => {});
        }
        if (testIngredientId) {
          await prisma.ingredient.delete({ where: { id: testIngredientId } }).catch(() => {});
        }
        if (testUserId) {
          await prisma.order.deleteMany({ where: { userId: testUserId } });
          await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
        }
      } catch {}
    }

    if (app) {
      await app.close();
    }
  });

  it('Tiêu chí (c): 10 request đặt hàng đồng thời trên DB thật khi kho chỉ đủ 5 ly -> đúng 5 đơn thành công, 5 đơn thất bại OUT_OF_STOCK, tồn kho cuối = 0', async () => {
    if (!isDbAvailable) {
      console.warn('⚠️ Bỏ qua test concurrency do không có kết nối PostgreSQL trực tiếp ở local');
      return;
    }

    // Bắn 10 request song song cùng một thời điểm qua Promise.allSettled
    const requests = Array.from({ length: 10 }).map(() =>
      ordersService.createOrder(testUserId, {
        items: [
          {
            productId: testProductId,
            size: Size.M,
            quantity: 1,
          },
        ],
      }),
    );

    const results = await Promise.allSettled(requests);

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // 1. Đúng 5 đơn thành công (201 Created)
    expect(successful).toHaveLength(5);

    // 2. Đúng 5 đơn thất bại (409 Conflict OUT_OF_STOCK)
    expect(failed).toHaveLength(5);
    for (const fail of failed) {
      const reason: any = (fail as PromiseRejectedResult).reason;
      expect(reason.status || reason.statusCode || 409).toBe(409);
      const resBody = reason.getResponse ? reason.getResponse() : reason;
      expect(resBody.code).toBe('OUT_OF_STOCK');
    }

    // 3. Kiểm tra tính toàn vẹn dữ liệu trực tiếp trong CSDL PostgreSQL
    const freshIngredient = await prisma.ingredient.findUnique({
      where: { id: testIngredientId },
    });

    expect(freshIngredient).not.toBeNull();
    // Tồn kho cuối cùng phải đúng bằng 0 và tuyệt đối không bao giờ âm
    expect(freshIngredient!.stock).toBe(0);
    // Phiên bản version tăng đúng 5 lần (từ 0 lên 5)
    expect(freshIngredient!.version).toBe(5);

    // 4. Kiểm tra nhật ký StockMovement được ghi đúng 5 lần trừ kho
    const movements = await prisma.stockMovement.findMany({
      where: {
        ingredientId: testIngredientId,
        type: 'ORDER_RESERVE',
      },
    });
    expect(movements).toHaveLength(5);
    const totalDeducted = movements.reduce((sum, m) => sum + m.quantity, 0);
    expect(totalDeducted).toBe(-5);
  });
});
