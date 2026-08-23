'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REGIONS } from '@/lib/regions.zh';
import type { Address } from '@/server/db/schema';
import { saveAddressAction, type AddressFormState } from './actions';

export function AddressFormDialog({
  address,
  next,
  trigger,
}: {
  address?: Address;
  next?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [province, setProvince] = useState(address?.province ?? REGIONS[0]!.name);
  const [city, setCity] = useState(address?.city ?? REGIONS[0]!.cities[0]!.name);

  const provinceData = REGIONS.find((r) => r.name === province) ?? REGIONS[0]!;
  const cityData = provinceData.cities.find((c) => c.name === city) ?? provinceData.cities[0]!;

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result: AddressFormState = await saveAddressAction(undefined, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success('地址已保存');
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{address ? '编辑地址' : '新增地址'}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4" data-testid="address-form">
          {address ? <input type="hidden" name="id" value={address.id} /> : null}
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="receiver">收货人</Label>
              <Input
                id="receiver"
                name="receiver"
                defaultValue={address?.receiver ?? ''}
                required
                data-testid="address-receiver"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={address?.phone ?? ''}
                required
                data-testid="address-phone"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>省份</Label>
              <select
                name="province"
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  const p = REGIONS.find((r) => r.name === e.target.value)!;
                  setCity(p.cities[0]!.name);
                }}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                data-testid="address-province"
              >
                {REGIONS.map((r) => (
                  <option key={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>城市</Label>
              <select
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                data-testid="address-city"
              >
                {provinceData.cities.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>区县</Label>
              <select
                name="district"
                defaultValue={address?.district}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                data-testid="address-district"
              >
                {cityData.districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail">详细地址</Label>
            <Input
              id="detail"
              name="detail"
              defaultValue={address?.detail ?? ''}
              placeholder="街道、楼栋、门牌号"
              required
              data-testid="address-detail"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={address?.isDefault ?? false}
              data-testid="address-default-checkbox"
            />
            设为默认地址
          </label>
          <Button type="submit" className="w-full" disabled={pending} data-testid="address-save">
            {pending ? '保存中…' : '保存'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
