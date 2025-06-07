import { NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    // Validações básicas
    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    const user = await createUser({ email, password, name })

    return NextResponse.json({
      message: 'Usuário criado com sucesso',
      user
    })
  } catch (error) {
    console.error('Erro no registro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
} 