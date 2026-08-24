import { z } from 'zod';

export const addressInputSchema = z.object({
  receiver: z.string().trim().min(2, { error: '收货人至少 2 个字' }).max(30),
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, { error: '请输入有效的手机号' }),
  province: z.string().trim().min(2).max(20),
  city: z.string().trim().min(1).max(20),
  district: z.string().trim().min(1).max(20),
  detail: z.string().trim().min(4, { error: '详细地址至少 4 个字' }).max(120),
  isDefault: z.boolean().optional().default(false),
});
export type AddressInput = z.infer<typeof addressInputSchema>;
