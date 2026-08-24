import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatPrice } from '@/lib/format';
import { requireAdmin } from '@/server/auth/guards';
import type { OrderStatus } from '@/server/db/schema';
import { listAdminOrders } from '@/server/services/admin';
import { ORDER_STATUS_LABELS } from '@/server/services/order';
import { ExpireOrdersButton } from '../admin-buttons';

const STATUSES: (OrderStatus | 'ALL')[] = [
  'ALL',
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];

export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  await requireAdmin('/admin/orders');
  const sp = await searchParams;
  const status =
    typeof sp.status === 'string' &&
    STATUSES.includes(sp.status as OrderStatus) &&
    sp.status !== 'ALL'
      ? (sp.status as OrderStatus)
      : undefined;
  const page = typeof sp.page === 'string' ? Math.max(1, Number(sp.page) || 1) : 1;
  const { items, total, totalPages } = await listAdminOrders({ status, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">订单管理</h1>
        <ExpireOrdersButton />
      </div>
      <nav className="flex flex-wrap gap-1 border-b" data-testid="admin-order-tabs">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === 'ALL' ? '/admin/orders' : `/admin/orders?status=${s}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              (s === 'ALL' && !status) || s === status
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`admin-order-tab-${s}`}
          >
            {s === 'ALL' ? '全部' : ORDER_STATUS_LABELS[s as OrderStatus]}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">共 {total} 笔</p>
      <div className="rounded-lg border">
        <Table data-testid="admin-order-table">
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>买家</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((o) => (
              <TableRow key={o.id} data-testid="admin-order-row" data-order-no={o.orderNo}>
                <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                <TableCell className="text-sm">{o.buyerName}</TableCell>
                <TableCell>{formatPrice(o.payAmount)}</TableCell>
                <TableCell>
                  <Badge
                    variant={o.status === 'PAID' ? 'default' : 'secondary'}
                    data-testid="admin-order-status"
                  >
                    {ORDER_STATUS_LABELS[o.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(o.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/orders/${o.orderNo}`} data-testid="admin-order-detail-link">
                      详情
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page - 1) })}`}
              >
                上一页
              </Link>
            </Button>
          ) : null}
          <span className="self-center text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page + 1) })}`}
                data-testid="admin-order-next"
              >
                下一页
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
