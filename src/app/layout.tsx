import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '云集优选 · AI 电商 Demo', template: '%s · 云集优选' },
  description: '单商户电商 Demo：商品目录、SKU、购物车、Mock 结算与订单流转',
};

// 全站动态渲染（数据来自 Postgres，不做构建期预渲染）
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className="h-full font-sans antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
