import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/server/auth/auth';
import { db } from '@/server/db/client';
import { orders } from '@/server/db/schema';
import { isAppError } from '@/server/errors';
import { mockPayCallback } from '@/server/services/payment';

const bodySchema = z.object({
  orderNo: z.string().min(1),
  result: z.enum(['success', 'fail']),
  transactionNo: z.string().min(1).max(64),
});

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: '参数错误', issues: parsed.error.issues }, { status: 400 });
  }
  // Mock 回调也要求登录 + 订单归属（防止任意人替他人订单标记支付）
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: '请先登录' }, { status: 401 });
  const own = await db.query.orders.findFirst({
    where: and(eq(orders.orderNo, parsed.data.orderNo), eq(orders.userId, session.user.id)),
    columns: { id: true },
  });
  if (!own) return Response.json({ error: '订单不存在' }, { status: 404 });
  try {
    const result = await mockPayCallback(parsed.data);
    return Response.json({
      orderNo: result.order.orderNo,
      orderStatus: result.order.status,
      payStatus: result.status,
      idempotent: result.idempotent,
    });
  } catch (e) {
    if (isAppError(e))
      return Response.json({ error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
