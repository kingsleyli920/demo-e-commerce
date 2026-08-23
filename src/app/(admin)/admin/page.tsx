import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { requireAdmin } from '@/server/auth/guards';
import { getAdminStats } from '@/server/services/admin';
import { ExpireOrdersButton } from './admin-buttons';

export default async function AdminHomePage() {
  await requireAdmin('/admin');
  const stats = await getAdminStats();
  const cards = [
    { key: 'today-orders', label: '今日订单数', value: String(stats.todayOrders) },
    { key: 'paid-gmv', label: '已支付 GMV（累计）', value: formatPrice(stats.paidGmv) },
    { key: 'pending-shipment', label: '待发货', value: String(stats.pendingShipment) },
    { key: 'soldout-skus', label: '售罄 SKU', value: String(stats.soldOutSkus) },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" data-testid="admin-title">
          后台概览
        </h1>
        <ExpireOrdersButton />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-stats">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid={`stat-${c.key}`}>
                {c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
