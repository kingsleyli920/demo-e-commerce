'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next';
import { addressInputSchema } from '@/server/dto/address';
import { requireUser } from '@/server/auth/guards';
import { isAppError, toUserMessage } from '@/server/errors';
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from '@/server/services/address';

export type AddressFormState = { error?: string; done?: boolean } | undefined;

export async function saveAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const user = await requireUser('/account/addresses');
  const id = formData.get('id') ? Number(formData.get('id')) : null;
  const parsed = addressInputSchema.safeParse({
    receiver: formData.get('receiver'),
    phone: formData.get('phone'),
    province: formData.get('province'),
    city: formData.get('city'),
    district: formData.get('district'),
    detail: formData.get('detail'),
    isDefault: formData.get('isDefault') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '请检查表单内容' };
  try {
    if (id) await updateAddress(user.id, id, parsed.data);
    else await createAddress(user.id, parsed.data);
  } catch (e) {
    if (isAppError(e)) return { error: e.message };
    return { error: toUserMessage(e) };
  }
  revalidatePath('/account/addresses');
  const nextRaw = formData.get('next');
  if (typeof nextRaw === 'string' && nextRaw) {
    const next = safeNextPath(nextRaw, '/account/addresses');
    if (next !== '/account/addresses') redirect(next);
  }
  return { done: true };
}

export async function deleteAddressAction(id: number): Promise<void> {
  const user = await requireUser('/account/addresses');
  await deleteAddress(user.id, id);
  revalidatePath('/account/addresses');
}

export async function setDefaultAddressAction(id: number): Promise<void> {
  const user = await requireUser('/account/addresses');
  await setDefaultAddress(user.id, id);
  revalidatePath('/account/addresses');
}
