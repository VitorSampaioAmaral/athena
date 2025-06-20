import { NextRequest, NextResponse } from 'next/server';

// Armazenamento em memória para rate limiting
// Em produção, considere usar Redis ou similar
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Janela de tempo em milissegundos
  max: number; // Máximo de requisições por janela
  message?: string; // Mensagem de erro personalizada
}

export function createRateLimiter(config: RateLimitConfig) {
  return function rateLimit(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const now = Date.now();

    // Limpar entradas expiradas
    const entriesToDelete: string[] = [];
    rateLimitStore.forEach((value, key) => {
      if (value.resetTime < now) {
        entriesToDelete.push(key);
      }
    });
    
    entriesToDelete.forEach(key => rateLimitStore.delete(key));

    // Verificar se o IP já tem entrada
    const existing = rateLimitStore.get(ip);
    
    if (existing && existing.resetTime > now) {
      // IP ainda está na janela de tempo
      if (existing.count >= config.max) {
        // Rate limit excedido - log de segurança
        console.log(`[SECURITY] Rate limit exceeded for IP ${ip} on ${request.nextUrl.pathname} - Count: ${existing.count}/${config.max}`);
        
        return NextResponse.json(
          { 
            error: config.message || 'Muitas requisições. Tente novamente mais tarde.',
            retryAfter: Math.ceil((existing.resetTime - now) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((existing.resetTime - now) / 1000).toString(),
              'X-RateLimit-Limit': config.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': existing.resetTime.toString()
            }
          }
        );
      }
      
      // Incrementar contador
      existing.count++;
    } else {
      // Nova entrada ou janela expirada
      rateLimitStore.set(ip, {
        count: 1,
        resetTime: now + config.windowMs
      });
    }

    return null; // Continuar com a requisição
  };
}

// Wrapper para Request padrão
export function createRateLimiterForRequest(config: RateLimitConfig) {
  return function rateLimit(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const now = Date.now();

    // Limpar entradas expiradas
    const entriesToDelete: string[] = [];
    rateLimitStore.forEach((value, key) => {
      if (value.resetTime < now) {
        entriesToDelete.push(key);
      }
    });
    
    entriesToDelete.forEach(key => rateLimitStore.delete(key));

    // Verificar se o IP já tem entrada
    const existing = rateLimitStore.get(ip);
    
    if (existing && existing.resetTime > now) {
      // IP ainda está na janela de tempo
      if (existing.count >= config.max) {
        // Rate limit excedido - log de segurança
        console.log(`[SECURITY] Rate limit exceeded for IP ${ip} - Count: ${existing.count}/${config.max}`);
        
        return NextResponse.json(
          { 
            error: config.message || 'Muitas requisições. Tente novamente mais tarde.',
            retryAfter: Math.ceil((existing.resetTime - now) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((existing.resetTime - now) / 1000).toString(),
              'X-RateLimit-Limit': config.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': existing.resetTime.toString()
            }
          }
        );
      }
      
      // Incrementar contador
      existing.count++;
    } else {
      // Nova entrada ou janela expirada
      rateLimitStore.set(ip, {
        count: 1,
        resetTime: now + config.windowMs
      });
    }

    return null; // Continuar com a requisição
  };
}

// Configurações predefinidas
export const loginRateLimit = createRateLimiterForRequest({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

export const registerRateLimit = createRateLimiterForRequest({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 tentativas de registro
  message: 'Muitas tentativas de registro. Tente novamente em 1 hora.'
});

export const apiRateLimit = createRateLimiterForRequest({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requisições por minuto
  message: 'Muitas requisições. Tente novamente em 1 minuto.'
}); 
