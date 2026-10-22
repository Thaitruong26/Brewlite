import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ValidatePromotionDto } from './dto/validate-promotion.dto.js';
import { PrismaService } from '../prisma/prisma.service.js'; 

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(dto: ValidatePromotionDto) {
    const { code, orderValue } = dto;

    // 1. Tìm mã khuyến mãi trong bảng PromoCode
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code },
    });

    if (!promo) {
      throw new NotFoundException('Mã khuyến mãi không tồn tại!');
    }

    // 2. Kiểm tra trạng thái kích hoạt (isActive)
    if (!promo.isActive) {
      throw new BadRequestException('Mã khuyến mãi này đang bị tạm khóa!');
    }

    // 3. Kiểm tra thời gian sử dụng (startsAt & expiresAt)
    const now = new Date();
    if (now < promo.startsAt) {
      throw new BadRequestException('Mã khuyến mãi này chưa đến thời gian áp dụng!');
    }
    if (now > promo.expiresAt) {
      throw new BadRequestException('Mã khuyến mãi này đã hết hạn!');
    }

    // 4. Kiểm tra giá trị đơn tối thiểu (minOrderValue)
    if (orderValue < promo.minOrderValue) {
      throw new BadRequestException(`Đơn hàng chưa đạt giá trị tối thiểu ${promo.minOrderValue}đ để dùng mã!`);
    }

    // 5. Kiểm tra lượt dùng (usageLimit & usedCount)
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException('Mã khuyến mãi này đã hết lượt sử dụng!');
    }

    // 6. Tính toán số tiền được giảm dựa vào type (PERCENT hoặc FIXED)
    let discountAmount = 0;

    if (promo.type === 'PERCENT') {
      // Giảm theo phần trăm (làm tròn xuống bằng Math.floor để tránh số lẻ)
      discountAmount = Math.floor((orderValue * promo.value) / 100);
      
      // Chặn mức giảm tối đa (nếu có maxDiscount)
      if (promo.maxDiscount !== null && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.type === 'FIXED') {
      // Giảm thẳng tiền mặt
      discountAmount = promo.value;
    }

    // Đảm bảo tiền giảm không vượt quá tổng giá trị đơn hàng
    if (discountAmount > orderValue) {
      discountAmount = orderValue;
    }

    return {
      success: true,
      message: 'Áp dụng mã khuyến mãi thành công!',
      code: promo.code,
      discountAmount: discountAmount,
      finalPrice: orderValue - discountAmount, // Số tiền khách thực trả
    };
  }
}