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
import { Badge } from '@/components/ui/badge';
import { ProductList } from '@/components/shop/product-list';
import { parseSearchQuery } from '@/server/dto/catalog';
import {
  getCategoryBreadcrumb,
  getCategoryBySlug,
  getCategoryTree,
  searchProducts,
} from '@/server/services/catalog';

export default async function CategoryPage({ params, searchParams }: PageProps<'/c/[slug]'>) {
  const { slug } = await params;
  const sp = parseSearchQuery(await searchParams);
  const category = await getCategoryBySlug(decodeURIComponent(slug));
  if (!category) notFound();
  const [result, crumbs, tree] = await Promise.all([
    searchProducts({
      q: sp.q,
      categoryId: category.id,
      minPrice: sp.min,
      maxPrice: sp.max,
      sort: sp.sort,
      page: sp.page,
    }),
    getCategoryBreadcrumb(category.id),
    getCategoryTree(),
  ]);
  const siblings =
    category.parentId === null
      ? (tree.find((t) => t.id === category.id)?.children ?? [])
      : (tree.find((t) => t.id === category.parentId)?.children ?? []);

  return (
    <div className="space-y-4">
      <Breadcrumb data-testid="category-breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((c, i) => (
            <span key={c.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage data-testid="breadcrumb-current">{c.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={`/c/${c.slug}`}>{c.name}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {siblings.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="category-chips">
          {siblings.map((c) => (
            <Badge key={c.id} asChild variant={c.id === category.id ? 'default' : 'outline'}>
              <Link href={`/c/${c.slug}`}>{c.name}</Link>
            </Badge>
          ))}
        </div>
      ) : null}
      <h1 className="text-lg font-semibold" data-testid="category-title">
        {category.name}
        <span className="ml-2 text-sm font-normal text-muted-foreground">共 {result.total} 件</span>
      </h1>
      <ProductList
        basePath={`/c/${category.slug}`}
        query={{ q: sp.q, min: sp.min, max: sp.max, sort: sp.sort, page: sp.page }}
        result={result}
      />
    </div>
  );
}
