import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatePaymentDto,
  MockPaymentResult,
} from './dto/create-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPayment(
    dto: CreatePaymentDto,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key is required');
    }

    const normalized = {
      orderId: dto.orderId,
      method: dto.method,
      mockResult: dto.mockResult ?? null,
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

     if (existing.status === 'FAILED') {
  const snapshot = existing.responseSnapshot;

  throw new HttpException(
    snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? snapshot
      : { message: 'Payment failed' },
    402,
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

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        'Order is not available for payment',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: dto.method,
        status: 'PROCESSING',
        idempotencyKey,
        requestHash,
      },
    });

    const success = dto.mockResult !== MockPaymentResult.FAILED;

    const response = {
      paymentId: payment.id,
      orderId: order.id,
      amount: order.total,
      method: dto.method,
      status: success ? 'SUCCESS' : 'FAILED',
    };

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          responseSnapshot: response,
          failureReason: success ? null : 'Mock payment failure',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: success ? 'PAID' : 'PAYMENT_FAILED',
        },
      });

      if (!success) {
        throw new HttpException(response, 402);
      }

      return updatedPayment.responseSnapshot ?? response;
    });
  }
}
