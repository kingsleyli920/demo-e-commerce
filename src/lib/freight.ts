/** 运费规则：商品合计 ≥ 9900 分免运费，否则 1000 分 */
export const FREE_SHIPPING_THRESHOLD = 9900;
export const FREIGHT_FEE = 1000;

export function calcFreight(totalAmount: number): number {
  return totalAmount >= FREE_SHIPPING_THRESHOLD ? 0 : FREIGHT_FEE;
}
