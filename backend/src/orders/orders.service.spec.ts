
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PricingService } from '../common/pricing/pricing.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

describe('OrdersService', () => {
  let service: OrdersService;

  let prisma: {
    order: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    promoCode: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  let pricingService: {
    calculate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      order: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      promoCode: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }

        return Promise.all(arg as Promise<unknown>[]);
      }),
    };

    pricingService = {
      calculate: vi.fn(),
    };

    service = new OrdersService(
      prisma as unknown as PrismaService,
      pricingService as unknown as PricingService,
    );
  });

  describe('createOrder', () => {
    it('tính giá bằng PricingService và tạo đơn PENDING', async () => {
      const dto = {
        items: [
          {
            productId: 1,
            size: 'M',
            toppingIds: [2],
            quantity: 2,
          },
        ],
      } as CreateOrderDto;

      pricingService.calculate.mockResolvedValue({
        subtotal: 90000,
        lines: [
          {
            productId: 1,
            productName: 'Cà phê muối',
            size: 'M',
            toppings: [{ id: 2, name: 'Trân châu', price: 5000 }],
            unitPrice: 45000,
            qty: 2,
            lineTotal: 90000,
            note: null,
          },
        ],
      });

      prisma.order.create.mockResolvedValue({
        id: 101,
        status: 'PENDING',
        subtotal: 90000,
        discountAmount: 0,
        total: 90000,
        promoCode: null,
        createdAt: new Date('2026-10-20T00:00:00Z'),
        items: [
          {
            id: 1,
            productId: 1,
            productName: 'Cà phê muối',
            size: 'M',
            toppings: [{ id: 2, name: 'Trân châu', price: 5000 }],
            unitPrice: 45000,
            qty: 2,
            lineTotal: 90000,
            note: null,
          },
        ],
      });

      const result = await service.createOrder(7, dto);

      expect(pricingService.calculate).toHaveBeenCalledWith(
        dto.items,
        prisma,
      );

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 7,
            status: 'PENDING',
            subtotal: 90000,
            discountAmount: 0,
            total: 90000,
            promoCode: null,
          }),
          include: { items: true },
        }),
      );

      expect(result.status).toBe('PENDING');
      expect(result.total).toBe(90000);
      expect(result.code).toBe('#101');
    });
  });

  describe('getMyOrders', () => {
    it('chỉ lấy đơn của người dùng và phân trang đúng', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 101,
          status: 'PENDING',
          total: 90000,
          createdAt: new Date('2026-10-20T00:00:00Z'),
          _count: { items: 2 },
        },
      ]);

      prisma.order.count.mockResolvedValue(1);

      const result = await service.getMyOrders(7, 2, 5);

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 7 },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
        include: {
          _count: { select: { items: true } },
        },
      });

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { userId: 7 },
      });

      expect(result.data).toHaveLength(1);

      expect(result.data[0]).toMatchObject({
        id: 101,
        code: '#101',
        status: 'PENDING',
        total: 90000,
        itemCount: 2,
      });

      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      });
    });

    it('lọc theo trạng thái khi người dùng truyền status', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      const result = await service.getMyOrders(7, 1, 10, 'PAID');

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 7,
            status: 'PAID',
          },
          skip: 0,
          take: 10,
        }),
      );

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 7,
          status: 'PAID',
        },
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });
});
