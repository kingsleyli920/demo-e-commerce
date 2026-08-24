import { describe, expect, it } from 'vitest';
import { AppError } from '@/server/errors';
import {
  assertTransition,
  ORDER_TRANSITIONS,
  transitionTimestampField,
} from '@/server/services/order';

describe('订单状态机', () => {
  it('合法迁移各一例', () => {
    expect(() => assertTransition('PENDING_PAYMENT', 'PAID')).not.toThrow();
    expect(() => assertTransition('PENDING_PAYMENT', 'CANCELLED')).not.toThrow();
    expect(() => assertTransition('PAID', 'SHIPPED')).not.toThrow();
    expect(() => assertTransition('SHIPPED', 'COMPLETED')).not.toThrow();
  });

  it('非法迁移抛错', () => {
    const bad: Array<[string, string]> = [
      ['PAID', 'CANCELLED'],
      ['COMPLETED', 'SHIPPED'],
      ['CANCELLED', 'PAID'],
      ['SHIPPED', 'PAID'],
      ['PENDING_PAYMENT', 'SHIPPED'],
      ['PENDING_PAYMENT', 'COMPLETED'],
      ['COMPLETED', 'CANCELLED'],
    ];
    for (const [from, to] of bad) {
      expect(() => assertTransition(from as never, to as never), `${from}→${to}`).toThrowError(
        AppError,
      );
    }
  });

  it('迁移写对应时间戳字段', () => {
    expect(transitionTimestampField('PAID')).toBe('paidAt');
    expect(transitionTimestampField('SHIPPED')).toBe('shippedAt');
    expect(transitionTimestampField('COMPLETED')).toBe('completedAt');
    expect(transitionTimestampField('CANCELLED')).toBe('cancelledAt');
  });

  it('终态无出边', () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
