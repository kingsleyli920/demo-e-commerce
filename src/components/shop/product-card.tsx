import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import type { ProductCard as ProductCardData } from '@/server/services/catalog';

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link href={`/p/${product.id}`} className="group block" data-testid="product-card">
      <Card className="h-full overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="relative aspect-square w-full bg-muted">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-contain p-2"
            />
          ) : null}
        </div>
        <CardContent className="space-y-1 p-3">
          <h3 className="line-clamp-2 min-h-10 text-sm leading-5" data-testid="product-card-title">
            {product.title}
          </h3>
          {product.subtitle ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{product.subtitle}</p>
          ) : null}
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-semibold text-red-600" data-testid="product-card-price">
              {formatPrice(product.minPrice)}
            </span>
            <span className="text-xs text-muted-foreground" data-testid="product-card-sales">
              已售 {product.salesCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
