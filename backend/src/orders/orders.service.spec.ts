import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrderStatus, Role, Size } from '../generated/prisma/client.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaMock: any;
  let pricingServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      product: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
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

    service = new OrdersService(prismaMock, pricingServiceMock);
  });

  describe('createOrder (Task 6 & Task 10)', () => {
    it('tạo đơn thành công khi còn tồn kho, tính lại giá bằng PricingService', async () => {
      // Mock sản phẩm còn 10 ly, version = 0
      prismaMock.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Cà phê sữa',
        stock: 10,
        version: 0,
        isActive: true,
      });

      // Update tồn kho thành công (count = 1)
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      // Mock Order.create
      prismaMock.order.create.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        createdAt: new Date('2026-10-26T10:00:00.000Z'),
        items: [
          {
            productId: 1,
            productName: 'Cà phê sữa',
            size: Size.M,
            toppings: [{ id: 1, name: 'Trân châu', price: 5000 }],
            unitPrice: 45000,
            qty: 2,
            lineTotal: 90000,
          },
        ],
      });

      const res = await service.createOrder(1, {
        items: [{ productId: 1, size: Size.M, quantity: 2, toppingIds: [1] }],
      });

      expect(pricingServiceMock.calculate).toHaveBeenCalled();
      expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
        where: { id: 1, version: 0, stock: { gte: 2 } },
        data: { stock: { decrement: 2 }, version: { increment: 1 } },
      });
      expect(res.id).toBe(101);
      expect(res.code).toBe('#101');
      expect(res.status).toBe(OrderStatus.PENDING);
      expect(res.total).toBe(90000);
    });

    it('báo lỗi 409 OUT_OF_STOCK khi tồn kho không đủ', async () => {
      // Mock sản phẩm chỉ còn 1 ly trong khi khách đặt 2
      prismaMock.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Cà phê muối',
        stock: 1,
        version: 0,
        isActive: true,
      });

      await expect(
        service.createOrder(1, {
          items: [{ productId: 1, size: Size.M, quantity: 2 }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('tiêu chí (c): đặt đồng thời nhiều đơn không vượt quá tồn kho (optimistic locking)', async () => {
      // Giả lập sản phẩm chỉ còn 5 ly trong kho
      let currentStock = 5;
      let currentVersion = 0;

      prismaMock.product.findUnique.mockImplementation(async () => ({
        id: 1,
        name: 'Cà phê muối',
        stock: currentStock,
        version: currentVersion,
        isActive: true,
      }));

      prismaMock.product.updateMany.mockImplementation(async ({ where, data }: any) => {
        // Kiểm tra đúng version và đủ tồn kho
        if (where.version === currentVersion && currentStock >= where.stock.gte) {
          currentStock -= data.stock.decrement;
          currentVersion += data.version.increment;
          return { count: 1 };
        }
        return { count: 0 };
      });

      prismaMock.order.create.mockImplementation(async ({ data }: any) => ({
        id: Math.floor(Math.random() * 1000) + 1,
        ...data,
        createdAt: new Date(),
        items: [{ qty: 1 }],
      }));

      // Bắn 10 request đặt hàng đồng thời, mỗi đơn đặt 1 ly
      const results = await Promise.allSettled(
        Array.from({ length: 10 }).map((_, i) =>
          service.createOrder(i + 1, {
            items: [{ productId: 1, size: Size.M, quantity: 1 }],
          }),
        ),
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // Đúng 5 đơn thành công vì kho chỉ có 5 ly
      expect(successful).toHaveLength(5);
      // 5 đơn còn lại bị chặn OUT_OF_STOCK
      expect(failed).toHaveLength(5);
      // Tồn kho cuối cùng đúng bằng 0
      expect(currentStock).toBe(0);
      expect(currentVersion).toBe(5);
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
    it('cho phép chủ sở hữu xem chi tiết đơn hàng', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        pointsEarned: 0,
        items: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.getOrderById(101, { id: 1, role: Role.CUSTOMER });
      expect(res.id).toBe(101);
      expect(res.code).toBe('#101');
    });

    it('chặn khách hàng xem đơn của người khác và ném 403 FORBIDDEN', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 99, // Đơn của user 99
        status: OrderStatus.PENDING,
        items: [],
        payments: [],
      });

      await expect(
        service.getOrderById(101, { id: 1, role: Role.CUSTOMER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cho phép Barista xem đơn của bất kỳ ai', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 99,
        status: OrderStatus.PENDING,
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        pointsEarned: 0,
        items: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
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

  describe('cancelOrder (Task 10)', () => {
    it('hoàn kho khi hủy đơn thành công', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 101,
        userId: 1,
        status: OrderStatus.PENDING,
        items: [{ productId: 1, qty: 2 }],
        payments: [],
      });

      prismaMock.order.update.mockResolvedValue({
        id: 101,
        status: OrderStatus.CANCELLED,
      });

      const res = await service.cancelOrder(101, { id: 1, role: Role.CUSTOMER });

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stock: { increment: 2 }, version: { increment: 1 } },
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
});
