import { z } from 'zod';
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
