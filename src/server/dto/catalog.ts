import { z } from 'zod';

export const PRODUCT_SORTS = ['default', 'sales', 'price_asc', 'price_desc', 'newest'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const SORT_LABELS: Record<ProductSort, string> = {
  default: '综合',
  sales: '销量',
  price_asc: '价格升序',
  price_desc: '价格降序',
  newest: '新品',
};

export const PAGE_SIZE = 20;

/** 搜索/列表查询参数（来自 URL searchParams，单位：价格为元） */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v ? v : undefined)),
  cat: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v ? v : undefined)),
  min: z.coerce.number().min(0).max(10_000_000).optional().catch(undefined),
  max: z.coerce.number().min(0).max(10_000_000).optional().catch(undefined),
  sort: z.enum(PRODUCT_SORTS).catch('default'),
  page: z.coerce.number().int().min(1).catch(1),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** 从 Next searchParams（值可能是数组）取单值 */
export function pickSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export function parseSearchQuery(sp: Record<string, string | string[] | undefined>): SearchQuery {
  return searchQuerySchema.parse(pickSearchParams(sp));
}

export const addToCartSchema = z.object({
  skuId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;
