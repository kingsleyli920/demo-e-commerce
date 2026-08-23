import type { Metadata } from 'next';
import { ProductList } from '@/components/shop/product-list';
import { parseSearchQuery } from '@/server/dto/catalog';
import { searchProducts } from '@/server/services/catalog';

export const metadata: Metadata = { title: '搜索' };

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = parseSearchQuery(await searchParams);
  const result = await searchProducts({
    q: sp.q,
    minPrice: sp.min,
    maxPrice: sp.max,
    sort: sp.sort,
    page: sp.page,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold" data-testid="search-title">
        {sp.q ? (
          <>
            「{sp.q}」的搜索结果
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              共 {result.total} 件
            </span>
          </>
        ) : (
          <>全部商品</>
        )}
      </h1>
      <ProductList
        basePath="/search"
        query={{ q: sp.q, min: sp.min, max: sp.max, sort: sp.sort, page: sp.page }}
        result={result}
        emptyHint={sp.q ? `没有找到与「${sp.q}」相关的商品` : '没有找到相关商品'}
      />
    </div>
  );
}
