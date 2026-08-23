import { expireOrders } from '@/server/services/order';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret');
  if (!secret || provided !== secret) {
    return Response.json({ error: '未授权' }, { status: 401 });
  }
  const expired = await expireOrders();
  return Response.json({ expired });
}
