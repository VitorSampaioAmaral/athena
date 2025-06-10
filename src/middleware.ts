import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { serverEvents } from './utils/serverEvents';

// Configuração para usar o Edge Runtime
export const runtime = 'experimental-edge';

export async function middleware(request: NextRequest) {
  // Rotas públicas que não precisam de autenticação
  const publicPaths = ['/', '/login', '/register'];
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);

  // Pega o token do cookie
  const token = request.cookies.get('auth_token')?.value;

  if (!token && !isPublicPath) {
    // Se não há token e a rota não é pública, redireciona para login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublicPath && request.nextUrl.pathname !== '/') {
    // Se há token e a rota é pública (exceto home), redireciona para home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Verifica o token para rotas protegidas
  if (token && !isPublicPath) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
      if (!decoded) {
        // Token inválido, limpa o cookie e redireciona para login
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('auth_token');
        return response;
      }
    } catch (error) {
      // Erro na validação, limpa o cookie e redireciona para login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth_token');
      return response;
    }
  }

  // Captura logs do console original
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  };

  // Sobrescreve os métodos do console
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    serverEvents.addLog({
      timestamp: Date.now(),
      type: 'info',
      message
    });
    originalConsole.log(...args);
  };

  console.info = (...args: any[]) => {
    const message = args.join(' ');
    serverEvents.addLog({
      timestamp: Date.now(),
      type: 'info',
      message
    });
    originalConsole.info(...args);
  };

  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    serverEvents.addLog({
      timestamp: Date.now(),
      type: 'warning',
      message
    });
    originalConsole.warn(...args);
  };

  console.error = (...args: any[]) => {
    const message = args.join(' ');
    serverEvents.addLog({
      timestamp: Date.now(),
      type: 'error',
      message,
      details: args.length > 1 ? args.slice(1) : undefined
    });
    originalConsole.error(...args);
  };

  return NextResponse.next();
}

// Configuração de quais rotas o middleware deve processar
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