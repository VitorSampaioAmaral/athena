import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware() {
    return null;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuthPage = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register');
        
        // Se for página de auth, sempre permitir acesso
        if (isAuthPage) {
          return true;
        }
        
        // Para outras páginas, requer token
        return !!token;
      }
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 