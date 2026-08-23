import { requireUser } from '@/server/auth/guards';

// M1 占位：M3 实现地址管理
export default async function Page() {
  const user = await requireUser('/account/addresses');
  return (
    <div>
      <h1 className="text-xl font-semibold">收货地址</h1>
      <p className="text-sm text-muted-foreground">{user.name}，该页面将在后续里程碑实现。</p>
    </div>
  );
}
