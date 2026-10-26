import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../common/pricing/pricing.service.js';
import { assertTransition } from './order-state.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';

export interface UserContext {
  id: number;
  role?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Task 6 & Task 10: POST /orders
   * Tạo đơn hàng ở trạng thái PENDING từ giỏ hàng.
   * Tính lại giá bằng PricingService (không tin giá client).
   * Kiểm soát tồn kho bằng transaction và optimistic locking (Product.version).
   */
  async createOrder(userId: number, dto: CreateOrderDto) {
    // 1. Tổng hợp số lượng tồn kho cần cho từng productId (tránh trường hợp cùng 1 sản phẩm đặt nhiều size)
    const requiredStock = new Map<number, number>();
    for (const item of dto.items) {
      const current = requiredStock.get(item.productId) || 0;
      requiredStock.set(item.productId, current + item.quantity);
    }

    // Sắp xếp productId tăng dần để phòng tránh deadlock trong transaction
    const sortedProductIds = [...requiredStock.keys()].sort((a, b) => a - b);

    const MAX_RETRIES = 10;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // 2. Giữ tồn kho bằng optimistic locking (Product.version)
          for (const productId of sortedProductIds) {
            const neededQty = requiredStock.get(productId)!;
            const current = await tx.product.findUnique({
              where: { id: productId },
              select: { id: true, name: true, stock: true, version: true, isActive: true },
            });

            if (!current || !current.isActive) {
              throw new NotFoundException({
                code: 'PRODUCT_NOT_FOUND',
                message: `Không tìm thấy sản phẩm #${productId}`,
                details: [{ productId }],
              });
            }

            if (current.stock < neededQty) {
              throw new ConflictException({
                code: 'OUT_OF_STOCK',
                message: `Sản phẩm '${current.name}' chỉ còn ${current.stock} phần`,
                details: [{ productId: current.id, available: current.stock, requested: neededQty }],
              });
            }

            // Trừ kho có điều kiện version và stock >= neededQty
            const res = await tx.product.updateMany({
              where: {
                id: productId,
                version: current.version,
                stock: { gte: neededQty },
              },
              data: {
                stock: { decrement: neededQty },
                version: { increment: 1 },
              },
            });

            if (res.count === 0) {
              // Kiểm tra xem thật sự hết hàng hay do tranh chấp version
              const latest = await tx.product.findUnique({ where: { id: productId } });
              if (!latest || latest.stock < neededQty) {
                throw new ConflictException({
                  code: 'OUT_OF_STOCK',
                  message: `Sản phẩm '${current.name}' chỉ còn ${latest?.stock ?? 0} phần`,
                  details: [{ productId: current.id, available: latest?.stock ?? 0, requested: neededQty }],
                });
              }
              // Còn hàng nhưng version đã bị đổi bởi request khác: ném STOCK_RETRY để thử lại
              throw new Error('STOCK_RETRY');
            }
          }

          // 3. Tính lại giá trên server (nguồn chân lý duy nhất)
          const pricing = await this.pricingService.calculate(dto.items, tx);
          const subtotal = pricing.subtotal;
          let discountAmount = 0;

          // 4. Áp dụng mã giảm giá (nếu có)
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

            // Tính số tiền giảm
            if (promo.type === 'PERCENT') {
              discountAmount = Math.floor((subtotal * promo.value) / 100);
              if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
                discountAmount = promo.maxDiscount;
              }
            } else {
              discountAmount = promo.value;
            }
            if (discountAmount > subtotal) discountAmount = subtotal;

            // Tăng usedCount nguyên tử trong cùng transaction
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

          const total = subtotal - discountAmount;

