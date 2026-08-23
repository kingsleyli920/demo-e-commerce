/**
 * 只允许站内相对路径，防 open redirect：
 * - 必须以单个 "/" 开头
 * - 拒绝 "//host" 与 "/\host"（浏览器把 \ 归一化为 /）与任何包含反斜杠的路径
 */
export function safeNextPath(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string' || next.length === 0) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
