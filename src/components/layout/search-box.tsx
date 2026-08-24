import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" method="get" role="search" className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="搜索商品、品牌…"
        className="pl-9"
        aria-label="搜索商品"
        data-testid="search-input"
      />
    </form>
  );
}
