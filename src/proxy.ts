import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 乐观登录态检查（仅看 cookie 是否存在，不查库）：未登录访问受保护路径直接 302 到 /login?next=。
 * 真正的鉴权在页面 / Server Action 里由 requireUser / requireAdmin 完成。
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url, 302);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/cart/:path*',
    '/checkout/:path*',
    '/orders/:path*',
    '/account/:path*',
    '/admin/:path*',
  ],
};
