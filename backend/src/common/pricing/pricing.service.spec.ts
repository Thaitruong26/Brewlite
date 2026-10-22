import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PricingService } from './pricing.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SIZE_SURCHARGE } from './pricing.constants.js';

describe('PricingService', () => {
  let service: PricingService;
  let prismaMock: {
    product: {
      findMany: ReturnType<typeof vi.fn>;
    };
    topping: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleProducts = [
    { id: 1, name: 'Cà phê sữa', price: 35000, isActive: true },
    { id: 2, name: 'Americano', price: 40000, isActive: true },
    { id: 3, name: 'Cappuccino', price: 45000, isActive: true },
  ];

  const sampleToppings = [
    { id: 1, name: 'Trân châu', price: 5000, isActive: true },
    { id: 2, name: 'Kem cheese', price: 7000, isActive: true },
    { id: 3, name: 'Thạch', price: 4000, isActive: true },
  ];

  beforeEach(() => {
    prismaMock = {
      product: {
        findMany: vi.fn(),
      },
      topping: {
        findMany: vi.fn(),
      },
    };

    service = new PricingService(prismaMock as unknown as PrismaService);
  });

  describe('calculate()', () => {
    it('tính đúng giá sản phẩm size S không có topping', async () => {
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0]]);
      prismaMock.topping.findMany.mockResolvedValue([]);

      const result = await service.calculate([
        {
          productId: 1,
          size: 'S',
          quantity: 2,
        },
      ]);

      const expectedUnitPrice = 35000 + SIZE_SURCHARGE['S']; // 35000
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toEqual({
        productId: 1,
        productName: 'Cà phê sữa',
        size: 'S',
        toppings: [],
        unitPrice: expectedUnitPrice,
        qty: 2,
        lineTotal: expectedUnitPrice * 2,
        note: null,
      });
      expect(result.subtotal).toBe(70000);
    });

    it('tính đúng giá sản phẩm size M và L kèm phụ thu và topping', async () => {
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[2]]); // Cappuccino: 45000
      prismaMock.topping.findMany.mockResolvedValue([sampleToppings[0], sampleToppings[1]]); // Trân châu: 5000, Kem cheese: 7000

      const result = await service.calculate([
        {
          productId: 3,
          size: 'M',
          toppingIds: [1, 2],
          quantity: 1,
          note: '  ít đường  ',
        },
      ]);

      // unitPrice = 45000 + 5000 (size M) + 5000 + 7000 = 62000
      expect(result.lines[0].unitPrice).toBe(62000);
      expect(result.lines[0].lineTotal).toBe(62000);
      expect(result.lines[0].note).toBe('ít đường');
      expect(result.lines[0].toppings).toEqual([
        { id: 1, name: 'Trân châu', price: 5000 },
        { id: 2, name: 'Kem cheese', price: 7000 },
      ]);
      expect(result.subtotal).toBe(62000);
    });

    it('tính đúng tổng tiền khi có nhiều sản phẩm khác nhau', async () => {
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0], sampleProducts[1]]);
      prismaMock.topping.findMany.mockResolvedValue([sampleToppings[2]]);

      const result = await service.calculate([
        { productId: 1, size: 'S', quantity: 1 }, // 35000
        { productId: 2, size: 'L', toppingIds: [3], quantity: 2 }, // (40000 + 10000 + 4000) * 2 = 108000
      ]);

      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].lineTotal).toBe(35000);
      expect(result.lines[1].lineTotal).toBe(108000);
      expect(result.subtotal).toBe(143000);
    });

    it('ném lỗi NotFoundException với code PRODUCT_NOT_FOUND khi sản phẩm không tồn tại', async () => {
      prismaMock.product.findMany.mockResolvedValue([]); // Không tìm thấy

      await expect(
        service.calculate([{ productId: 999, size: 'S', quantity: 1 }]),
      ).rejects.toThrow(NotFoundException);

      try {
        await service.calculate([{ productId: 999, size: 'S', quantity: 1 }]);
      } catch (err: unknown) {
        expect((err as NotFoundException).getResponse()).toEqual({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Không tìm thấy sản phẩm #999',
          details: [{ productId: 999 }],
        });
      }
    });

    it('ném lỗi BadRequestException khi số lượng topping vượt quá MAX_TOPPINGS_PER_ITEM (3)', async () => {
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0]]);
      prismaMock.topping.findMany.mockResolvedValue(sampleToppings);

      await expect(
        service.calculate([
          {
            productId: 1,
            size: 'S',
            toppingIds: [1, 2, 3, 4],
            quantity: 1,
          },
        ]),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.calculate([
          { productId: 1, size: 'S', toppingIds: [1, 2, 3, 4], quantity: 1 },
        ]);
      } catch (err: unknown) {
        expect((err as BadRequestException).getResponse()).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Mỗi ly chỉ được chọn tối đa 3 topping',
        });
      }
    });

    it('loại bỏ các toppingId trùng lặp trên cùng một ly', async () => {
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0]]);
      prismaMock.topping.findMany.mockResolvedValue([sampleToppings[0]]);

      const result = await service.calculate([
        {
          productId: 1,
          size: 'S',
          toppingIds: [1, 1, 1], // Trùng lặp
          quantity: 1,
        },
      ]);

      expect(result.lines[0].toppings).toHaveLength(1);
      expect(result.lines[0].unitPrice).toBe(35000 + 5000);
    });

    it('ném lỗi BadRequestException với code VALIDATION_ERROR khi topping không tồn tại hoặc ngừng bán', async () => {
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0]]);
      prismaMock.topping.findMany.mockResolvedValue([]); // Không tìm thấy topping

      await expect(
        service.calculate([
          {
            productId: 1,
            size: 'S',
            toppingIds: [999],
            quantity: 1,
          },
        ]),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.calculate([
          { productId: 1, size: 'S', toppingIds: [999], quantity: 1 },
        ]);
      } catch (err: unknown) {
        expect((err as BadRequestException).getResponse()).toEqual({
          code: 'VALIDATION_ERROR',
          message: 'Topping #999 không tồn tại hoặc đã ngừng bán',
          details: [{ toppingId: 999 }],
        });
      }
    });
  });

  describe('pointsFor()', () => {
    it('tính đúng 1 điểm cho mỗi 1.000đ và làm tròn xuống', () => {
      expect(service.pointsFor(0)).toBe(0);
      expect(service.pointsFor(999)).toBe(0);
      expect(service.pointsFor(1000)).toBe(1);
      expect(service.pointsFor(45000)).toBe(45);
      expect(service.pointsFor(123499)).toBe(123);
    });
  });
});
