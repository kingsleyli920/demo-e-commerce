import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PRODUCT_SORTS, SORT_LABELS, type ProductSort } from '@/server/dto/catalog';
import type { SearchResult } from '@/server/services/catalog';
import { ProductCard } from './product-card';

export type ListQuery = {
  q?: string;
  min?: number;
  max?: number;
  sort: ProductSort;
  page: number;
};

/** 构造保持其它条件的链接 */
export function buildListHref(
  basePath: string,
  query: ListQuery,
  patch: Partial<ListQuery>,
): string {
  const merged = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (merged.q) sp.set('q', merged.q);
  if (merged.min !== undefined) sp.set('min', String(merged.min));
  if (merged.max !== undefined) sp.set('max', String(merged.max));
  if (merged.sort && merged.sort !== 'default') sp.set('sort', merged.sort);
  if (merged.page && merged.page !== 1) sp.set('page', String(merged.page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function SortBar({ basePath, query }: { basePath: string; query: ListQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="sort-bar">
      {PRODUCT_SORTS.map((s) => (
        <Button
          key={s}
          asChild
          size="sm"
          variant={query.sort === s ? 'default' : 'outline'}
          data-active={query.sort === s}
        >
          <Link
            href={buildListHref(basePath, query, { sort: s, page: 1 })}
            data-testid={`sort-${s}`}
          >
            {SORT_LABELS[s]}
          </Link>
        </Button>
      ))}
      <form
        action={basePath}
        method="get"
        className="ml-auto flex items-center gap-1.5"
        data-testid="price-filter"
      >
        {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
        {query.sort !== 'default' ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <input
          type="number"
          name="min"
          min={0}
          defaultValue={query.min ?? ''}
          placeholder="最低价"
          className="h-8 w-20 rounded-md border px-2 text-sm"
          data-testid="price-min"
        />
        <span className="text-muted-foreground">-</span>
        <input
          type="number"
          name="max"
          min={0}
          defaultValue={query.max ?? ''}
          placeholder="最高价"
          className="h-8 w-20 rounded-md border px-2 text-sm"
          data-testid="price-max"
        />
        <Button type="submit" size="sm" variant="secondary" data-testid="price-apply">
          确定
        </Button>
      </form>
    </div>
  );
}

function Pager({
  basePath,
  query,
  result,
}: {
  basePath: string;
  query: ListQuery;
  result: SearchResult;
}) {
  if (result.total === 0) return null;
  const { page, totalPages } = result;
  return (
    <nav
      className="flex items-center justify-center gap-3 pt-6"
      aria-label="分页"
      data-testid="pagination"
    >
      {page <= 1 ? (
        <span
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-muted-foreground/50"
          aria-disabled
        >
          上一页
        </span>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={buildListHref(basePath, query, { page: page - 1 })} data-testid="page-prev">
            上一页
          </Link>
        </Button>
      )}
      <span className="text-sm text-muted-foreground" data-testid="page-info">
        第 {page} / {Math.max(totalPages, 1)} 页 · 共{' '}
        <span data-testid="total-count">{result.total}</span> 件
      </span>
      {page >= totalPages ? (
        <span
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-muted-foreground/50"
          aria-disabled
        >
          下一页
        </span>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={buildListHref(basePath, query, { page: page + 1 })} data-testid="page-next">
            下一页
          </Link>
        </Button>
      )}
    </nav>
  );
}

export function ProductList({
  basePath,
  query,
  result,
  emptyHint,
}: {
  basePath: string;
  query: ListQuery;
  result: SearchResult;
  emptyHint?: string;
}) {
  return (
    <div className="space-y-4">
      <SortBar basePath={basePath} query={query} />
      {result.total === 0 ? (
        <div
          className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-20 text-center"
          data-testid="empty-state"
        >
          <p className="text-muted-foreground">{emptyHint ?? '没有找到相关商品'}</p>
          <Button asChild variant="outline" data-testid="clear-filters">
            <Link href={basePath}>清除筛选</Link>
          </Button>
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            data-testid="product-grid"
          >
            {result.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {result.page > result.totalPages && result.totalPages > 0 ? (
            <p
              className="text-center text-sm text-muted-foreground"
              data-testid="page-out-of-range"
            >
              当前页超出范围
            </p>
          ) : null}
        </>
      )}
      <Pager basePath={basePath} query={query} result={result} />
    </div>
  );
}
