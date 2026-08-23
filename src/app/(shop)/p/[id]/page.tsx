import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { products } from '@/server/db/schema';

// M1 占位：M2 实现完整详情页（图集 / SKU 选择器 / 库存提示 / 加购）
export default async function ProductPage({ params }: PageProps<'/p/[id]'>) {
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid)) notFound();
  const product = await db.query.products.findFirst({ where: eq(products.id, pid) });
  if (!product || product.status !== 'on') notFound();
  return (
    <div>
      <h1 className="text-xl font-semibold">{product.title}</h1>
      <p className="text-muted-foreground">{product.subtitle}</p>
    </div>
  );
}
