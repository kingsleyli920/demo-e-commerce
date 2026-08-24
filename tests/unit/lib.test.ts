import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPrice, yuanToFen } from '@/lib/format';
import { calcFreight, FREE_SHIPPING_THRESHOLD, FREIGHT_FEE } from '@/lib/freight';
import { generateOrderNo, ORDER_NO_PATTERN } from '@/lib/order-no';
import { buildSpecKey } from '@/lib/spec-key';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';
import { AppError, isAppError, toUserMessage } from '@/server/errors';

describe('lib/spec-key', () => {
  it('按属性名排序、与输入顺序无关', () => {
    expect(buildSpecKey({ 颜色: '黑色', 版本: '标准版' })).toBe(
      buildSpecKey({ 版本: '标准版', 颜色: '黑色' }),
    );
    expect(buildSpecKey({ 颜色: '黑色', 版本: '标准版' })).toBe('版本:标准版|颜色:黑色');
  });
  it('空规格得到空串', () => {
    expect(buildSpecKey({})).toBe('');
  });
});

describe('lib/format', () => {
  it('formatPrice 分 → 元（两位小数，千分位）', () => {
    expect(formatPrice(0)).toBe('¥0.00');
    expect(formatPrice(990)).toBe('¥9.90');
    expect(formatPrice(123450)).toBe('¥1,234.50');
  });
  it('yuanToFen', () => {
    expect(yuanToFen('12.34')).toBe(1234);
    expect(yuanToFen(0.1)).toBe(10);
    expect(yuanToFen('')).toBeNull();
    expect(yuanToFen('abc')).toBeNull();
    expect(yuanToFen(-1)).toBeNull();
    expect(yuanToFen(null)).toBeNull();
  });
  it('formatDateTime', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02 03:04:05');
    expect(formatDateTime('2026-01-02T03:04:05')).toMatch(/^2026-01-02 /);
  });
});

describe('lib/freight', () => {
  it('边界：9899 收运费，9900 免运费', () => {
    expect(calcFreight(FREE_SHIPPING_THRESHOLD - 1)).toBe(FREIGHT_FEE);
    expect(calcFreight(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(calcFreight(0)).toBe(FREIGHT_FEE);
  });
});

describe('lib/order-no', () => {
  it('格式 ORD + 14 位时间 + 4 位随机', () => {
    const no = generateOrderNo(new Date(2026, 7, 23, 1, 2, 3), () => 0.1234);
    expect(no).toBe('ORD202608230102031234');
    expect(no).toMatch(ORDER_NO_PATTERN);
    expect(generateOrderNo()).toMatch(ORDER_NO_PATTERN);
  });
});

describe('demo accounts', () => {
  it('两个演示账号角色正确', () => {
    expect(DEMO_ACCOUNTS.buyer.role).toBe('buyer');
    expect(DEMO_ACCOUNTS.admin.role).toBe('admin');
    expect(DEMO_ACCOUNTS.buyer.email).toBe('demo@shop.local');
  });
});

describe('AppError', () => {
  it('默认状态码与 toUserMessage', () => {
    const e = new AppError('INSUFFICIENT_STOCK', '库存不足: x');
    expect(e.status).toBe(409);
    expect(isAppError(e)).toBe(true);
    expect(toUserMessage(e)).toBe('库存不足: x');
    expect(toUserMessage(new Error('boom'))).toBe('boom');
    expect(toUserMessage('x')).toBe('操作失败，请稍后重试');
    expect(new AppError('NOT_FOUND', 'nf', { status: 410 }).status).toBe(410);
  });
});
