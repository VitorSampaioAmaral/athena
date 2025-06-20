import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { loginRateLimit } from '@/lib/rateLimit'
import { securityLogger } from '@/lib/securityLogger'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;

  // Aplicar rate limiting
  const rateLimitResult = loginRateLimit(request);
  if (rateLimitResult) {
    securityLogger.logRateLimit(ip, '/api/auth/login', userAgent);
    return rateLimitResult;
  }

  try {
    const { email, password } = await request.json()

    // Validação básica
    if (!email || !password) {
      securityLogger.logFailedLogin(email || 'unknown', ip, 'missing_credentials', userAgent);
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      securityLogger.logFailedLogin(email, ip, 'user_not_found', userAgent);
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      securityLogger.logFailedLogin(email, ip, 'invalid_password', userAgent);
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
    }

    // Log de login bem-sucedido
    securityLogger.logLogin(user.id, user.email, ip, userAgent);

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Erro no login:', error)
    securityLogger.logFailedLogin('unknown', ip, 'server_error', userAgent);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 
