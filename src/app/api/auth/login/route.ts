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
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      securityLogger.logFailedLogin(email, ip, 'user_not_found', userAgent);
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      )
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      securityLogger.logFailedLogin(email, ip, 'invalid_password', userAgent);
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      )
    }

    // Log de login bem-sucedido
    securityLogger.logLogin(user.id, user.email, ip, userAgent);

    // Retornar dados do usuário (sem senha)
    const { password: _, ...userWithoutPassword } = user

    // Gera o token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '1d' }
    )

    // Cria a resposta com os dados do usuário
    const response = NextResponse.json(userWithoutPassword)

    // Define o cookie na resposta
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 dia
    })

    return response
  } catch (error) {
    console.error('Erro ao fazer login:', error)
    securityLogger.logFailedLogin('unknown', ip, 'server_error', userAgent);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 