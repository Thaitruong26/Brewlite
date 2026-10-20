
import { ConflictException } from '@nestjs/common';

export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PREPARING',
  'READY',
  'COMPLETED',
  'PAYMENT_FAILED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Các chuyển trạng thái hợp lệ theo BrewLite API v1.1.
 * COMPLETED và CANCELLED là trạng thái kết thúc.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  PAYMENT_FAILED: ['PAID', 'CANCELLED'],
  CANCELLED: [],
};

export function assertTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): void {
  const allowedStatuses = ORDER_TRANSITIONS[currentStatus];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new ConflictException({
      code: 'INVALID_TRANSITION',
      message: `Không thể chuyển trạng thái đơn hàng từ ${currentStatus} sang ${nextStatus}`,
    });
  }
}
