/** 订单号：ORD + yyyyMMddHHmmss + 4 位随机数字 */
export function generateOrderNo(now: Date = new Date(), rand: () => number = Math.random): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const ts =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = pad(Math.floor(rand() * 10000), 4);
  return `ORD${ts}${suffix}`;
}

export const ORDER_NO_PATTERN = /^ORD\d{14}\d{4}$/;