          // 5. Lưu Order và OrderItem (chụp snapshot tên, topping, giá)
          const newOrder = await tx.order.create({
            data: {
              userId,
              status: OrderStatus.PENDING,
              subtotal,
              discountAmount,
              total,
              promoCode: dto.promoCode || null,
              pointsEarned: 0,
              items: {
                create: pricing.lines.map((line) => ({
                  productId: line.productId,
                  productName: line.productName,
                  size: line.size,
                  toppings: line.toppings,
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
            createdAt: newOrder.createdAt.toISOString(),
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
          // Nghỉ ngẫu nhiên 10 đến 50 ms rồi thử lại cả transaction
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 41) + 10),
          );
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Task 9: GET /orders/me
   * Lịch sử đơn hàng của người dùng hiện tại (chỉ lấy đơn của req.user.id), sắp xếp mới nhất trước.
   */
  async getOrdersMe(userId: number, query: GetOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
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
          items: {
            select: { qty: true },
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
        total: order.total,
        itemCount,
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

  /**
   * Task 9: GET /orders/:id
   * Chi tiết đơn hàng (kèm items, payments, pointsEarned).
   * Khách chỉ xem được đơn của mình, Barista được xem mọi đơn.
   */
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

    if (order.userId !== user.id && user.role !== Role.BARISTA) {
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
      payments: order.payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        method: p.method,
        status: p.status,
        providerRef: p.providerRef,
        createdAt: p.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  /**
   * Task 10: POST /orders/:id/cancel
   * Hủy đơn hàng: hoàn kho, hoàn lượt dùng mã giảm giá, hoàn tiền/thu hồi điểm nếu đơn đã PAID.
   */
  async cancelOrder(id: number, user: UserContext) {
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

      if (order.userId !== user.id && user.role !== Role.BARISTA) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền hủy đơn hàng này',
        });
      }

      // Kiểm tra xem có giao dịch đang thanh toán dở dang không
      const hasProcessingPayment = order.payments.some((p) => p.status === 'PROCESSING');
      if (hasProcessingPayment) {
        throw new ConflictException({
          code: 'PAYMENT_IN_PROGRESS',
          message: 'Đơn hàng đang có giao dịch thanh toán đang xử lý, không thể hủy lúc này',
        });
      }

      // Kiểm tra chuyển trạng thái qua State Machine
      assertTransition(order.status, OrderStatus.CANCELLED);

      // 1. Hoàn kho cho từng sản phẩm
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
            version: { increment: 1 },
          },
        });
      }

      // 2. Hoàn lại số lượt sử dụng mã giảm giá (usedCount)
      if (order.promoCode) {
        await tx.promoCode.update({
          where: { code: order.promoCode },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }

      // 3. Nếu đơn đã PAID: thu hồi điểm thưởng và ghi nhận hoàn tiền mock
      if (order.status === OrderStatus.PAID) {
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

        // Cập nhật Payment ghi nhận hoàn tiền mock
        const successfulPayment = order.payments.find((p) => p.status === 'SUCCESS');
        if (successfulPayment) {
          await tx.payment.update({
            where: { id: successfulPayment.id },
            data: {
              refundedAt: new Date(),
              refundedAmount: order.total,
              refundRef: `MOCK-REFUND-${Date.now()}`,
            },
          });
        }
      }

      // 4. Đổi trạng thái sang CANCELLED
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

  /**
   * Task 10 & Barista: PATCH /orders/:id/status
   * Barista chuyển bước đơn hàng: PAID → PREPARING → READY → COMPLETED
   */
  async updateOrderStatus(id: number, nextStatus: OrderStatus, user: UserContext) {
    if (user.role !== Role.BARISTA) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista mới có quyền đổi trạng thái đơn hàng',
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

      // Kiểm tra chuyển tiếp hợp lệ qua State Machine
      assertTransition(order.status, nextStatus);

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
        },
      });

      return {
        id: updated.id,
        code: `#${updated.id}`,
        status: updated.status,
      };
    });
  }

  /**
   * Barista Queue: GET /orders (Mở rộng Barista - Mục 6.15)
   * Hàng đợi phục vụ cho nhân viên Barista: lọc status (mặc định PAID, PREPARING, READY),
   * sắp xếp createdAt tăng dần (cũ nhất lên đầu).
   */
  async getBaristaOrders(query: { status?: string; page?: number; limit?: number }, user: UserContext) {
    if (user.role !== Role.BARISTA) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ nhân viên Barista mới có quyền xem hàng đợi đơn hàng',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let statuses: OrderStatus[] = [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY];
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
        orderBy: { createdAt: 'asc' }, // Cũ nhất lên đầu theo thứ tự đến quầy
        include: {
          user: {
            select: { fullName: true },
          },
          items: true,
        },
      }),
    ]);

    const data = orders.map((order) => ({
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
    }));

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
}