/** 演示账号（与 scripts/seed/seed.ts 保持一致；密码仅用于本地演示） */
export const DEMO_ACCOUNTS = {
  buyer: { email: 'demo@shop.local', password: 'Demo123456', name: '演示买家', role: 'buyer' },
  admin: { email: 'admin@shop.local', password: 'Admin123456', name: '演示管理员', role: 'admin' },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;
