import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaMock: {
    product: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    topping: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleProducts = [
    {
      id: 1,
      name: 'Cà phê sữa',
      description: 'Cà phê phin pha sữa đặc',
      price: 35000,
      imageUrl: '/img/ca-phe-sua.jpg',
      category: 'Cà phê',
      stock: 40,
      version: 0,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 2,
      name: 'Americano',
      description: 'Espresso pha loãng',
      price: 40000,
      imageUrl: '/img/americano.jpg',
      category: 'Cà phê',
      stock: 0,
      version: 0,
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const sampleToppings = [
    { id: 1, name: 'Trân châu', price: 5000 },
    { id: 2, name: 'Kem cheese', price: 7000 },
  ];

  beforeEach(() => {
    prismaMock = {
      product: {
        count: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      topping: {
        findMany: vi.fn(),
      },
    };

    service = new ProductsService(prismaMock as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('trả về danh sách sản phẩm phân trang với inStock và meta đầy đủ', async () => {
      prismaMock.product.count.mockResolvedValue(2);
      prismaMock.product.findMany.mockResolvedValue(sampleProducts);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 1,
        name: 'Cà phê sữa',
        price: 35000,
        imageUrl: '/img/ca-phe-sua.jpg',
        category: 'Cà phê',
        stock: 40,
        inStock: true,
      });
      expect(result.data[1].inStock).toBe(false); // stock = 0
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('tìm kiếm theo tên (search) và lọc theo danh mục (category)', async () => {
      prismaMock.product.count.mockResolvedValue(1);
      prismaMock.product.findMany.mockResolvedValue([sampleProducts[0]]);

      const result = await service.findAll({
        search: 'sữa',
        category: 'Cà phê',
        page: 1,
        limit: 10,
      });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          name: { contains: 'sữa', mode: 'insensitive' },
          category: { equals: 'Cà phê', mode: 'insensitive' },
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
      expect(result.data).toHaveLength(1);
    });

    it('trả về danh sách rỗng 200 khi không có sản phẩm', async () => {
      prismaMock.product.count.mockResolvedValue(0);
      prismaMock.product.findMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe('findOne', () => {
    it('trả về chi tiết sản phẩm kèm sizes và toppings', async () => {
      prismaMock.product.findFirst.mockResolvedValue(sampleProducts[0]);
      prismaMock.topping.findMany.mockResolvedValue(sampleToppings);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Cà phê sữa');
      expect(result.sizes).toEqual([
        { size: 'S', surcharge: 0 },
        { size: 'M', surcharge: 5000 },
        { size: 'L', surcharge: 10000 },
      ]);
      expect(result.toppings).toEqual([
        { id: 1, name: 'Trân châu', price: 5000 },
        { id: 2, name: 'Kem cheese', price: 7000 },
      ]);
      expect(result.inStock).toBe(true);
    });

    it('ném lỗi NotFoundException PRODUCT_NOT_FOUND khi sản phẩm không tồn tại hoặc isActive false', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      try {
        await service.findOne(999);
      } catch (err: unknown) {
        expect((err as NotFoundException).getResponse()).toEqual({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Không tìm thấy sản phẩm #999',
          details: [{ productId: 999 }],
        });
      }
    });
  });
});
