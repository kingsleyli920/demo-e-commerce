import { describe, expect, it } from 'vitest';
import { AppError } from '@/server/errors';
import { isAdmin, requireAdmin, requireUser, type SessionUser } from '@/server/services/auth';

const buyer: SessionUser = { id: 'u1', name: '买家', email: 'b@test.local', role: 'buyer' };
const admin: SessionUser = { id: 'u2', name: '管理员', email: 'a@test.local', role: 'admin' };

describe('auth service', () => {
  it('requireUser 无会话抛 401', () => {
    expect(() => requireUser(null)).toThrowError(AppError);
    try {
      requireUser(undefined);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('UNAUTHORIZED');
      expect((e as AppError).status).toBe(401);
    }
  });

  it('requireUser 有会话返回用户', () => {
    expect(requireUser(buyer)).toBe(buyer);
  });

  it('requireAdmin 买家抛 403', () => {
    try {
      requireAdmin(buyer);
      throw new Error('should throw');
    } catch (e) {
      expect((e as AppError).code).toBe('FORBIDDEN');
      expect((e as AppError).status).toBe(403);
    }
  });

  it('requireAdmin 未登录抛 401、管理员通过', () => {
    expect(() => requireAdmin(null)).toThrowError(/请先登录/);
    expect(requireAdmin(admin)).toBe(admin);
  });

  it('isAdmin', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(buyer)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
