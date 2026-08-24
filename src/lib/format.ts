/** 金额：整数分 → "¥1,234.50" */
export function formatPrice(fen: number): string {
  const yuan = fen / 100;
  return `¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 元（字符串/数字）→ 分；非法返回 null */
export function yuanToFen(yuan: string | number | null | undefined): number | null {
  if (yuan === null || yuan === undefined || yuan === '') return null;
  const n = typeof yuan === 'number' ? yuan : Number(yuan);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
