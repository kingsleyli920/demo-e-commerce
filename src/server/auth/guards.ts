import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { cache } from 'react';
import { isAppError } from '@/server/errors';
import * as authService from '@/server/services/auth';
import { auth, type AuthUser } from './auth';

/** 当前请求的会话（同一次渲染内去重） */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser(): Promise<AuthUser | null> {
  const s = await getCurrentSession();
  return s?.user ?? null;
}

/** 需登录：未登录跳转 /login?next=<path> */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  try {
    authService.requireUser(user);
  } catch (e) {
    if (isAppError(e) && e.code === 'UNAUTHORIZED') {
      redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login');
    }
    throw e;
  }
  return user as AuthUser;
}

/** 需管理员：未登录 → 登录页；非管理员 → 403 */
export async function requireAdmin(nextPath?: string): Promise<AuthUser> {
  const user = await requireUser(nextPath);
  try {
    authService.requireAdmin(user);
  } catch (e) {
    if (isAppError(e) && e.code === 'FORBIDDEN') forbidden();
    throw e;
  }
  return user;
}
