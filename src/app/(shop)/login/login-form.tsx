'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { demoLoginAction, loginAction, type LoginState } from './actions';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const error = state?.error ?? initialError;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4" data-testid="login-form">
        <input type="hidden" name="next" value={next ?? ''} />
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="demo@shop.local"
            defaultValue={state?.email ?? ''}
            required
            data-testid="login-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="login-password"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert" data-testid="login-error">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending} data-testid="login-submit">
          {pending ? '登录中…' : '登录'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">一键演示登录</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <form action={demoLoginAction.bind(null, 'buyer', next)}>
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            data-testid="demo-login-buyer"
          >
            买家演示账号
          </Button>
        </form>
        <form action={demoLoginAction.bind(null, 'admin', next)}>
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            data-testid="demo-login-admin"
          >
            管理员演示账号
          </Button>
        </form>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        买家 demo@shop.local / Demo123456 · 管理员 admin@shop.local / Admin123456
      </p>
    </div>
  );
}
