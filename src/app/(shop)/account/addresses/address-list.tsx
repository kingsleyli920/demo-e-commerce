'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Address } from '@/server/db/schema';
import { deleteAddressAction, setDefaultAddressAction } from './actions';
import { AddressFormDialog } from './address-form';

export function AddressList({ addresses }: { addresses: Address[] }) {
  const [, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? '操作成功');
      else toast.error(r.message ?? '操作失败');
    });

  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="address-list">
      {addresses.map((a) => (
        <Card key={a.id} data-testid="address-card">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">{a.receiver}</span>
              <span className="text-sm text-muted-foreground">{a.phone}</span>
              {a.isDefault ? <Badge data-testid="address-default-badge">默认</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {a.province} {a.city} {a.district} {a.detail}
            </p>
            <div className="flex gap-2 pt-1">
              <AddressFormDialog
                address={a}
                trigger={
                  <Button variant="outline" size="sm" data-testid="address-edit">
                    编辑
                  </Button>
                }
              />
              {!a.isDefault ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="address-set-default"
                  onClick={() => run(() => setDefaultAddressAction(a.id))}
                >
                  设为默认
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                data-testid="address-delete"
                onClick={() => run(() => deleteAddressAction(a.id))}
              >
                删除
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
