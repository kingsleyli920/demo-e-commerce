import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { ProductGallery } from '@/components/shop/product-gallery';
import { SkuSelector, type SkuData } from '@/components/shop/sku-selector';
import { availableStock } from '@/lib/stock';
import { getProductDetail } from '@/server/services/catalog';

export default async function ProductPage({ params }: PageProps<'/p/[id]'>) {
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) notFound();
  const detail = await getProductDetail(pid);
  if (!detail) notFound();
  const { product, skus, breadcrumb } = detail;
  const skuData: SkuData[] = skus.map((s) => ({
    id: s.id,
    spec: s.spec,
    price: s.price,
    originalPrice: s.originalPrice,
    available: Math.min(availableStock(s), 99),
    image: s.image,
    status: s.status,
  }));

  return (
    <div className="space-y-8">
      <Breadcrumb data-testid="pdp-breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumb.map((c) => (
            <span key={c.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/c/${c.slug}`}>{c.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </span>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1 max-w-60">{product.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} title={product.title} />
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold" data-testid="pdp-title">
              {product.title}
            </h1>
            {product.subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground" data-testid="pdp-subtitle">
                {product.subtitle}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              品牌：<span data-testid="pdp-brand">{product.brand ?? '-'}</span> · 已售{' '}
              {product.salesCount} · 评分 {product.rating}
            </p>
          </div>
          <SkuSelector productId={product.id} attributes={product.attributes} skus={skuData} />
        </div>
      </div>

      <Separator />
      <section className="max-w-3xl space-y-2">
        <h2 className="text-lg font-semibold">商品详情</h2>
        <p
          className="text-sm leading-7 whitespace-pre-wrap text-muted-foreground"
          data-testid="pdp-description"
        >
          {product.description}
        </p>
      </section>
    </div>
  );
}
