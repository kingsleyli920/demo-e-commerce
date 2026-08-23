export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_STATE'
  | 'CART_LIMIT'
  | 'CONFLICT';

const DEFAULT_STATUS: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  INSUFFICIENT_STOCK: 409,
  INVALID_STATE: 409,
  CART_LIMIT: 400,
  CONFLICT: 409,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(
    code: AppErrorCode,
    message: string,
    opts: { status?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = opts.status ?? DEFAULT_STATUS[code];
    this.details = opts.details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** 把任意错误转换成用户可读中文消息（用于 Server Actions / Route Handlers 返回） */
export function toUserMessage(e: unknown, fallback = '操作失败，请稍后重试'): string {
  if (isAppError(e)) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
