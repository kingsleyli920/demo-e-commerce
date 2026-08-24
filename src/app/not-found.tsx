import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-muted-foreground" data-testid="not-found-code">
        404
      </p>
      <h1 className="text-xl font-semibold">页面不存在或商品已下架</h1>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
