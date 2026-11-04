import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // Khách tạo phiên thanh toán
  async createPayment(
    dto: CreatePaymentDto,
    idempotencyKey: string,
    user?: { id: number; role?: string },
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key is required');
    }

    const normalized = {
      orderId: dto.orderId,
      method: dto.method,
    };

    const requestHash = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key was used with a different request',
        );
      }

      return existing.responseSnapshot ?? existing;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user && order.userId !== user.id && user.role !== 'BARISTA') {
      throw new ForbiddenException(
        'Bạn không có quyền thanh toán đơn hàng này',
      );
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        'Order is not available for payment',
      );
    }

    const activePayment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: { in: ['PROCESSING', 'SUCCESS'] },
      },
    });

    if (activePayment) {
      if (activePayment.status === 'SUCCESS') {
        throw new ConflictException(
          'Đơn hàng này đã được thanh toán thành công',
        );
      }

      throw new ConflictException(
        'Đơn hàng đang có một giao dịch thanh toán khác đang xử lý',
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let payment;

    try {
      payment = await this.prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.total,
          method: dto.method,
          status: 'PROCESSING',
          idempotencyKey,
          requestHash,
          expiresAt,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'Đơn hàng đang có một giao dịch thanh toán khác',
        );
      }
      throw err;
    }

    const response = {
      paymentId: payment.id,
      orderId: order.id,
      amount: order.total,
      method: dto.method,
      status: 'PROCESSING',
      expiresAt,
      message: 'Waiting for Barista payment confirmation',
    };

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { responseSnapshot: response },
    });

    return response;
  }

  // Barista xác nhận đã nhận được tiền
  async confirmPayment(paymentId: number, user: any) {
    if (user?.role !== 'BARISTA') {
      throw new ForbiddenException(
        'Only Barista can confirm payment',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== 'PROCESSING') {
        throw new ConflictException(
          'Payment is not processing',
        );
      }

      if (
        !payment.expiresAt ||
        payment.expiresAt.getTime() <= Date.now()
      ) {
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'EXPIRED' },
        });

        return { status: 'EXPIRED' };
      }

      if (payment.order.status !== 'PENDING') {
        throw new ConflictException(
          'Order is not available for payment',
        );
      }

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          responseSnapshot: {
            paymentId: payment.id,
            orderId: payment.orderId,
            amount: payment.amount,
            method: payment.method,
            status: 'SUCCESS',
          },
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAID' },
      });

      await this.loyaltyService.award(tx, payment.order);

      return updatedPayment.responseSnapshot ?? updatedPayment;
    });
  }
}