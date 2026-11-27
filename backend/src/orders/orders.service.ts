import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../common/pricing/pricing.service.js';
import { RecipeService } from '../common/recipe/recipe.service.js';
import { assertTransition } from './order-state.js';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';
import {
  CancelOrderDto,
  ConfirmRefundDto,
  FailRefundDto,
  HoldRefundDto,
  RetryRefundDto,
} from './dto/cancel-order.dto.js';

export const ORDER_PAYMENT_TIMEOUT_MINUTES = 15;
export const ORDER_PAYMENT_TIMEOUT_MS = ORDER_PAYMENT_TIMEOUT_MINUTES * 60 * 1000;

export interface UserContext {
  id: number;
  role?: string;
}

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly recipeService: RecipeService,
  ) {}

  // Chức năng: Xử lý sự kiện ModuleInit. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  onModuleInit() {
    this.cleanupInterval = setInterval(() => {
      this.cancelExpiredOrders().catch((err) => {
        console.error('Lỗi khi chạy định kỳ cancelExpiredOrders:', err);
      });
    }, 60 * 1000);

    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  // Chức năng: Xử lý sự kiện ModuleDestroy. Cách hoạt động: Nhận sự kiện từ giao diện, cập nhật state hoặc gọi API xử lý nghiệp vụ tương ứng.
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Chức năng: Xử lý đặt đơn trọn vẹn trong Transaction. Cách hoạt động: Validate sản phẩm/topping, tính giá bằng PricingService, kiểm tra voucher/điểm thưởng, trừ tồn kho bằng RecipeService & IngredientsService, tạo Order PENDING kèm OrderItem snapshot.
  async createOrder(userId: number, dto: CreateOrderDto) {
    const MAX_RETRIES = 10;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const reservation = await this.reserveStock(tx, dto.items);

          const pricing = await this.pricingService.calculate(dto.items, tx);
          const subtotal = pricing.subtotal;
          let discountAmount = 0;

          if (dto.promoCode) {
            const promo = await tx.promoCode.findUnique({
              where: { code: dto.promoCode },
            });
            const now = new Date();

            if (!promo || !promo.isActive) {
              throw new UnprocessableEntityException({
                code: 'PROMO_NOT_FOUND',
                message: 'Mã khuyến mãi không tồn tại hoặc đã bị khóa',
              });
            }
            if (now < promo.startsAt) {
              throw new UnprocessableEntityException({
                code: 'PROMO_NOT_STARTED',
                message: 'Mã khuyến mãi chưa đến thời gian áp dụng',
              });
            }
            if (now > promo.expiresAt) {
              throw new UnprocessableEntityException({
                code: 'PROMO_EXPIRED',
                message: 'Mã khuyến mãi đã hết hạn sử dụng',
              });
            }
            if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
              throw new UnprocessableEntityException({
                code: 'PROMO_USAGE_EXCEEDED',
                message: 'Mã khuyến mãi đã hết lượt sử dụng',
              });
            }
            if (subtotal < promo.minOrderValue) {
              throw new UnprocessableEntityException({
                code: 'PROMO_MIN_ORDER_NOT_MET',
                message: `Đơn hàng chưa đạt giá trị tối thiểu ${promo.minOrderValue.toLocaleString('vi-VN')}đ`,
              });
            }

            if (promo.type === 'PERCENT') {
              discountAmount = Math.floor((subtotal * promo.value) / 100);
              if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
                discountAmount = promo.maxDiscount;
              }
            } else {
              discountAmount = promo.value;
            }
            if (discountAmount > subtotal) discountAmount = subtotal;

            const promoUpdate = await tx.promoCode.updateMany({
              where: {
                code: promo.code,
                isActive: true,
                ...(promo.usageLimit !== null ? { usedCount: { lt: promo.usageLimit } } : {}),
              },
              data: {
                usedCount: { increment: 1 },
              },
            });

            if (promoUpdate.count === 0) {
              throw new UnprocessableEntityException({
                code: 'PROMO_USAGE_EXCEEDED',
                message: 'Mã khuyến mãi đã hết lượt sử dụng',
              });
            }
          }

          let pointsUsed = 0;
          if (dto.usePoints && userId) {
            const currentUser = await tx.user.findUnique({
              where: { id: userId },
              select: { loyaltyPoints: true },
            });
            if (currentUser && currentUser.loyaltyPoints > 0) {
              const remainingBeforePoints = Math.max(0, subtotal - discountAmount);
              const maxPointsDiscount = currentUser.loyaltyPoints * 10;
              const pointsDiscount = Math.min(remainingBeforePoints, maxPointsDiscount);
              pointsUsed = Math.ceil(pointsDiscount / 10);
              if (pointsUsed > 0) {
                await tx.user.update({
                  where: { id: userId },
                  data: { loyaltyPoints: { decrement: pointsUsed } },
                });
                discountAmount += pointsDiscount;
              }
            }
          }

          const total = Math.max(0, subtotal - discountAmount);

          const newOrder = await tx.order.create({
            data: {
              userId,
              status: OrderStatus.PENDING,
              subtotal,
              discountAmount,
              total,
              promoCode: dto.promoCode || null,
              pointsEarned: 0,
              pointsUsed,
              items: {
                create: pricing.lines.map((line, idx) => ({
                  productId: line.productId,
                  productName: line.productName,
                  size: line.size,
                  toppings: line.toppings,
                  consumption: reservation.lineConsumptions[idx] ?? [],
                  unitPrice: line.unitPrice,
                  qty: line.qty,
                  lineTotal: line.lineTotal,
                  note: line.note,
                })),
              },
            },
            include: {
              items: true,
            },
          });

          for (const [ingredientId, qty] of reservation.orderNeedsMap.entries()) {
            await tx.stockMovement.create({
              data: {
                ingredientId,
                type: 'ORDER_RESERVE',
                quantity: -qty,
                orderId: newOrder.id,
              },
            });
          }

          return {
            id: newOrder.id,
            code: `#${newOrder.id}`,
            status: newOrder.status,
            items: newOrder.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              size: item.size,
              toppings: item.toppings,
              unitPrice: item.unitPrice,
              qty: item.qty,
              lineTotal: item.lineTotal,
            })),
            subtotal: newOrder.subtotal,
            discountAmount: newOrder.discountAmount,
            total: newOrder.total,
            promoCode: newOrder.promoCode,
            pointsUsed: newOrder.pointsUsed,
            createdAt: newOrder.createdAt.toISOString(),
            expiresAt: new Date(newOrder.createdAt.getTime() + ORDER_PAYMENT_TIMEOUT_MS).toISOString(),
          };
        });
      } catch (err: any) {
        if (err?.message === 'STOCK_RETRY') {
          if (attempt === MAX_RETRIES) {
            throw new ConflictException({
              code: 'STOCK_CONFLICT',
              message: 'Hệ thống đang bận do nhiều người đặt cùng lúc, vui lòng thử lại',
            });
          }
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 41) + 10),
          );
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException({
      code: 'STOCK_CONFLICT',
      message: 'Hệ thống đang bận do nhiều người đặt cùng lúc, vui lòng thử lại',
    });
  }

  // Chức năng: Lấy dữ liệu OrdersMe. Cách hoạt động: Truy vấn dữ liệu từ PostgreSQL qua Prisma và trả về kết quả đã định dạng.
  async getOrdersMe(userId: number, query: GetOrdersQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.status) {
      where.status = query.status;
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: {
            select: { id: true, method: true, status: true, amount: true, createdAt: true, refundedAt: true, refundedAmount: true, refundRef: true },
          },
        },
      }),
    ]);

    const data = orders.map((order) => {
      const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
      return {
        id: order.id,
        code: `#${order.id}`,
        status: order.status,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        promoCode: order.promoCode,
        pointsEarned: order.pointsEarned,
        pointsUsed: order.pointsUsed,
        itemCount,
        items: order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          size: i.size,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          toppings: (i.toppings as any) || [],
          note: i.note,
        })),
        payments: order.payments,
        createdAt: order.createdAt.toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Chức năng: Lấy dữ liệu OrderById. Cách hoạt động: Truy vấn dữ liệu từ PostgreSQL qua Prisma và trả về kết quả đã định dạng.
  async getOrderById(id: number, user: UserContext) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: {
          select: {
            id: true,
            orderId: true,
            amount: true,
            method: true,
            status: true,
            providerRef: true,
            refundedAt: true,
            refundedAmount: true,
            refundRef: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Không tìm thấy đơn hàng #${id}`,
      });
    }

    if (order.userId !== user.id && user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền xem đơn hàng này',
      });
    }

    return {
      id: order.id,
      code: `#${order.id}`,
      status: order.status,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        size: item.size,
        toppings: item.toppings,
        unitPrice: item.unitPrice,
        qty: item.qty,
        lineTotal: item.lineTotal,
        note: item.note,
      })),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
      promoCode: order.promoCode,
      pointsEarned: order.pointsEarned,
        pointsUsed: order.pointsUsed,
      payments: order.payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        method: p.method,
        status: p.status,
        providerRef: p.providerRef,
        refundedAt: p.refundedAt?.toISOString() ?? null,
        refundedAmount: p.refundedAmount,
        refundRef: p.refundRef,
        createdAt: p.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      expiresAt:
        order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_FAILED
          ? new Date(order.createdAt.getTime() + ORDER_PAYMENT_TIMEOUT_MS).toISOString()
          : null,
    };
  }

  // Chức năng: Xử lý hủy đơn hàng an toàn. Cách hoạt động: Mở transaction kiểm tra trạng thái (chỉ hủy được khi PENDING, PAYMENT_FAILED hoặc PAID), hoàn trả tồn kho, hoàn lại điểm đã dùng, hoàn lượt promo; nếu đơn đã PAID thì lưu yêu cầu hoàn tiền VietQR trạng thái PENDING.
  async cancelOrder(id: number, user: UserContext, dto?: CancelOrderDto) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.userId !== user.id && user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền hủy đơn hàng này',
        });
      }

      const hasProcessingPayment = order.payments.some((p) => p.status === 'PROCESSING');
      if (hasProcessingPayment) {
        throw new ConflictException({
          code: 'PAYMENT_IN_PROGRESS',
          message: 'Đơn hàng đang có giao dịch thanh toán đang xử lý, không thể hủy lúc này',
        });
      }

      assertTransition(order.status, OrderStatus.CANCELLED);

      await this.releaseStock(tx, order);

      if (order.promoCode) {
        await tx.promoCode.update({
          where: { code: order.promoCode },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }

      if (order.pointsUsed > 0 && order.userId) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: { increment: order.pointsUsed },
          },
        });
      }

      if (order.status === OrderStatus.PAID) {
        if (!dto?.refundAccount?.trim()) {
          throw new BadRequestException({
            code: 'REFUND_ACCOUNT_REQUIRED',
            message: 'Đơn hàng đã thanh toán yêu cầu cung cấp số tài khoản ngân hàng để nhận hoàn tiền',
          });
        }

        if (order.pointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: { decrement: order.pointsEarned },
            },
          });

          await tx.loyaltyTransaction.updateMany({
            where: { orderId: order.id },
            data: {
              reversedAt: new Date(),
            },
          });
        }

        const successfulPayment = order.payments.find((p) => p.status === 'SUCCESS');
        const refString = `VIETQR:${dto.refundBank || 'MB'}:${dto.refundAccount.trim()}:PENDING`;

        if (successfulPayment) {
          await tx.payment.update({
            where: { id: successfulPayment.id },
            data: {
              refundedAmount: 0,
              refundRef: refString,
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      return {
        id: updatedOrder.id,
        code: `#${updatedOrder.id}`,
        status: updatedOrder.status,
        message: 'Đơn hàng đã được hủy thành công',
      };
    });
  }

  // Chức năng: Hàm confirmRefund(id, user, dto). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async confirmRefund(id: number, user: UserContext, dto?: ConfirmRefundDto) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền xác nhận hoàn tiền cho đơn hàng',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { payments: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'Chỉ có thể xác nhận hoàn tiền cho đơn hàng đã bị hủy',
        });
      }

      if (!dto?.refundRef?.trim()) {
        throw new BadRequestException({
          code: 'REFUND_PROOF_REQUIRED',
          message: 'Vui lòng cung cấp mã giao dịch hoặc bằng chứng chuyển khoản VietQR',
        });
      }

      const payment = order.payments.find(
        (p) => p.status === 'SUCCESS' || (p.refundRef && p.refundRef.startsWith('VIETQR')),
      );
      if (!payment) {
        throw new BadRequestException({
          code: 'NO_PAYMENT_FOUND',
          message: 'Đơn hàng không có thông tin thanh toán để hoàn tiền',
        });
      }

      if (payment.refundedAt) {
        throw new ConflictException({
          code: 'ALREADY_REFUNDED',
          message: 'Đơn hàng này đã được xác nhận hoàn tiền trước đó, không thể xác nhận lại',
        });
      }

      const proof = dto.refundRef.trim();
      const confirmedRef = payment.refundRef
        ? `${payment.refundRef}:CONFIRMED:${proof}`
        : `VIETQR:CONFIRMED:${proof}`;

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAt: new Date(),
          refundedAmount: order.total,
          refundRef: confirmedRef,
        },
      });

      return {
        orderId: order.id,
        refundedAt: updatedPayment.refundedAt,
        refundedAmount: updatedPayment.refundedAmount,
        refundRef: updatedPayment.refundRef,
        message: 'Xác nhận hoàn tiền VietQR thành công',
      };
    });
  }

  // Chức năng: Hoàn tiền đơn hủy bằng cách cộng điểm thưởng vào tài khoản khách (1 điểm = 10đ). Cách hoạt động: Cộng loyaltyPoints và đánh dấu payment đã hoàn.
  async refundPoints(id: number, user: UserContext) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền hoàn điểm cho khách',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { payments: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'Chỉ có thể hoàn điểm cho đơn hàng đã bị hủy',
        });
      }

      if (!order.userId) {
        throw new BadRequestException({
          code: 'USER_REQUIRED',
          message: 'Đơn hàng không gắn với tài khoản thành viên để cộng điểm',
        });
      }

      const payment = order.payments.find(
        (p) => p.status === 'SUCCESS' || (p.refundRef && p.refundRef.startsWith('VIETQR')),
      );
      if (!payment) {
        throw new BadRequestException({
          code: 'NO_PAYMENT_FOUND',
          message: 'Đơn hàng không có thông tin thanh toán để hoàn điểm',
        });
      }

      if (payment.refundedAt) {
        throw new ConflictException({
          code: 'ALREADY_REFUNDED',
          message: 'Đơn hàng này đã được hoàn tiền/hoàn điểm trước đó',
        });
      }

      const pointsToRefund = Math.ceil(order.total / 10);

      await tx.user.update({
        where: { id: order.userId },
        data: {
          loyaltyPoints: { increment: pointsToRefund },
        },
      });

      const refundRef = `POINTS:${pointsToRefund}`;
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAt: new Date(),
          refundedAmount: order.total,
          refundRef,
        },
      });

      return {
        orderId: order.id,
        pointsRefunded: pointsToRefund,
        refundedAt: updatedPayment.refundedAt,
        refundedAmount: updatedPayment.refundedAmount,
        refundRef: updatedPayment.refundRef,
        message: `Đã hoàn ${pointsToRefund} điểm thưởng vào tài khoản khách hàng`,
      };
    });
  }

  // Chức năng: Xử lý tính toán / định dạng dữ liệu (parseVietQrRef). Cách hoạt động: Biến đổi tham số đầu vào (refundRef) thành kết quả chuẩn để hiển thị hoặc tính toán.
  public parseVietQrRef(refundRef?: string | null): {
    bank: string;
    account: string;
    status: 'PENDING' | 'FAILED' | 'UNKNOWN' | 'COMPLETED' | null;
    extra?: string;
  } {
    if (!refundRef || !refundRef.startsWith('VIETQR:')) {
      return { bank: 'MB', account: '00000000', status: null };
    }
    const parts = refundRef.split(':');
    const bank = parts[1] || 'MB';
    const account = parts[2] || '00000000';
    let status: 'PENDING' | 'FAILED' | 'UNKNOWN' | 'COMPLETED' | null = null;
    let extra: string | undefined = undefined;

    if (refundRef.includes(':CONFIRMED:')) {
      status = 'COMPLETED';
      extra = refundRef.split(':CONFIRMED:')[1];
    } else if (refundRef.includes(':FAILED:')) {
      status = 'FAILED';
      extra = refundRef.split(':FAILED:')[1];
    } else if (refundRef.includes(':UNKNOWN:')) {
      status = 'UNKNOWN';
      extra = refundRef.split(':UNKNOWN:')[1];
    } else if (refundRef.includes(':PENDING')) {
      status = 'PENDING';
    }

    return { bank, account, status, extra };
  }

  // Chức năng: Hàm failRefund(id, user, dto). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async failRefund(id: number, user: UserContext, dto: FailRefundDto) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền cập nhật trạng thái hoàn tiền',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { payments: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'Chỉ có thể ghi nhận thất bại cho đơn hàng đã bị hủy',
        });
      }

      if (!dto?.reason?.trim()) {
        throw new BadRequestException({
          code: 'REASON_REQUIRED',
          message: 'Vui lòng cung cấp lý do chuyển tiền thất bại',
        });
      }

      const payment = order.payments.find(
        (p) => p.status === 'SUCCESS' || (p.refundRef && p.refundRef.startsWith('VIETQR')),
      );
      if (!payment) {
        throw new BadRequestException({
          code: 'NO_PAYMENT_FOUND',
          message: 'Đơn hàng không có thông tin thanh toán để hoàn tiền',
        });
      }

      if (payment.refundedAt) {
        throw new ConflictException({
          code: 'ALREADY_REFUNDED',
          message: 'Đơn hàng này đã được xác nhận hoàn tiền thành công, không thể báo thất bại',
        });
      }

      const { bank, account } = this.parseVietQrRef(payment.refundRef);
      const failedRef = `VIETQR:${bank}:${account}:FAILED:${dto.reason.trim()}`;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundRef: failedRef,
          refundedAmount: 0,
          refundedAt: null,
        },
      });

      return {
        orderId: order.id,
        refundStatus: 'FAILED',
        reason: dto.reason.trim(),
        refundRef: failedRef,
        message: 'Đã cập nhật trạng thái hoàn tiền thất bại. Barista có thể liên hệ khách hoặc bấm Thử lại.',
      };
    });
  }

  // Chức năng: Hàm holdRefund(id, user, dto). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async holdRefund(id: number, user: UserContext, dto?: HoldRefundDto) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền chuyển trạng thái đối soát',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { payments: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'Chỉ có thể chuyển đối soát cho đơn hàng đã bị hủy',
        });
      }

      const payment = order.payments.find(
        (p) => p.status === 'SUCCESS' || (p.refundRef && p.refundRef.startsWith('VIETQR')),
      );
      if (!payment) {
        throw new BadRequestException({
          code: 'NO_PAYMENT_FOUND',
          message: 'Đơn hàng không có thông tin thanh toán để hoàn tiền',
        });
      }

      if (payment.refundedAt) {
        throw new ConflictException({
          code: 'ALREADY_REFUNDED',
          message: 'Đơn hàng này đã được xác nhận hoàn tiền thành công, không thể đưa vào đối soát',
        });
      }

      const { bank, account } = this.parseVietQrRef(payment.refundRef);
      const note = dto?.note?.trim() || 'Chờ đối soát ngân hàng';
      const holdRef = `VIETQR:${bank}:${account}:UNKNOWN:${note}`;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundRef: holdRef,
          refundedAmount: 0,
          refundedAt: null,
        },
      });

      return {
        orderId: order.id,
        refundStatus: 'UNKNOWN',
        note,
        refundRef: holdRef,
        message: 'Đã chuyển giao dịch hoàn tiền sang diện nghi ngờ / đối soát ngân hàng (UNKNOWN)',
      };
    });
  }

  // Chức năng: Hàm retryRefund(id, user, dto). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async retryRefund(id: number, user: UserContext, dto?: RetryRefundDto) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền thực hiện thử lại hoàn tiền',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { payments: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      if (order.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'INVALID_STATUS',
          message: 'Chỉ có thể thử lại hoàn tiền cho đơn hàng đã bị hủy',
        });
      }

      const payment = order.payments.find(
        (p) => p.status === 'SUCCESS' || (p.refundRef && p.refundRef.startsWith('VIETQR')),
      );
      if (!payment) {
        throw new BadRequestException({
          code: 'NO_PAYMENT_FOUND',
          message: 'Đơn hàng không có thông tin thanh toán để hoàn tiền',
        });
      }

      if (payment.refundedAt) {
        throw new ConflictException({
          code: 'ALREADY_REFUNDED',
          message: 'Đơn hàng này đã được xác nhận hoàn tiền thành công, không thể thử lại',
        });
      }

      const { bank, account, status: currentRefundStatus } = this.parseVietQrRef(payment.refundRef);

      if (currentRefundStatus === 'UNKNOWN') {
        throw new BadRequestException({
          code: 'REFUND_IN_RECONCILIATION',
          message:
            'Giao dịch đang ở trạng thái Đối soát (UNKNOWN), tuyệt đối không được thử lại ngay để tránh hoàn tiền trùng lặp cho khách hàng',
        });
      }

      const targetBank = dto?.refundBank?.trim() || bank;
      const targetAccount = dto?.refundAccount?.trim() || account;
      const pendingRef = `VIETQR:${targetBank}:${targetAccount}:PENDING`;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundRef: pendingRef,
          refundedAmount: 0,
          refundedAt: null,
        },
      });

      return {
        orderId: order.id,
        refundStatus: 'PENDING',
        refundBank: targetBank,
        refundAccount: targetAccount,
        refundRef: pendingRef,
        message: 'Đã đặt lại trạng thái hoàn tiền về PENDING để thử lại',
      };
    });
  }

  // Chức năng: Hàm cancelOrderInternal(id). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async cancelOrderInternal(id: number) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!order) return null;
      if (order.status === OrderStatus.CANCELLED) return order;

      const hasProcessingPayment = order.payments.some((p) => p.status === 'PROCESSING');
      if (hasProcessingPayment) {
        return null;
      }

      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED) {
        return null;
      }

      await this.releaseStock(tx, order);

      if (order.promoCode) {
        await tx.promoCode.update({
          where: { code: order.promoCode },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }

      if (order.pointsUsed > 0 && order.userId) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: { increment: order.pointsUsed },
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      return updatedOrder;
    });
  }

  // Chức năng: Hàm cancelExpiredOrders. Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  async cancelExpiredOrders(): Promise<number> {
    const expiredBefore = new Date(Date.now() - ORDER_PAYMENT_TIMEOUT_MS);
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
        createdAt: { lt: expiredBefore },
      },
      select: { id: true },
    });

    let count = 0;
    for (const item of expiredOrders) {
      try {
        const res = await this.cancelOrderInternal(item.id);
        if (res) count++;
      } catch {
        // Tiếp tục quét các đơn khác nếu có đơn bị lỗi
      }
    }
    return count;
  }

  // Chức năng: Chuyển đổi trạng thái đơn hàng theo máy trạng thái. Cách hoạt động: Kiểm tra transition hợp lệ, nếu lên COMPLETED thì gọi LoyaltyService cộng điểm thưởng cho khách.
  async updateOrderStatus(id: number, nextStatus: OrderStatus, user: UserContext) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền đổi trạng thái đơn hàng',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: `Không tìm thấy đơn hàng #${id}`,
        });
      }

      assertTransition(order.status, nextStatus);

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
        },
      });

      if (nextStatus === OrderStatus.PAID) {
        const existingProcessing = await tx.payment.findFirst({
          where: { orderId: order.id, status: PaymentStatus.PROCESSING },
        });

        if (existingProcessing) {
          await tx.payment.update({
            where: { id: existingProcessing.id },
            data: { status: PaymentStatus.SUCCESS },
          });
        } else {
          const existingAny = await tx.payment.findFirst({
            where: { orderId: order.id },
          });
          if (!existingAny) {
            await tx.payment.create({
              data: {
                orderId: order.id,
                amount: order.total,
                method: 'WALLET',
                status: PaymentStatus.SUCCESS,
                idempotencyKey: `WALLET-QR-${order.id}-${Date.now()}`,
                requestHash: `HASH-WALLET-${order.id}`,
              },
            });
          }
        }

        if (order.userId) {
          const points = Math.floor(order.total / 1000);
          if (points > 0) {
            const existingTransaction = await tx.loyaltyTransaction.findUnique({
              where: { orderId: order.id },
            });
            if (!existingTransaction) {
              await tx.loyaltyTransaction.create({
                data: {
                  userId: order.userId,
                  orderId: order.id,
                  points: points,
                },
              });
              await tx.user.update({
                where: { id: order.userId },
                data: { loyaltyPoints: { increment: points } },
              });
              await tx.order.update({
                where: { id: order.id },
                data: { pointsEarned: points },
              });
            }
          }
        }
      }

      return {
        id: updated.id,
        code: `#${updated.id}`,
        status: updated.status,
      };
    });
  }

  // Chức năng: Lấy dữ liệu BaristaOrders. Cách hoạt động: Truy vấn dữ liệu từ PostgreSQL qua Prisma và trả về kết quả đã định dạng.
  async getBaristaOrders(query: { status?: string; page?: number; limit?: number }, user: UserContext) {
    if (user.role !== Role.BARISTA && user.role !== Role.MANAGER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista hoặc Manager mới có quyền xem hàng đợi đơn hàng',
      });
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    let statuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ];
    if (query.status?.trim()) {
      statuses = query.status.split(',').map((s) => s.trim()) as OrderStatus[];
    }

    const where = {
      status: { in: statuses },
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Mới nhất lên đầu
        include: {
          user: {
            select: { fullName: true },
          },
          items: true,
          payments: {
            select: {
              id: true,
              method: true,
              status: true,
              amount: true,
              refundedAt: true,
              refundedAmount: true,
              refundRef: true,
            },
          },
        },
      }),
    ]);

    const data = orders.map((order) => {
      const refundPayment = order.payments?.find(
        (p) => p.status === 'SUCCESS' || p.refundedAt || (p.refundRef && p.refundRef.startsWith('VIETQR')),
      );
      const parsedRef = this.parseVietQrRef(refundPayment?.refundRef);
      const isRefunded = Boolean(refundPayment?.refundedAt);
      const refundStatus = isRefunded ? 'COMPLETED' : parsedRef.status;

      return {
        id: order.id,
        code: `#${order.id}`,
        status: order.status,
        total: order.total,
        customerName: order.user?.fullName || 'Khách hàng',
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          productName: item.productName,
          size: item.size,
          qty: item.qty,
          toppings: item.toppings,
          note: item.note,
        })),
        isRefunded,
        refundStatus,
        refundBank: parsedRef.bank,
        refundAccount: parsedRef.account,
        refundExtra: parsedRef.extra || null,
        refundRef: refundPayment?.refundRef || null,
        refundedAt: refundPayment?.refundedAt ? refundPayment.refundedAt.toISOString() : null,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Chức năng: Hàm reserveStock(tx, items). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  private async reserveStock(tx: any, items: CreateOrderItemDto[]) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const toppingIds = [...new Set(items.flatMap((i) => i.toppingIds ?? []))];

    const [products, toppings] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: productIds } },
        include: { productRecipes: true },
      }),
      toppingIds.length > 0
        ? tx.topping.findMany({
            where: { id: { in: toppingIds } },
            include: { toppingRecipes: true },
          })
        : Promise.resolve([]),
    ]);

    const productMap = new Map<number, any>(products.map((p: any) => [p.id, p]));
    const toppingMap = new Map<number, any>(toppings.map((t: any) => [t.id, t]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: `Không tìm thấy sản phẩm #${item.productId}`,
          details: [{ productId: item.productId }],
        });
      }
      if (!product.productRecipes || product.productRecipes.length === 0) {
        throw new ConflictException({
          code: 'RECIPE_MISSING',
          message: `Sản phẩm '${product.name}' chưa có công thức`,
          details: [{ productId: product.id }],
        });
      }
    }

    const lineConsumptions: { ingredientId: number; quantity: number }[][] = [];
    const ingredientAffectedProducts = new Map<number, Set<string>>();
    const orderNeedsMap = new Map<number, number>();

    for (const item of items) {
      const product = productMap.get(item.productId)!;
      const itemToppings = (item.toppingIds ?? [])
        .map((id) => toppingMap.get(id))
        .filter(Boolean);

      const lineMap = this.recipeService.calculateLine(
        {
          id: product.id,
          name: product.name,
          recipes: product.productRecipes,
        },
        item.size,
        itemToppings.map((t: any) => ({
          id: t.id,
          name: t.name,
          recipes: t.toppingRecipes,
        })),
        item.quantity,
      );

      const consumption: { ingredientId: number; quantity: number }[] = [];
      for (const [ingredientId, amount] of lineMap.entries()) {
        consumption.push({ ingredientId, quantity: amount });
        orderNeedsMap.set(ingredientId, (orderNeedsMap.get(ingredientId) || 0) + amount);

        let productSet = ingredientAffectedProducts.get(ingredientId);
        if (!productSet) {
          productSet = new Set<string>();
          ingredientAffectedProducts.set(ingredientId, productSet);
        }
        productSet.add(product.name);
      }
      lineConsumptions.push(consumption);
    }

    const sortedIngredientIds = [...orderNeedsMap.keys()].sort((a, b) => a - b);

    for (const ingredientId of sortedIngredientIds) {
      const neededQty = orderNeedsMap.get(ingredientId)!;
      const current = await tx.ingredient.findUnique({
        where: { id: ingredientId },
        select: { id: true, name: true, stock: true, version: true },
      });

      if (!current) {
        throw new NotFoundException({
          code: 'INGREDIENT_NOT_FOUND',
          message: `Không tìm thấy nguyên liệu #${ingredientId}`,
        });
      }

      const affectedProducts = Array.from(ingredientAffectedProducts.get(ingredientId) || []);

      if (current.stock < neededQty) {
        throw new ConflictException({
          code: 'OUT_OF_STOCK',
          message: `Không đủ ${current.name} để pha chế`,
          details: [
            {
              ingredientId: current.id,
              ingredient: current.name,
              available: current.stock,
              required: neededQty,
              products: affectedProducts,
            },
          ],
        });
      }

      const res = await tx.ingredient.updateMany({
        where: {
          id: ingredientId,
          version: current.version,
          stock: { gte: neededQty },
        },
        data: {
          stock: { decrement: neededQty },
          version: { increment: 1 },
        },
      });

      if (res.count === 0) {
        const latest = await tx.ingredient.findUnique({ where: { id: ingredientId } });
        if (!latest || latest.stock < neededQty) {
          throw new ConflictException({
            code: 'OUT_OF_STOCK',
            message: `Không đủ ${current.name} để pha chế`,
            details: [
              {
                ingredientId: current.id,
                ingredient: current.name,
                available: latest?.stock ?? 0,
                required: neededQty,
                products: affectedProducts,
              },
            ],
          });
        }
        throw new Error('STOCK_RETRY');
      }
    }

    return { lineConsumptions, orderNeedsMap };
  }

  // Chức năng: Hàm releaseStock(tx, order). Cách hoạt động: Thực thi logic xử lý nghiệp vụ của module và trả về kết quả cho nơi gọi.
  private async releaseStock(tx: any, order: { id: number; items: any[] }) {
    const releaseMap = new Map<number, number>();
    for (const item of order.items) {
      const consumption = (item.consumption as { ingredientId: number; quantity: number }[]) || [];
      for (const c of consumption) {
        releaseMap.set(c.ingredientId, (releaseMap.get(c.ingredientId) || 0) + c.quantity);
      }
    }

    const sortedIngredientIds = [...releaseMap.keys()].sort((a, b) => a - b);
    for (const ingredientId of sortedIngredientIds) {
      const qty = releaseMap.get(ingredientId)!;
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stock: { increment: qty },
          version: { increment: 1 },
        },
      });

      await tx.stockMovement.create({
        data: {
          ingredientId,
          type: 'ORDER_RELEASE',
          quantity: qty,
          orderId: order.id,
        },
      });
    }
  }
}