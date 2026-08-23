'use server';

import { APIError } from 'better-auth/api';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';
import { safeNextPath } from '@/lib/safe-next';
import { auth } from '@/server/auth/auth';

export type LoginState = { error?: string; email?: string } | undefined;

const loginSchema = z.object({
  email: z.email({ error: '请输入有效的邮箱地址' }),
  password: z.string().min(8, { error: '密码至少 8 位' }),
  next: z.string().optional(),
});

async function signIn(email: string, password: string): Promise<string | null> {
  try {
    await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: await headers(),
    });
    return null;
  } catch (e) {
    if (e instanceof APIError) {
      return e.body?.code === 'INVALID_EMAIL_OR_PASSWORD'
        ? '邮箱或密码错误'
        : (e.message ?? '登录失败');
    }
    throw e;
  }
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  const email = String(formData.get('email') ?? '');
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '参数错误', email };
  }
  const err = await signIn(parsed.data.email, parsed.data.password);
  if (err) return { error: err, email };
  redirect(safeNextPath(parsed.data.next));
}

export async function demoLoginAction(role: 'buyer' | 'admin', next?: string): Promise<void> {
  const acc = DEMO_ACCOUNTS[role];
  const err = await signIn(acc.email, acc.password);
  if (err) {
    redirect(
      `/login?error=${encodeURIComponent(err)}${next ? `&next=${encodeURIComponent(next)}` : ''}`,
    );
  }
  redirect(safeNextPath(next ?? (role === 'admin' ? '/admin' : '/')));
}

export async function logoutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect('/');
}
