/**
 * E2E 辅助：直连 DATABASE_URL（开发库）做测试前置/清理。
 * 后台 UI 在 M4 才实现，涉及“后台操作”的步骤（改库存/下架/发货）在 M3 用服务层或 SQL 模拟，
 * M4 的 admin-flow.spec 会用真实后台 UI 复测同类操作。
 */
import { Client } from 'pg';

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未设置（playwright.config 已加载 .env.local）');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function setSkuStatus(skuId: number, status: 'on' | 'off'): Promise<void> {
  await withClient((c) => c.query('UPDATE skus SET status = $1 WHERE id = $2', [status, skuId]));
}

export async function setSkuStock(skuId: number, stock: number): Promise<void> {
  await withClient((c) => c.query('UPDATE skus SET stock = $1 WHERE id = $2', [stock, skuId]));
}

export async function setSkuPrice(skuId: number, price: number): Promise<void> {
  await withClient((c) => c.query('UPDATE skus SET price = $1 WHERE id = $2', [price, skuId]));
}

export async function getSkuRow(
  skuId: number,
): Promise<{ stock: number; lockedStock: number; price: number }> {
  return withClient(async (c) => {
    const r = await c.query('SELECT stock, locked_stock, price FROM skus WHERE id = $1', [skuId]);
    const row = r.rows[0];
    return { stock: row.stock, lockedStock: row.locked_stock, price: row.price };
  });
}

export async function clearCartByEmail(email: string): Promise<void> {
  await withClient((c) =>
    c.query(
      `DELETE FROM cart_items WHERE cart_id IN (
         SELECT ct.id FROM carts ct JOIN "user" u ON u.id = ct.user_id WHERE u.email = $1)`,
      [email],
    ),
  );
}

export async function deleteAddressesByEmail(email: string): Promise<void> {
  await withClient((c) =>
    c.query(`DELETE FROM addresses WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, [
      email,
    ]),
  );
}

/** 管理员发货（M3：直接走服务层等价 SQL；仅 PAID→SHIPPED） */
export async function shipOrderByNo(
  orderNo: string,
  carrier = '顺丰速运',
  trackingNo = 'SF-E2E-1',
): Promise<void> {
  await withClient(async (c) => {
    const r = await c.query(
      `UPDATE orders SET status = 'SHIPPED', shipped_at = now(), shipping = $2
       WHERE order_no = $1 AND status = 'PAID' RETURNING id`,
      [orderNo, JSON.stringify({ carrier, trackingNo })],
    );
    if (r.rowCount === 0) throw new Error(`发货失败：订单 ${orderNo} 不是 PAID 状态`);
  });
}

export async function cancelPendingOrderByNo(orderNo: string): Promise<void> {
  await withClient(async (c) => {
    await c.query('BEGIN');
    const r = await c.query(
      `UPDATE orders SET status = 'CANCELLED', cancelled_at = now()
       WHERE order_no = $1 AND status = 'PENDING_PAYMENT' RETURNING id`,
      [orderNo],
    );
    if (r.rowCount === 1) {
      await c.query(
        `UPDATE skus s SET locked_stock = s.locked_stock - oi.quantity
         FROM order_items oi WHERE oi.order_id = $1 AND oi.sku_id = s.id`,
        [r.rows[0].id],
      );
    }
    await c.query('COMMIT');
  });
}
