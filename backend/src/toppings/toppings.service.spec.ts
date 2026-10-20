import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToppingsService } from './toppings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ToppingsService', () => {
  let service: ToppingsService;
  let prismaMock: {
    topping: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleToppings = [
    { id: 1, name: 'Trân châu', price: 5000 },
    { id: 2, name: 'Kem cheese', price: 7000 },
    { id: 3, name: 'Thạch', price: 4000 },
  ];

  beforeEach(() => {
    prismaMock = {
      topping: {
        findMany: vi.fn(),
      },
    };

    service = new ToppingsService(prismaMock as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('trả về danh sách topping đang kích hoạt theo thứ tự id tăng dần', async () => {
      prismaMock.topping.findMany.mockResolvedValue(sampleToppings);

      const result = await service.findAll();

      expect(prismaMock.topping.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          price: true,
        },
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual(sampleToppings);
    });
  });
});
