import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoyaltyService } from './loyalty.service.js';

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyService],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('award', () => {
    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        loyaltyTransaction: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
        user: {
          update: vi.fn(),
        },
        order: {
          update: vi.fn(),
        },
      };
    });

    it('should award 1 point per 1000 VND to user and record transaction', async () => {
      mockTx.loyaltyTransaction.findUnique.mockResolvedValue(null);

      const order = { id: 101, userId: 1, total: 45000 };
      const result = await service.award(mockTx, order);

      expect(result).toHaveProperty('success', true);
      expect(result?.message).toContain('45 điểm');

      expect(mockTx.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: { userId: 1, orderId: 101, points: 45 },
      });
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { loyaltyPoints: { increment: 45 } },
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { pointsEarned: 45 },
      });
    });

    it('should throw BadRequestException if order was already awarded points', async () => {
      mockTx.loyaltyTransaction.findUnique.mockResolvedValue({ id: 1, orderId: 101 });

      const order = { id: 101, userId: 1, total: 50000 };
      await expect(service.award(mockTx, order)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockTx.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('should not award any points if total is less than 1000 VND', async () => {
      const order = { id: 101, userId: 1, total: 500 };
      const result = await service.award(mockTx, order);

      expect(result).toBeUndefined();
      expect(mockTx.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });
});
