import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/server/auth/guards';
import { listAddresses } from '@/server/services/address';
import { AddressFormDialog } from './address-form';
import { AddressList } from './address-list';

export const metadata: Metadata = { title: '收货地址' };

export default async function AddressesPage({ searchParams }: PageProps<'/account/addresses'>) {
  const user = await requireUser('/account/addresses');
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  const addresses = await listAddresses(user.id);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">收货地址</h1>
        <AddressFormDialog
          next={next}
          trigger={<Button data-testid="address-add">新增地址</Button>}
        />
      </div>
      {addresses.length === 0 ? (
        <p
          className="rounded-lg border border-dashed py-16 text-center text-muted-foreground"
          data-testid="address-empty"
        >
          还没有收货地址，点击右上角「新增地址」
        </p>
      ) : (
        <AddressList addresses={addresses} />
      )}
    </div>
  );
}
