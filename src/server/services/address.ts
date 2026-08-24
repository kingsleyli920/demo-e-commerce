import { and, desc, eq, ne } from 'drizzle-orm';
import { db, type DbOrTx } from '@/server/db/client';
import { addresses, type Address } from '@/server/db/schema';
import type { AddressInput } from '@/server/dto/address';
import { AppError } from '@/server/errors';

export async function listAddresses(userId: string, conn: DbOrTx = db): Promise<Address[]> {
  return conn
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt), desc(addresses.id));
}

export async function getAddress(
  userId: string,
  id: number,
  conn: DbOrTx = db,
): Promise<Address | null> {
  const row = await conn.query.addresses.findFirst({
    where: and(eq(addresses.id, id), eq(addresses.userId, userId)),
  });
  return row ?? null;
}

export async function getDefaultAddress(
  userId: string,
  conn: DbOrTx = db,
): Promise<Address | null> {
  const rows = await listAddresses(userId, conn);
  return rows.find((a) => a.isDefault) ?? rows[0] ?? null;
}

/** 新增：第一个地址自动设为默认；isDefault=true 时取消其它默认 */
export async function createAddress(
  userId: string,
  input: AddressInput,
  conn: DbOrTx = db,
): Promise<Address> {
  return conn.transaction(async (tx) => {
    const existing = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, userId));
    const makeDefault = input.isDefault || existing.length === 0;
    if (makeDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }
    const [row] = await tx
      .insert(addresses)
      .values({ ...input, userId, isDefault: makeDefault })
      .returning();
    return row!;
  });
}

export async function updateAddress(
  userId: string,
  id: number,
  input: AddressInput,
  conn: DbOrTx = db,
): Promise<Address> {
  return conn.transaction(async (tx) => {
    const found = await tx.query.addresses.findFirst({
      where: and(eq(addresses.id, id), eq(addresses.userId, userId)),
    });
    if (!found) throw new AppError('NOT_FOUND', '地址不存在');
    if (input.isDefault) {
      await tx
        .update(addresses)
        .set({ isDefault: false })
        .where(and(eq(addresses.userId, userId), ne(addresses.id, id)));
    }
    const [row] = await tx
      .update(addresses)
      .set({ ...input, isDefault: input.isDefault || found.isDefault })
      .where(eq(addresses.id, id))
      .returning();
    return row!;
  });
}

export async function deleteAddress(userId: string, id: number, conn: DbOrTx = db): Promise<void> {
  const res = await conn
    .delete(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .returning({ id: addresses.id });
  if (res.length === 0) throw new AppError('NOT_FOUND', '地址不存在');
}

export async function setDefaultAddress(
  userId: string,
  id: number,
  conn: DbOrTx = db,
): Promise<void> {
  await conn.transaction(async (tx) => {
    const found = await tx.query.addresses.findFirst({
      where: and(eq(addresses.id, id), eq(addresses.userId, userId)),
    });
    if (!found) throw new AppError('NOT_FOUND', '地址不存在');
    await tx
      .update(addresses)
      .set({ isDefault: false })
      .where(and(eq(addresses.userId, userId), ne(addresses.id, id)));
    await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, id));
  });
}
