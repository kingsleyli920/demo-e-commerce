import { requireUser } from '@/server/auth/guards';

// M1 占位：后续里程碑实现
export default async function Page() {
  const user = await requireUser('/orders');
  return (
    <div>
      <h1 className="text-xl font-semibold">我的订单</h1>
      <p className="text-sm text-muted-foreground">{user.name}，该页面将在后续里程碑实现。</p>
    </div>
  );
}
