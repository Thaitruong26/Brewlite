
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../common/pricing/pricing.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async createOrder(userId: number, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const pricing = await this.pricingService.calculate(dto.items, tx);
      let discountAmount = 0;

      if (dto.promoCode) {
        const promo = await tx.promoCode.findUnique({
          where: { code: dto.promoCode },
        });

        if (!promo || !promo.isActive) {
          throw new BadRequestException('Mã khuyến mãi không hợp lệ');
        }

        if (
          promo.usageLimit !== null &&
          promo.usedCount >= promo.usageLimit
        ) {
          throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
        }

        if (pricing.subtotal < promo.minOrderValue) {
          throw new BadRequestException(
            'Đơn hàng chưa đạt giá trị tối thiểu',
          );
        }

        if (promo.type === 'PERCENT') {
          discountAmount = Math.floor(
            (pricing.subtotal * promo.value) / 100,
          );

          if (
            promo.maxDiscount !== null &&
            discountAmount > promo.maxDiscount
          ) {
            discountAmount = promo.maxDiscount;
          }
        } else {
          discountAmount = promo.value;
        }

        discountAmount = Math.min(discountAmount, pricing.subtotal);

        const updatedPromo = await tx.promoCode.updateMany({
          where: {
            id: promo.id,
            isActive: true,
            ...(promo.usageLimit !== null
              ? { usedCount: { lt: promo.usageLimit } }
              : {}),
          },
          data: { usedCount: { increment: 1 } },
        });

        if (updatedPromo.count !== 1) {
          throw new BadRequestException(
            'Mã khuyến mãi đã hết lượt sử dụng',
          );
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          subtotal: pricing.subtotal,
          discountAmount,
          total: pricing.subtotal - discountAmount,
          promoCode: dto.promoCode ?? null,
          items: {
            create: pricing.lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              size: line.size,
              toppings: line.toppings as Prisma.InputJsonValue,
              unitPrice: line.unitPrice,
              qty: line.qty,
              lineTotal: line.lineTotal,
              note: line.note,
            })),
          },
        },
        include: { items: true },
      });

      return {
        id: order.id,
        code: `#${order.id}`,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        promoCode: order.promoCode,
        createdAt: order.createdAt,
      };
    });
  }

  async getMyOrders(
    userId: number,
    page = 1,
    limit = 10,
    status?: string,
  ) {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(status
        ? { status: status as Prisma.EnumOrderStatusFilter['equals'] }
        : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        code: `#${order.id}`,
        status: order.status,
        total: order.total,
        itemCount: order._count.items,
        createdAt: order.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(
    orderId: number,
    userId: number,
    role: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: {
          select: {
            method: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Không tìm thấy đơn hàng #${orderId}`,
      });
    }

    if (order.userId !== userId && role !== 'BARISTA') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xem đơn hàng này',
      });
    }

    return {
      id: order.id,
      code: `#${order.id}`,
      status: order.status,
      items: order.items,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
      payments: order.payments,
      pointsEarned: order.pointsEarned,
      createdAt: order.createdAt,
    };
  }
}
