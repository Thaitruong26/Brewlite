import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrderStatus, Role, Size } from '../generated/prisma/client.js';
import { RecipeService } from '../common/recipe/recipe.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaMock: any;
  let pricingServiceMock: any;
  let recipeService: RecipeService;

  beforeEach(() => {
    recipeService = new RecipeService();

    prismaMock = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      topping: {
        findMany: vi.fn(),
      },
      ingredient: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      stockMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      promoCode: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      order: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      loyaltyTransaction: {
        updateMany: vi.fn(),
      },
      payment: {
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    pricingServiceMock = {
      calculate: vi.fn().mockResolvedValue({
        lines: [
          {
            productId: 1,
            productName: 'Cà phê sữa',
            size: Size.M,
            toppings: [{ id: 1, name: 'Trân châu', price: 5000 }],
            unitPrice: 45000,
            qty: 2,
            lineTotal: 90000,
            note: 'ít đá',
          },
        ],
        subtotal: 90000,
      }),
      pointsFor: vi.fn().mockReturnValue(90),
    };

    service = new OrdersService(prismaMock, pricingServiceMock, recipeService);
  });

  describe('createOrder (Kho theo nguyên liệu & optimistic locking)', () => {
    it('áp dụng điểm thưởng khi usePoints = true và trừ loyaltyPoints của user', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê sữa',
          isActive: true,
          productRecipes: [{ ingredientId: 10, quantity: 50 }],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);
      prismaMock.ingredient.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 10) return { id: 10, name: 'Cà phê', stock: 1000, version: 0 };
        return null;
      });
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.stockMovement.create.mockResolvedValue({});

      // User có 1000 điểm (= 10.000đ)
      prismaMock.user.findUnique.mockResolvedValue({ loyaltyPoints: 1000 });
      prismaMock.user.update.mockResolvedValue({});

      prismaMock.order.create.mockResolvedValue({
        id: 99,
        userId: 1,
        status: OrderStatus.PENDING,
        subtotal: 90000,
        discountAmount: 10000,
        total: 80000,
        promoCode: null,
        pointsEarned: 0,
        pointsUsed: 1000,
        items: [
          {
            productId: 1,
            productName: 'Cà phê sữa',
            size: Size.M,
            toppings: [],
            unitPrice: 45000,
            qty: 2,
            lineTotal: 90000,
          },
        ],
        createdAt: new Date(),
      });

      const res = await service.createOrder(1, {
        items: [{ productId: 1, size: Size.M, quantity: 2 }],
        usePoints: true,
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { loyaltyPoints: true },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { loyaltyPoints: { decrement: 1000 } },
      });
      expect(res.discountAmount).toBe(10000);
      expect(res.total).toBe(80000);
      expect(res.pointsUsed).toBe(1000);
    });

    it('tạo đơn thành công khi còn tồn nguyên liệu, ghi StockMovement ORDER_RESERVE và lưu consumption', async () => {
      // Mock sản phẩm có công thức
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê sữa',
          isActive: true,
          productRecipes: [
            { ingredientId: 10, quantity: 50 }, // Cà phê: 50ml/ly
            { ingredientId: 20, quantity: 30 }, // Sữa đặc: 30g/ly
          ],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      // Mock tồn kho nguyên liệu dồi dào
      prismaMock.ingredient.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 10) return { id: 10, name: 'Cà phê', stock: 1000, version: 0 };
        if (where.id === 20) return { id: 20, name: 'Sữa đặc', stock: 500, version: 0 };
        return null;
      });
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });

      // Mock Order.create
      prismaMock.order.create.mockImplementation(async ({ data }: any) => ({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        items: data.items.create,
      }));

      const res = await service.createOrder(1, {
        items: [{ productId: 1, size: Size.M, quantity: 2 }],
      });

      expect(pricingServiceMock.calculate).toHaveBeenCalled();
      // Kiểm tra trừ kho nguyên liệu: 2 ly size M -> Cà phê 100ml, Sữa đặc 60g
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 10, version: 0, stock: { gte: 100 } },
        data: { stock: { decrement: 100 }, version: { increment: 1 } },
      });
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 20, version: 0, stock: { gte: 60 } },
        data: { stock: { decrement: 60 }, version: { increment: 1 } },
      });

      // Kiểm tra ghi StockMovement ORDER_RESERVE
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 10,
          type: 'ORDER_RESERVE',
          quantity: -100,
          orderId: 101,
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 20,
          type: 'ORDER_RESERVE',
          quantity: -60,
          orderId: 101,
        },
      });

      expect(res.id).toBe(101);
      expect(res.status).toBe(OrderStatus.PENDING);
    });

    it('báo lỗi 409 RECIPE_MISSING khi sản phẩm chưa có công thức', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 99,
          name: 'Món mới',
          isActive: true,
          productRecipes: [], // Chưa có công thức
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder(1, {
          items: [{ productId: 99, size: Size.M, quantity: 1 }],
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.createOrder(1, {
          items: [{ productId: 99, size: Size.M, quantity: 1 }],
        });
      } catch (err: any) {
        expect(err.getResponse().code).toBe('RECIPE_MISSING');
        expect(err.getResponse().details[0].productId).toBe(99);
      }
    });

    it('báo lỗi 409 OUT_OF_STOCK với details chi tiết khi tồn kho nguyên liệu không đủ', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê muối',
          isActive: true,
          productRecipes: [{ ingredientId: 2, quantity: 1 }], // Cần 1g muối/ly
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      // Tồn muối chỉ còn 1g nhưng khách đặt 2 ly
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 2,
        name: 'Muối',
        stock: 1,
        version: 0,
      });

      try {
        await service.createOrder(1, {
          items: [{ productId: 1, size: Size.M, quantity: 2 }],
        });
        expect.unreachable('Cần ném OUT_OF_STOCK');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const resp = err.getResponse();
        expect(resp.code).toBe('OUT_OF_STOCK');
        expect(resp.details[0]).toEqual({
          ingredientId: 2,
          ingredient: 'Muối',
          available: 1,
          required: 2,
          products: ['Cà phê muối'],
        });
      }
    });

    it('tiêu chí (c): đặt đồng thời 10 đơn khi nguyên liệu chỉ đủ 5 ly -> đúng 5 đơn thành công, 5 thất bại, tồn cuối = 0', async () => {
      // Giả lập nguyên liệu Muối (id: 2) chỉ còn 5g, mỗi ly size M tốn 1g -> đúng 5 ly
      let currentStock = 5;
      let currentVersion = 0;
      const movements: any[] = [];

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê muối',
          isActive: true,
          productRecipes: [{ ingredientId: 2, quantity: 1 }],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      prismaMock.ingredient.findUnique.mockImplementation(async () => ({
        id: 2,
        name: 'Muối',
        stock: currentStock,
        version: currentVersion,
      }));

      prismaMock.ingredient.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.version === currentVersion && currentStock >= where.stock.gte) {
          currentStock -= data.stock.decrement;
          currentVersion += data.version.increment;
          return { count: 1 };
        }
        return { count: 0 };
      });

      prismaMock.stockMovement.create.mockImplementation(async ({ data }: any) => {
        movements.push(data);
        return { id: movements.length, ...data };
      });

      prismaMock.order.create.mockImplementation(async ({ data }: any) => ({
        id: Math.floor(Math.random() * 1000) + 1,
        ...data,
        createdAt: new Date(),
        items: [{ qty: 1 }],
      }));

      // Bắn 10 request đồng thời qua Promise.allSettled
      const results = await Promise.allSettled(
        Array.from({ length: 10 }).map((_, i) =>
          service.createOrder(i + 1, {
            items: [{ productId: 1, size: Size.M, quantity: 1 }],
          }),
        ),
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Đúng 5 đơn thành công
      expect(successful).toHaveLength(5);
      // 5 đơn thất bại OUT_OF_STOCK
      expect(failed).toHaveLength(5);
      // Tồn kho cuối cùng đúng bằng 0
      expect(currentStock).toBe(0);
      expect(currentVersion).toBe(5);

      // Bất biến: tồn kho ban đầu (5) + tổng các StockMovement (-1 * 5) = tồn kho cuối (0)
      const totalMoved = movements.reduce((sum, m) => sum + m.quantity, 0);
      expect(5 + totalMoved).toBe(currentStock);
    });

    it('gộp theo nguyên liệu: hai món cùng dùng sữa, tổng nhu cầu vượt tồn kho thì từ chối cả đơn', async () => {
      // Món A cần 100ml sữa, Món B cần 120ml sữa -> tổng 220ml
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Trà Sữa A',
          isActive: true,
          productRecipes: [{ ingredientId: 5, quantity: 100 }],
        },
        {
          id: 2,
          name: 'Trà Sữa B',
          isActive: true,
          productRecipes: [{ ingredientId: 5, quantity: 120 }],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      // Sữa chỉ còn 200ml (đủ cho từng món riêng lẻ nhưng không đủ cho cả đơn 220ml)
      prismaMock.ingredient.findUnique.mockResolvedValue({
        id: 5,
        name: 'Sữa tươi',
        stock: 200,
        version: 0,
      });

      await expect(
        service.createOrder(1, {
          items: [
            { productId: 1, size: Size.M, quantity: 1 },
            { productId: 2, size: Size.M, quantity: 1 },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rollback: món cần hai nguyên liệu, một cái hết thì nguyên liệu còn lại không bị trừ', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Cà phê muối',
          isActive: true,
          productRecipes: [
            { ingredientId: 10, quantity: 50 }, // Cà phê: còn nhiều
            { ingredientId: 20, quantity: 1 }, // Muối: đã hết
          ],
        },
      ]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      prismaMock.ingredient.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 10) return { id: 10, name: 'Cà phê', stock: 1000, version: 0 };
        if (where.id === 20) return { id: 20, name: 'Muối', stock: 0, version: 0 };
        return null;
      });
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.createOrder(1, {
          items: [{ productId: 1, size: Size.M, quantity: 1 }],
        }),
      ).rejects.toThrow(ConflictException);

      // Vì giao dịch thất bại trước khi trừ hoặc trong transaction bị rollback, không tạo order
      expect(prismaMock.order.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder (Hoàn kho theo snapshot OrderItem.consumption)', () => {
    it('hoàn kho đúng theo snapshot consumption, không phụ thuộc vào công thức hiện tại', async () => {
      // Đơn hàng có snapshot lúc đặt tiêu thụ 120ml sữa (id: 5) và 40g trân châu (id: 12)
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        items: [
          {
            productId: 1,
            qty: 1,
            consumption: [
              { ingredientId: 5, quantity: 120 },
              { ingredientId: 12, quantity: 40 },
            ],
          },
        ],
        payments: [],
      });

      prismaMock.order.update.mockResolvedValue({
        id: 101,
        status: OrderStatus.CANCELLED,
      });

      const res = await service.cancelOrder(101, { id: 1, role: Role.CUSTOMER });

      // Hoàn lại nguyên liệu theo consumption
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { stock: { increment: 120 }, version: { increment: 1 } },
      });
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: { stock: { increment: 40 }, version: { increment: 1 } },
      });

      // Ghi StockMovement ORDER_RELEASE (+)
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 5,
          type: 'ORDER_RELEASE',
          quantity: 120,
          orderId: 101,
        },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 12,
          type: 'ORDER_RELEASE',
          quantity: 40,
          orderId: 101,
        },
      });

      expect(res.status).toBe(OrderStatus.CANCELLED);
    });

    it('chặn hủy đơn khi đơn đã sang PREPARING', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PREPARING,
        items: [],
        payments: [],
      });

      await expect(
        service.cancelOrder(101, { id: 1, role: Role.CUSTOMER }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getOrdersMe (Task 9)', () => {
    it('trả về danh sách đơn của user kèm itemCount và phân trang', async () => {
      prismaMock.order.count.mockResolvedValue(1);
      prismaMock.order.findMany.mockResolvedValue([
        {
          id: 101,
          status: OrderStatus.PAID,
          total: 90000,
          createdAt: new Date('2026-10-26T10:00:00.000Z'),
          items: [{ qty: 2 }, { qty: 1 }],
        },
      ]);

      const res = await service.getOrdersMe(1, { page: 1, limit: 10 });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
          skip: 0,
          take: 10,
        }),
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0].code).toBe('#101');
      expect(res.data[0].itemCount).toBe(3); // 2 + 1 = 3 ly
      expect(res.meta.total).toBe(1);
    });
  });

  describe('getOrderById (Task 9)', () => {
    it('trả về chi tiết đơn hàng cho chính chủ', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PAID,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        pointsEarned: 90,
        items: [],
        payments: [],
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        updatedAt: new Date('2026-10-26T10:05:00.000Z'),
      });

      const res = await service.getOrderById(101, { id: 1, role: Role.CUSTOMER });
      expect(res.id).toBe(101);
      expect(res.code).toBe('#101');
    });

    it('Barista có quyền xem đơn hàng của bất kỳ ai', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 2,
        status: OrderStatus.PAID,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        pointsEarned: 90,
        items: [],
        payments: [],
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        updatedAt: new Date('2026-10-26T10:05:00.000Z'),
      });

      const res = await service.getOrderById(101, { id: 1, role: Role.BARISTA });
      expect(res.id).toBe(101);
    });

    it('ném 404 khi không tìm thấy đơn hàng', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById(999, { id: 1, role: Role.CUSTOMER }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrderStatus (Task 10 / Barista)', () => {
    it('Barista chuyển bước thành công PAID → PREPARING', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        status: OrderStatus.PAID,
      });
      prismaMock.order.update.mockResolvedValue({
        id: 101,
        status: OrderStatus.PREPARING,
      });

      const res = await service.updateOrderStatus(101, OrderStatus.PREPARING, {
        id: 2,
        role: Role.BARISTA,
      });

      expect(res.status).toBe(OrderStatus.PREPARING);
    });

    it('từ chối nếu user không phải Barista', async () => {
      await expect(
        service.updateOrderStatus(101, OrderStatus.PREPARING, {
          id: 1,
          role: Role.CUSTOMER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancelExpiredOrders (Hạn thanh toán 15 phút)', () => {
    it('quét các đơn PENDING quá 15 phút, hoàn kho nguyên liệu và đổi sang CANCELLED', async () => {
      const pastDate = new Date(Date.now() - 20 * 60 * 1000); // 20 phút trước
      const expiredOrder = {
        id: 201,
        userId: 1,
        status: OrderStatus.PENDING,
        promoCode: 'GIAM10',
        items: [
          {
            id: 1,
            productId: 1,
            consumption: [{ ingredientId: 10, quantity: 50 }],
          },
        ],
        payments: [],
        createdAt: pastDate,
      };

      prismaMock.order.findMany.mockResolvedValue([expiredOrder]);
      prismaMock.order.findUnique.mockResolvedValue(expiredOrder);
      prismaMock.ingredient.update.mockResolvedValue({});
      prismaMock.stockMovement.create.mockResolvedValue({});
      prismaMock.promoCode.update.mockResolvedValue({});
      prismaMock.order.update.mockResolvedValue({ ...expiredOrder, status: OrderStatus.CANCELLED });

      const count = await service.cancelExpiredOrders();

      expect(count).toBe(1);
      expect(prismaMock.order.findMany).toHaveBeenCalled();
      // Hoàn kho
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { stock: { increment: 50 }, version: { increment: 1 } },
      });
      expect(prismaMock.stockMovement.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 10,
          type: 'ORDER_RELEASE',
          quantity: 50,
          orderId: 201,
        },
      });
      // Hoàn promoCode
      expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
        where: { code: 'GIAM10' },
        data: { usedCount: { decrement: 1 } },
      });
      // Đổi status
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    it('không hủy nếu đơn có giao dịch đang PROCESSING', async () => {
      const pastDate = new Date(Date.now() - 20 * 60 * 1000);
      const processingOrder = {
        id: 202,
        status: OrderStatus.PENDING,
        items: [],
        payments: [{ id: 1, status: 'PROCESSING' }],
        createdAt: pastDate,
      };

      prismaMock.order.findMany.mockResolvedValue([processingOrder]);
      prismaMock.order.findUnique.mockResolvedValue(processingOrder);

      const count = await service.cancelExpiredOrders();

      expect(count).toBe(0);
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder (Task 10 & Quy trình hoàn tiền VietQR FR-24)', () => {
    const mockUserCustomer = { id: 1, role: Role.CUSTOMER };
    const mockUserOther = { id: 999, role: Role.CUSTOMER };
    const mockUserBarista = { id: 2, role: Role.BARISTA };

    it('ném NotFoundException nếu đơn hàng không tồn tại', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelOrder(999, mockUserCustomer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném ForbiddenException nếu khách hàng cố ý hủy đơn của người khác', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        items: [],
        payments: [],
      });

      await expect(service.cancelOrder(101, mockUserOther)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ném ConflictException nếu đơn hàng đang có giao dịch PROCESSING dở dang', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        items: [],
        payments: [{ id: 50, status: 'PROCESSING' }],
      });

      await expect(service.cancelOrder(101, mockUserCustomer)).rejects.toThrow(
        ConflictException,
      );
    });

    it('ném ConflictException (409) nếu đơn hàng đã ở bước PREPARING không thể hủy', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PREPARING,
        items: [],
        payments: [{ id: 50, status: 'SUCCESS' }],
      });

      await expect(service.cancelOrder(101, mockUserCustomer)).rejects.toThrow(
        ConflictException,
      );
    });

    it('hủy đơn PENDING thành công: hoàn kho nguyên liệu, hoàn promoCode và điểm đã dùng', async () => {
      const pendingOrder = {
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        promoCode: 'GIAM10',
        pointsUsed: 500,
        pointsEarned: 0,
        total: 45000,
        items: [
          {
            id: 1,
            consumption: [{ ingredientId: 10, quantity: 30 }],
          },
        ],
        payments: [],
      };

      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);
      prismaMock.ingredient.update.mockResolvedValue({});
      prismaMock.stockMovement.create.mockResolvedValue({});
      prismaMock.promoCode.update.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.order.update.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      });

      const res = await service.cancelOrder(101, mockUserCustomer);

      expect(res.status).toBe(OrderStatus.CANCELLED);
      // Hoàn kho
      expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { stock: { increment: 30 }, version: { increment: 1 } },
      });
      // Hoàn lượt dùng promoCode
      expect(prismaMock.promoCode.update).toHaveBeenCalledWith({
        where: { code: 'GIAM10' },
        data: { usedCount: { decrement: 1 } },
      });
      // Hoàn điểm đã sử dụng
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { loyaltyPoints: { increment: 500 } },
      });
    });

    it('hủy đơn PAID thành công (FR-24): thu hồi điểm tích lũy và lưu thông tin nhận hoàn tiền VietQR', async () => {
      const paidOrder = {
        id: 102,
        userId: 1,
        status: OrderStatus.PAID,
        promoCode: null,
        pointsUsed: 0,
        pointsEarned: 50,
        total: 50000,
        items: [
          {
            id: 1,
            consumption: [{ ingredientId: 10, quantity: 25 }],
          },
        ],
        payments: [{ id: 60, status: 'SUCCESS', amount: 50000 }],
      };

      prismaMock.order.findUnique.mockResolvedValue(paidOrder);
      prismaMock.ingredient.update.mockResolvedValue({});
      prismaMock.stockMovement.create.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.loyaltyTransaction.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.payment.update.mockResolvedValue({});
      prismaMock.order.update.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.CANCELLED,
      });

      const cancelDto = {
        refundBank: 'MB',
        refundAccount: '0987654321',
      };

      const res = await service.cancelOrder(102, mockUserCustomer, cancelDto);

      expect(res.status).toBe(OrderStatus.CANCELLED);
      // Thu hồi điểm thưởng
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { loyaltyPoints: { decrement: 50 } },
      });
      expect(prismaMock.loyaltyTransaction.updateMany).toHaveBeenCalledWith({
        where: { orderId: 102 },
        data: { reversedAt: expect.any(Date) },
      });
      // Ghi nhận nghĩa vụ hoàn tiền VietQR trên Payment (tách biệt: lúc hủy refundedAmount = 0)
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
        where: { id: 60 },
        data: {
          refundedAmount: 0,
          refundRef: 'VIETQR:MB:0987654321:PENDING',
        },
      });
    });

    it('ném BadRequestException nếu đơn PAID hủy nhưng thiếu số tài khoản hoàn tiền', async () => {
      const paidOrder = {
        id: 102,
        userId: 1,
        status: OrderStatus.PAID,
        promoCode: null,
        pointsUsed: 0,
        pointsEarned: 0,
        total: 50000,
        items: [],
        payments: [{ id: 60, status: 'SUCCESS', amount: 50000 }],
      };

      prismaMock.order.findUnique.mockResolvedValue(paidOrder);

      await expect(service.cancelOrder(102, mockUserCustomer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Barista có quyền hủy đơn của khách khi có sự cố phát sinh', async () => {
      const paidOrder = {
        id: 103,
        userId: 1,
        status: OrderStatus.PAID,
        promoCode: null,
        pointsUsed: 0,
        pointsEarned: 0,
        total: 40000,
        items: [],
        payments: [{ id: 61, status: 'SUCCESS', amount: 40000 }],
      };

      prismaMock.order.findUnique.mockResolvedValue(paidOrder);
      prismaMock.payment.update.mockResolvedValue({});
      prismaMock.order.update.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.CANCELLED,
      });

      const res = await service.cancelOrder(103, mockUserBarista, {
        refundBank: 'MB',
        refundAccount: '0987654321',
      });
      expect(res.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('confirmRefund (Task 10 & Barista hoàn tiền VietQR FR-26)', () => {
    const mockUserCustomer = { id: 1, role: Role.CUSTOMER };
    const mockUserBarista = { id: 2, role: Role.BARISTA };

    it('ném ForbiddenException nếu người gọi không phải là nhân viên Barista', async () => {
      await expect(service.confirmRefund(105, mockUserCustomer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ném NotFoundException nếu đơn hàng không tồn tại', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(service.confirmRefund(999, mockUserBarista)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ném BadRequestException nếu đơn hàng chưa ở trạng thái CANCELLED', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 106,
        status: OrderStatus.PAID,
        payments: [{ id: 70, status: 'SUCCESS' }],
      });

      await expect(service.confirmRefund(106, mockUserBarista)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ném BadRequestException nếu thiếu mã bằng chứng giao dịch refundRef', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 105,
        status: OrderStatus.CANCELLED,
        payments: [{ id: 70, status: 'SUCCESS' }],
      });

      await expect(service.confirmRefund(105, mockUserBarista, { refundRef: '' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ném BadRequestException nếu đơn hàng không có bản ghi Payment để hoàn tiền', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 107,
        status: OrderStatus.CANCELLED,
        payments: [],
      });

      await expect(
        service.confirmRefund(107, mockUserBarista, { refundRef: 'FT123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném ConflictException nếu đơn hàng đã được xác nhận hoàn tiền trước đó (chống hoàn 2 lần)', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 107,
        status: OrderStatus.CANCELLED,
        payments: [{ id: 70, status: 'SUCCESS', refundedAt: new Date() }],
      });

      await expect(
        service.confirmRefund(107, mockUserBarista, { refundRef: 'FT123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('Barista xác nhận hoàn tiền VietQR thành công: cập nhật refundedAt và refundRef', async () => {
      const cancelledOrder = {
        id: 108,
        total: 65000,
        status: OrderStatus.CANCELLED,
        payments: [
          {
            id: 71,
            status: 'SUCCESS',
            amount: 65000,
            refundRef: 'VIETQR:MB:0987654321:PENDING',
          },
        ],
      };

      const now = new Date();
      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder);
      prismaMock.payment.update.mockResolvedValue({
        id: 71,
        refundedAt: now,
        refundedAmount: 65000,
        refundRef: 'VIETQR:MB:0987654321:PENDING:CONFIRMED:FT2401',
      });

      const res = await service.confirmRefund(108, mockUserBarista, { refundRef: 'FT2401' });

      expect(res.orderId).toBe(108);
      expect(res.refundedAmount).toBe(65000);
      expect(res.refundRef).toBe('VIETQR:MB:0987654321:PENDING:CONFIRMED:FT2401');
      expect(res.message).toMatch(/Xác nhận hoàn tiền VietQR thành công/i);
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
        where: { id: 71 },
        data: {
          refundedAt: expect.any(Date),
          refundedAmount: 65000,
          refundRef: 'VIETQR:MB:0987654321:PENDING:CONFIRMED:FT2401',
        },
      });
    });

    it('failRefund: cập nhật trạng thái FAILED với lý do từ chối', async () => {
      const cancelledOrder = {
        id: 109,
        total: 50000,
        status: OrderStatus.CANCELLED,
        payments: [
          {
            id: 72,
            status: 'SUCCESS',
            amount: 50000,
            refundRef: 'VIETQR:VCB:12345678:PENDING',
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder);
      prismaMock.payment.update.mockResolvedValue({
        id: 72,
        refundedAt: null,
        refundedAmount: 0,
        refundRef: 'VIETQR:VCB:12345678:FAILED:Tài khoản đóng',
      });

      const res = await service.failRefund(109, mockUserBarista, { reason: 'Tài khoản đóng' });
      expect(res.orderId).toBe(109);
      expect(res.refundStatus).toBe('FAILED');
      expect(res.reason).toBe('Tài khoản đóng');
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
        where: { id: 72 },
        data: {
          refundRef: 'VIETQR:VCB:12345678:FAILED:Tài khoản đóng',
          refundedAmount: 0,
          refundedAt: null,
        },
      });
    });

    it('holdRefund: chuyển sang trạng thái đối soát nghi ngờ UNKNOWN', async () => {
      const cancelledOrder = {
        id: 110,
        total: 45000,
        status: OrderStatus.CANCELLED,
        payments: [
          {
            id: 73,
            status: 'SUCCESS',
            amount: 45000,
            refundRef: 'VIETQR:BIDV:99998888:PENDING',
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder);
      prismaMock.payment.update.mockResolvedValue({
        id: 73,
        refundedAt: null,
        refundedAmount: 0,
        refundRef: 'VIETQR:BIDV:99998888:UNKNOWN:Napas nghẽn lệnh',
      });

      const res = await service.holdRefund(110, mockUserBarista, { note: 'Napas nghẽn lệnh' });
      expect(res.orderId).toBe(110);
      expect(res.refundStatus).toBe('UNKNOWN');
      expect(res.note).toBe('Napas nghẽn lệnh');
    });

    it('retryRefund: đặt lại trạng thái PENDING và cho phép cập nhật STK mới', async () => {
      const cancelledOrder = {
        id: 111,
        total: 55000,
        status: OrderStatus.CANCELLED,
        payments: [
          {
            id: 74,
            status: 'SUCCESS',
            amount: 55000,
            refundRef: 'VIETQR:MB:old123:FAILED:Sai STK',
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder);
      prismaMock.payment.update.mockResolvedValue({
        id: 74,
        refundedAt: null,
        refundedAmount: 0,
        refundRef: 'VIETQR:TCB:new456:PENDING',
      });

      const res = await service.retryRefund(111, mockUserBarista, {
        refundBank: 'TCB',
        refundAccount: 'new456',
      });
      expect(res.orderId).toBe(111);
      expect(res.refundStatus).toBe('PENDING');
      expect(res.refundBank).toBe('TCB');
      expect(res.refundAccount).toBe('new456');
    });

    it('retryRefund: chặn thử lại khi giao dịch đang ở trạng thái UNKNOWN (đang đối soát)', async () => {
      const cancelledOrder = {
        id: 112,
        total: 55000,
        status: OrderStatus.CANCELLED,
        payments: [
          {
            id: 75,
            status: 'SUCCESS',
            amount: 55000,
            refundRef: 'VIETQR:MB:123456:UNKNOWN:Napas nghẽn lệnh',
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder);

      await expect(
        service.retryRefund(112, mockUserBarista, {
          refundBank: 'MB',
          refundAccount: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundPoints', () => {
    it('hoàn tiền đơn hủy bằng điểm thưởng (1 điểm = 10đ) và đánh dấu payment đã hoàn', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 112,
        userId: 5,
        status: OrderStatus.CANCELLED,
        total: 45000,
        payments: [
          {
            id: 22,
            status: 'SUCCESS',
            refundedAt: null,
            refundRef: 'VIETQR:MB:0901234567:PENDING',
          },
        ],
      });
      prismaMock.user.update.mockResolvedValue({ id: 5, loyaltyPoints: 4500 });
      prismaMock.payment.update.mockResolvedValue({
        id: 22,
        refundedAt: new Date('2026-11-27T01:00:00Z'),
        refundedAmount: 45000,
        refundRef: 'POINTS:4500',
      });

      const res = await service.refundPoints(112, { id: 2, email: 'barista@brewlite.com', role: Role.BARISTA });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { loyaltyPoints: { increment: 4500 } },
      });
      expect(res.pointsRefunded).toBe(4500);
      expect(res.refundRef).toBe('POINTS:4500');
    });
  });
});
