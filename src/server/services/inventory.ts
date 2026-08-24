// 纯函数实现放在 src/lib/stock.ts（客户端组件也需要）；service 层统一从这里导出
export { availableStock, stockHint, type StockHint } from '@/lib/stock';
