import Link from 'next/link';
import type { CategoryNode } from '@/server/services/catalog';

export function CategoryNav({ tree }: { tree: CategoryNode[] }) {
  return (
    <nav aria-label="商品类目" className="rounded-lg border bg-card" data-testid="category-nav">
      <ul className="divide-y">
        {tree.map((parent) => (
          <li key={parent.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
            <Link
              href={`/c/${parent.slug}`}
              className="mr-1 text-sm font-semibold hover:text-primary"
              data-testid="category-parent-link"
            >
              {parent.name}
            </Link>
            {parent.children.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="text-sm text-muted-foreground hover:text-primary"
                data-testid="category-child-link"
              >
                {c.name}
              </Link>
            ))}
          </li>
        ))}
      </ul>
    </nav>
  );
}
