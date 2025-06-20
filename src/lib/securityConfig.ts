// Configurações de segurança centralizadas
export const securityConfig = {
  // Configurações de senha
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // Configurações de sessão
  session: {
    maxAge: 24 * 60 * 60, // 24 horas
    updateAge: 60 * 60, // 1 hora
  },

  // Configurações de rate limiting
  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // máximo 5 tentativas
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 3, // máximo 3 tentativas
    },
    api: {
      windowMs: 60 * 1000, // 1 minuto
      max: 100, // máximo 100 requisições
    },
  },

  // Configurações de validação
  validation: {
    email: {
      maxLength: 254,
    },
    name: {
      minLength: 2,
      maxLength: 100,
    },
    url: {
      maxLength: 2048,
    },
  },

  // Configurações de cookies
  cookies: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60, // 24 horas
  },

  // Headers de segurança
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
};

// Função para aplicar headers de segurança
export function applySecurityHeaders(response: Response): Response {
  Object.entries(securityConfig.headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

// Função para validar força da senha
export function validatePasswordStrength(password: string): {
  score: number; // 0-4 (0 = muito fraco, 4 = muito forte)
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Comprimento
  if (password.length >= 8) score++;
  else feedback.push('Senha deve ter pelo menos 8 caracteres');

  // Letras maiúsculas
  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Senha deve conter pelo menos uma letra maiúscula');

  // Letras minúsculas
  if (/[a-z]/.test(password)) score++;
  else feedback.push('Senha deve conter pelo menos uma letra minúscula');

  // Números
  if (/\d/.test(password)) score++;
  else feedback.push('Senha deve conter pelo menos um número');

  // Caracteres especiais
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  else feedback.push('Senha deve conter pelo menos um caractere especial');

  return { score, feedback };
} 
