import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Log de acesso para páginas protegidas
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    console.log(`[ACCESS] ${req.method} ${req.nextUrl.pathname} from ${ip} - User-Agent: ${userAgent}`);
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Páginas que não precisam de autenticação
        const publicPages = ['/login', '/register', '/'];
        const isPublicPage = publicPages.some(page => req.nextUrl.pathname.startsWith(page));
        
        // Se for página pública, sempre permitir acesso
        if (isPublicPage) {
          return true;
        }
        
        // Para outras páginas, requer token
        if (!token) {
          const ip = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
          console.log(`[SECURITY] Access denied to ${req.nextUrl.pathname} from ${ip} - No token`);
          return false;
        }
        
        return true;
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
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 
