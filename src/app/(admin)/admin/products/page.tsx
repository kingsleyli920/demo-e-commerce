import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPrice } from '@/lib/format';
import { requireAdmin } from '@/server/auth/guards';
import { listAdminProducts } from '@/server/services/admin';
import { ProductStatusToggle } from '../admin-buttons';

export default async function AdminProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  await requireAdmin('/admin/products');
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const page = typeof sp.page === 'string' ? Math.max(1, Number(sp.page) || 1) : 1;
  const { items, total, totalPages } = await listAdminProducts({ q, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">商品管理</h1>
        <form action="/admin/products" method="get" className="flex gap-2">
          <Input
            name="q"
            defaultValue={q ?? ''}
            placeholder="搜索标题/品牌"
            className="w-56"
            data-testid="admin-product-search"
          />
          <Button type="submit" variant="secondary" data-testid="admin-product-search-btn">
            搜索
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        共 <span data-testid="admin-product-total">{total}</span> 个商品
      </p>
      <div className="rounded-lg border">
        <Table data-testid="admin-product-table">
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>商品</TableHead>
              <TableHead>最低价</TableHead>
              <TableHead>SKU 数</TableHead>
              <TableHead>总库存</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id} data-testid="admin-product-row" data-product-id={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="max-w-72">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="line-clamp-1 hover:text-primary"
                    data-testid="admin-product-link"
                  >
                    {p.title}
                  </Link>
                </TableCell>
                <TableCell>{formatPrice(p.minPrice)}</TableCell>
                <TableCell>{p.skuCount}</TableCell>
                <TableCell>{p.totalStock}</TableCell>
                <TableCell>
                  <Badge
                    variant={p.status === 'on' ? 'default' : 'secondary'}
                    data-testid="admin-product-status"
                  >
                    {p.status === 'on' ? '在售' : '已下架'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/products/${p.id}`} data-testid="admin-product-edit">
                        编辑
                      </Link>
                    </Button>
                    <ProductStatusToggle productId={p.id} status={p.status} />
                  </div>
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
                href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
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
                href={`/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
                data-testid="admin-product-next"
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
