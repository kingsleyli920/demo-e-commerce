import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { requireAdmin } from '@/server/auth/guards';
import { getAdminProduct } from '@/server/services/admin';
import { ProductStatusToggle } from '../../admin-buttons';
import { SkuEditor } from './sku-editor';

export default async function AdminProductDetailPage({
  params,
}: PageProps<'/admin/products/[id]'>) {
  await requireAdmin('/admin/products');
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid)) notFound();
  const data = await getAdminProduct(pid);
  if (!data) notFound();
  const { product, skus } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/products" className="hover:text-primary">
              商品管理
            </Link>{' '}
            / {product.id}
          </p>
          <h1 className="mt-1 text-xl font-semibold" data-testid="admin-product-title">
            {product.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            最低价 {formatPrice(product.minPrice)} · 销量 {product.salesCount} ·{' '}
            <Badge
              variant={product.status === 'on' ? 'default' : 'secondary'}
              data-testid="admin-product-detail-status"
            >
              {product.status === 'on' ? '在售' : '已下架'}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <ProductStatusToggle productId={product.id} status={product.status} />
        </div>
      </div>
      <SkuEditor skus={skus} />
      <p className="text-xs text-muted-foreground">
        库存不能低于已锁定数量；改价后前台实时生效，历史订单展示快照不受影响。
      </p>
    </div>
  );
}
