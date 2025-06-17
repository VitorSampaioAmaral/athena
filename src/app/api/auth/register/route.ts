import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerRateLimit } from '@/lib/rateLimit'
import { validateEmail, validatePassword, validateName, sanitizeInput } from '@/lib/validation'
import { securityLogger } from '@/lib/securityLogger'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || undefined;

  // Aplicar rate limiting
  const rateLimitResult = registerRateLimit(request);
  if (rateLimitResult) {
    securityLogger.logRateLimit(ip, '/api/auth/register', userAgent);
    return rateLimitResult;
  }

  try {
    const { name, email, password } = await request.json()

    // Sanitizar entradas
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    // Validação de nome
    const nameValidation = validateName(sanitizedName);
    if (!nameValidation.isValid) {
      securityLogger.logFailedRegister(sanitizedEmail, ip, `invalid_name: ${nameValidation.error}`, userAgent);
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      )
    }

    // Validação de email
    const emailValidation = validateEmail(sanitizedEmail);
    if (!emailValidation.isValid) {
      securityLogger.logFailedRegister(sanitizedEmail, ip, `invalid_email: ${emailValidation.error}`, userAgent);
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      )
    }

    // Validação de senha
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      securityLogger.logFailedRegister(sanitizedEmail, ip, `invalid_password: ${passwordValidation.error}`, userAgent);
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      )
    }

    // Verifica se o email já está em uso
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail.toLowerCase() }
    })

    if (existingUser) {
      securityLogger.logFailedRegister(sanitizedEmail, ip, 'email_already_exists', userAgent);
      return NextResponse.json(
        { error: 'Este email já está em uso' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await hash(password, 12)

    // Cria o usuário
    const user = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail.toLowerCase(),
        password: hashedPassword
      }
    })

    // Log de registro bem-sucedido
    securityLogger.logRegister(user.id, user.email, ip, userAgent);

    // Remove a senha do objeto de retorno
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error('Erro ao registrar usuário:', error)
    securityLogger.logFailedRegister('unknown', ip, 'server_error', userAgent);
    return NextResponse.json(
      { error: 'Erro ao criar conta. Tente novamente.' },
      { status: 500 }
    )
  }
} 