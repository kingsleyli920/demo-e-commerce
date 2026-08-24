import { CategoryNav } from '@/components/shop/category-nav';
import { ProductCard } from '@/components/shop/product-card';
import { getCategoryTree, listFeaturedProducts } from '@/server/services/catalog';

export default async function HomePage() {
  const [tree, featured] = await Promise.all([getCategoryTree(), listFeaturedProducts(20)]);
  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <CategoryNav tree={tree} />
        <div className="flex flex-col justify-center rounded-lg border bg-gradient-to-br from-orange-50 to-red-50 p-8">
          <h1 className="text-2xl font-bold">云集优选 · 演示商城</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tree.length} 个一级类目 · 精选好物 · Mock 支付即刻体验完整下单流程
          </p>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">热销推荐</h2>
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          data-testid="featured-products"
        >
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
