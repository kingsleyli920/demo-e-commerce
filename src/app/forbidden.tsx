import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-muted-foreground" data-testid="forbidden-code">
        403
      </p>
      <h1 className="text-xl font-semibold">没有访问权限</h1>
      <p className="text-sm text-muted-foreground">该页面仅管理员可见。</p>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
