import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IsArray, IsOptional, IsString } from 'class-validator';
//  tạo tạm một DTO nhận dữ liệu khách gửi lên để dễ hình dung
export class CreateOrderDto {
  @IsArray()
  items: any[];

  @IsString()
  @IsOptional()
  promoCode?: string;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: number, dto: CreateOrderDto) {
    // Bắt đầu Prisma Transaction (Lưu ý: dùng 'tx' thay vì 'this.prisma' bên trong khối này)
    return await this.prisma.$transaction(async (tx) => {
      
      // 1. Tính tổng tiền gốc (subtotal) của các món nước
      let subtotal = 0;
      for (const item of dto.items) {
        subtotal += item.qty * item.unitPrice;
      }

      let discountAmount = 0;

      // 2. Nếu khách có nhập mã khuyến mãi, tiến hành kiểm tra và áp mã
      if (dto.promoCode) {
        const promo = await tx.promoCode.findUnique({
          where: { code: dto.promoCode },
        });

        if (!promo) throw new NotFoundException('Mã khuyến mãi không tồn tại');
        if (!promo.isActive) throw new BadRequestException('Mã đang bị khóa');
        if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
          throw new BadRequestException('Mã đã hết lượt sử dụng');
        }
        if (subtotal < promo.minOrderValue) {
          throw new BadRequestException(`Đơn chưa đạt tối thiểu ${promo.minOrderValue}đ`);
        }

        // Tính tiền giảm
        if (promo.type === 'PERCENT') {
          discountAmount = Math.floor((subtotal * promo.value) / 100);
          if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
            discountAmount = promo.maxDiscount;
          }
        } else {
          discountAmount = promo.value;
        }
        if (discountAmount > subtotal) discountAmount = subtotal;

        // 3. TĂNG SỐ LƯỢT DÙNG (usedCount) NGAY TRONG TRANSACTION NÀY
        await tx.promoCode.update({
          where: { code: dto.promoCode },
          data: { usedCount: { increment: 1 } },
        });
      }

      const total = subtotal - discountAmount;

      // 4. Tạo đơn hàng và chi tiết đơn hàng (OrderItem)
      const newOrder = await tx.order.create({
        data: {
          userId: userId,
          subtotal: subtotal,
          discountAmount: discountAmount,
          total: total,
          promoCode: dto.promoCode || null,
          items: {
            create: dto.items.map(item => ({
              productId: item.productId,
              productName: 'Tên món nước', // Thực tế cần query bảng Product để lấy tên thật
              size: item.size,
              unitPrice: item.unitPrice,
              qty: item.qty,
              lineTotal: item.qty * item.unitPrice,
            })),
          },
        },
      });

      return newOrder;
    });
  }
}