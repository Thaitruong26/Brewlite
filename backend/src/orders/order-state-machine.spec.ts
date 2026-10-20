
import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  ORDER_TRANSITIONS,
  type OrderStatus,
} from './order-state-machine.js';

describe('Order State Machine', () => {
  it('cho phép luồng thành công từ PENDING đến COMPLETED', () => {
    const transitions: [OrderStatus, OrderStatus][] = [
      ['PENDING', 'PAID'],
      ['PAID', 'PREPARING'],
      ['PREPARING', 'READY'],
      ['READY', 'COMPLETED'],
    ];

    for (const [currentStatus, nextStatus] of transitions) {
      expect(() => assertTransition(currentStatus, nextStatus))
        .not.toThrow();
    }
  });

  it('chặn nhảy từ PENDING thẳng sang COMPLETED', () => {
    expect(() => assertTransition('PENDING', 'COMPLETED'))
      .toThrowError(
        expect.objectContaining({
          response: expect.objectContaining({
            code: 'INVALID_TRANSITION',
          }),
        }),
      );
  });

  it('không cho chuyển tiếp từ trạng thái kết thúc', () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);

    expect(() => assertTransition('COMPLETED', 'CANCELLED'))
      .toThrow();

    expect(() => assertTransition('CANCELLED', 'PENDING'))
      .toThrow();
  });

  it('cho phép thanh toán thất bại được thử lại', () => {
    expect(() => assertTransition('PENDING', 'PAYMENT_FAILED'))
      .not.toThrow();

    expect(() => assertTransition('PAYMENT_FAILED', 'PAID'))
      .not.toThrow();
  });

  it('chặn chuyển trạng thái sai thứ tự', () => {
    expect(() => assertTransition('PAID', 'READY')).toThrow();
    expect(() => assertTransition('PREPARING', 'COMPLETED')).toThrow();
  });
});
