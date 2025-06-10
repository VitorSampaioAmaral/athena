import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register');
  const isRootPage = request.nextUrl.pathname === '/';

  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL('/transcricao', request.url));
    }
    return NextResponse.next();
  }

  if (isRootPage) {
    return NextResponse.redirect(new URL('/transcricao', request.url));
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|transcricao|register).*)'],
}; 