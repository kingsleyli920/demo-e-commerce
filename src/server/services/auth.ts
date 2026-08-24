import { AppError } from '@/server/errors';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'admin';
};

/** 无会话 → 401 */
export function requireUser(user: SessionUser | null | undefined): SessionUser {
  if (!user) throw new AppError('UNAUTHORIZED', '请先登录');
  return user;
}

/** 非管理员 → 403（未登录仍为 401） */
export function requireAdmin(user: SessionUser | null | undefined): SessionUser {
  const u = requireUser(user);
  if (u.role !== 'admin') throw new AppError('FORBIDDEN', '需要管理员权限');
  return u;
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === 'admin';
}
