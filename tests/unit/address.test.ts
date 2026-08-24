import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from '@/server/services/address';
import { resetDb } from '../db';
import { createUser } from '../factories';

const input = (patch: Partial<Parameters<typeof createAddress>[1]> = {}) => ({
  receiver: '张三',
  phone: '13800001111',
  province: '广东省',
  city: '深圳市',
  district: '南山区',
  detail: '科技园路 1 号',
  isDefault: false,
  ...patch,
});

describe('address service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('CRUD：新增/查询/编辑/删除', async () => {
    const u = await createUser();
    const a = await createAddress(u.id, input());
    expect(a.id).toBeGreaterThan(0);
    expect(a.isDefault).toBe(true); // 第一个地址自动设为默认
    const listed = await listAddresses(u.id);
    expect(listed).toHaveLength(1);
    const updated = await updateAddress(
      u.id,
      a.id,
      input({ receiver: '李四', detail: '高新南一道 6 号' }),
    );
    expect(updated.receiver).toBe('李四');
    expect((await getAddress(u.id, a.id))?.detail).toBe('高新南一道 6 号');
    await deleteAddress(u.id, a.id);
    expect(await listAddresses(u.id)).toHaveLength(0);
  });

  it('设默认会取消其它默认；列表默认在前', async () => {
    const u = await createUser();
    const a = await createAddress(u.id, input());
    const b = await createAddress(u.id, input({ receiver: '第二个' }));
    expect(b.isDefault).toBe(false);
    await setDefaultAddress(u.id, b.id);
    const listed = await listAddresses(u.id);
    expect(listed[0]!.id).toBe(b.id);
    expect(listed[0]!.isDefault).toBe(true);
    expect(listed.find((x) => x.id === a.id)?.isDefault).toBe(false);
  });

  it('新增时 isDefault=true 会取消其它默认', async () => {
    const u = await createUser();
    const a = await createAddress(u.id, input());
    const b = await createAddress(u.id, input({ isDefault: true }));
    const listed = await listAddresses(u.id);
    expect(listed.find((x) => x.id === a.id)?.isDefault).toBe(false);
    expect(listed.find((x) => x.id === b.id)?.isDefault).toBe(true);
  });

  it('删除默认后无默认（不自动提升）', async () => {
    const u = await createUser();
    const a = await createAddress(u.id, input());
    await createAddress(u.id, input({ receiver: '乙' }));
    await deleteAddress(u.id, a.id);
    const listed = await listAddresses(u.id);
    expect(listed).toHaveLength(1);
    expect(listed.every((x) => !x.isDefault)).toBe(true);
  });

  it('越权：他人地址查/改/删/设默认均 404', async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const a = await createAddress(u1.id, input());
    expect(await getAddress(u2.id, a.id)).toBeNull();
    await expect(updateAddress(u2.id, a.id, input())).rejects.toThrowError(/不存在/);
    await expect(deleteAddress(u2.id, a.id)).rejects.toThrowError(/不存在/);
    await expect(setDefaultAddress(u2.id, a.id)).rejects.toThrowError(/不存在/);
    expect(await listAddresses(u1.id)).toHaveLength(1);
  });
});
