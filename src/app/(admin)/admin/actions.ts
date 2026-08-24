'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/guards';
import { isAppError, toUserMessage } from '@/server/errors';
import { setProductStatus, updateSku } from '@/server/services/admin';
import { expireOrders, shipOrder } from '@/server/services/order';

export type AdminActionResult = { ok: boolean; message?: string };

async function run(fn: () => Promise<string | void>): Promise<AdminActionResult> {
  await requireAdmin('/admin');
  try {
    const msg = await fn();
    return { ok: true, message: msg ?? undefined };
  } catch (e) {
    return { ok: false, message: isAppError(e) ? e.message : toUserMessage(e) };
  }
}

export async function toggleProductStatusAction(
  productId: number,
  status: 'on' | 'off',
): Promise<AdminActionResult> {
  return run(async () => {
    await setProductStatus(productId, status);
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productId}`);
    return status === 'on' ? '商品已上架' : '商品已下架';
  });
}

const updateSkuSchema = z.object({
  skuId: z.coerce.number().int().positive(),
  priceYuan: z.coerce.number().min(0).max(100000),
  originalPriceYuan: z
    .union([z.literal(''), z.coerce.number().min(0).max(100000)])
    .transform((v) => (v === '' ? null : v)),
  stock: z.coerce.number().int().min(0).max(100000),
});

export async function updateSkuAction(
  _prev: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return run(async () => {
    const parsed = updateSkuSchema.safeParse({
      skuId: formData.get('skuId'),
      priceYuan: formData.get('priceYuan'),
      originalPriceYuan: formData.get('originalPriceYuan') ?? '',
      stock: formData.get('stock'),
    });
    if (!parsed.success)
      throw Object.assign(new Error(parsed.error.issues[0]?.message ?? '参数错误'));
    const d = parsed.data;
    const sku = await updateSku(d.skuId, {
      price: Math.round(d.priceYuan * 100),
      originalPrice: d.originalPriceYuan === null ? null : Math.round(d.originalPriceYuan * 100),
      stock: d.stock,
    });
    revalidatePath(`/admin/products/${sku.productId}`);
    revalidatePath('/admin/products');
    return 'SKU 已更新';
  });
}

const shipSchema = z.object({
  orderNo: z.string().min(1),
  carrier: z.string().trim().max(30).optional(),
  trackingNo: z.string().trim().max(60).optional(),
});

export async function shipOrderAction(
  _prev: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return run(async () => {
    const parsed = shipSchema.safeParse({
      orderNo: formData.get('orderNo'),
      carrier: formData.get('carrier') || undefined,
      trackingNo: formData.get('trackingNo') || undefined,
    });
    if (!parsed.success) throw new Error('参数错误');
    await shipOrder(parsed.data.orderNo, {
      carrier: parsed.data.carrier ?? null,
      trackingNo: parsed.data.trackingNo ?? null,
    });
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${parsed.data.orderNo}`);
    return '已发货';
  });
}

export async function expireOrdersAction(): Promise<AdminActionResult> {
  return run(async () => {
    const n = await expireOrders();
    revalidatePath('/admin');
    revalidatePath('/admin/orders');
    return `已处理 ${n} 笔超时订单`;
  });
}
