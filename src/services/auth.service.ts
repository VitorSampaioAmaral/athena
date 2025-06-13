import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export interface UserCreateInput {
  email: string
  name: string
  password: string
}

export interface UserLoginInput {
  email: string
  password: string
}

export class AuthService {
  static async register(data: UserCreateInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      throw new Error('Email já está em uso')
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })

    return user
  }

  static async login(data: UserLoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (!user) {
      throw new Error('Credenciais inválidas')
    }

    const validPassword = await bcrypt.compare(data.password, user.password)

    if (!validPassword) {
      throw new Error('Credenciais inválidas')
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name
    }
  }
} 