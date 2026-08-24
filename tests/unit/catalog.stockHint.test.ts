import { describe, expect, it } from 'vitest';
import { availableStock, stockHint } from '@/server/services/inventory';

describe('库存提示', () => {
  it('可售 = stock - locked，且不为负', () => {
    expect(availableStock({ stock: 10, lockedStock: 3 })).toBe(7);
    expect(availableStock({ stock: 3, lockedStock: 3 })).toBe(0);
    expect(availableStock({ stock: 2, lockedStock: 5 })).toBe(0);
  });
  it('>5 不提示；1–5 仅剩 N 件；0 已售罄', () => {
    expect(stockHint(6)).toEqual({ available: 6, text: null, soldOut: false });
    expect(stockHint(5)).toEqual({ available: 5, text: '仅剩 5 件', soldOut: false });
    expect(stockHint(1)).toEqual({ available: 1, text: '仅剩 1 件', soldOut: false });
    expect(stockHint(0)).toEqual({ available: 0, text: '已售罄', soldOut: true });
    expect(stockHint(-3)).toEqual({ available: 0, text: '已售罄', soldOut: true });
  });
});
