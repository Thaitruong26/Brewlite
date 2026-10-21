import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromotionsService } from './promotions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: {
    promoCode: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      promoCode: {
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    const validPercentPromo = {
      code: 'BREW10',
      type: 'PERCENT',
      value: 10,
      minOrderValue: 50000,
      maxDiscount: 30000,
      isActive: true,
      startsAt: new Date(Date.now() - 86400000), // hôm qua
      expiresAt: new Date(Date.now() + 86400000), // ngày mai
      usageLimit: 100,
      usedCount: 10,
    };

    it('should validate PERCENT promo code successfully and calculate discount', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(validPercentPromo);

      const result = await service.validate({
        code: 'BREW10',
        orderValue: 100000,
      });

      expect(result.success).toBe(true);
      expect(result.discountAmount).toBe(10000); // 10% của 100.000 = 10.000
      expect(result.finalPrice).toBe(90000);
    });

    it('should cap discount if exceeding maxDiscount', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(validPercentPromo);

      const result = await service.validate({
        code: 'BREW10',
        orderValue: 500000, // 10% là 50.000 nhưng maxDiscount = 30.000
      });

      expect(result.discountAmount).toBe(30000);
      expect(result.finalPrice).toBe(470000);
    });

    it('should validate FIXED promo code successfully', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...validPercentPromo,
        code: 'GIAM15K',
        type: 'FIXED',
        value: 15000,
        maxDiscount: null,
      });

      const result = await service.validate({
        code: 'GIAM15K',
        orderValue: 80000,
      });

      expect(result.discountAmount).toBe(15000);
      expect(result.finalPrice).toBe(65000);
    });

    it('should throw NotFoundException if promo does not exist', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(null);

      await expect(
        service.validate({ code: 'KHONG_CO', orderValue: 100000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if promo is inactive', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...validPercentPromo,
        isActive: false,
      });

      await expect(
        service.validate({ code: 'BREW10', orderValue: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if promo has expired', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...validPercentPromo,
        expiresAt: new Date(Date.now() - 10000), // đã hết hạn
      });

      await expect(
        service.validate({ code: 'BREW10', orderValue: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if orderValue is below minOrderValue', async () => {
      prisma.promoCode.findUnique.mockResolvedValue(validPercentPromo);

      await expect(
        service.validate({ code: 'BREW10', orderValue: 30000 }), // min 50.000
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if promo reached usage limit', async () => {
      prisma.promoCode.findUnique.mockResolvedValue({
        ...validPercentPromo,
        usageLimit: 50,
        usedCount: 50,
      });

      await expect(
        service.validate({ code: 'BREW10', orderValue: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
