import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/server/auth/guards';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: '登录' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const user = await getCurrentUser();
  if (user) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">登录云集优选</CardTitle>
          <CardDescription>使用演示账号体验完整购物与后台流程</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} initialError={error} />
        </CardContent>
      </Card>
    </div>
  );
}
