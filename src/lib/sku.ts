import type { ProductAttribute, SkuSpec } from '@/server/db/schema';

export type SkuLike = { spec: SkuSpec; status: 'on' | 'off' };
export type AttributeOption = { value: string; disabled: boolean };

/**
 * 规格选项置灰：对每个属性的每个候选值，判断「在其它已选维度不变的前提下」是否存在上架 SKU。
 * 售罄 SKU 仍可选（由 stockHint 负责「已售罄」禁购）。
 */
export function availableOptions(
  attributes: ProductAttribute[],
  skuList: SkuLike[],
  selected: SkuSpec,
): Record<string, AttributeOption[]> {
  const onSale = skuList.filter((s) => s.status === 'on');
  const result: Record<string, AttributeOption[]> = {};
  for (const attr of attributes) {
    result[attr.name] = attr.values.map((value) => {
      const candidate: SkuSpec = { ...selected, [attr.name]: value };
      const ok = onSale.some((s) => Object.entries(candidate).every(([k, v]) => s.spec[k] === v));
      return { value, disabled: !ok };
    });
  }
  return result;
}

/** 选满所有维度？ */
export function isSpecComplete(attributes: ProductAttribute[], selected: SkuSpec): boolean {
  return attributes.every((a) => typeof selected[a.name] === 'string' && selected[a.name] !== '');
}

/** 价格区间（全部上架 SKU）：[min, max]；无上架 SKU → null */
export function priceRange(skuList: { price: number; status: 'on' | 'off' }[]): [number, number] | null {
  const on = skuList.filter((s) => s.status === 'on').map((s) => s.price);
  if (on.length === 0) return null;
  return [Math.min(...on), Math.max(...on)];
}
