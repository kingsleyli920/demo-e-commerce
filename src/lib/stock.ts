/** 可售库存 = stock - locked_stock（不为负） */
export function availableStock(sku: { stock: number; lockedStock: number }): number {
  return Math.max(0, sku.stock - sku.lockedStock);
}

export type StockHint = { available: number; text: string | null; soldOut: boolean };

/** 详情页库存提示：>5 不提示；1–5「仅剩 N 件」；0「已售罄」 */
export function stockHint(available: number): StockHint {
  const n = Math.max(0, available);
  if (n === 0) return { available: 0, text: '已售罄', soldOut: true };
  if (n <= 5) return { available: n, text: `仅剩 ${n} 件`, soldOut: false };
  return { available: n, text: null, soldOut: false };
}
