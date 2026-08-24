/**
 * 把 SKU 规格对象按属性名排序后序列化为稳定字符串，用于 unique(product_id, spec_key)。
 * 例：{ 版本: '标准版', 颜色: '黑色' } → "版本:标准版|颜色:黑色"
 */
export function buildSpecKey(spec: Record<string, string>): string {
  return Object.keys(spec)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    .map((k) => `${k}:${spec[k]}`)
    .join('|');
}
