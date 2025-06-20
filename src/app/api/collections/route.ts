export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { collectionService } from '@/services/collectionService'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()
    const collection = await collectionService.create({
      userId: session.user.email,
      name: data.name,
      description: data.description,
    })
    
    return NextResponse.json(collection)
  } catch (error) {
    console.error('Erro ao criar coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao criar coleção' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const accessId = searchParams.get('accessId')
    
    if (accessId) {
      // Buscar coleção por ID de acesso (público)
      const collection = await collectionService.getByAccessId(accessId)
      
      if (!collection) {
        return NextResponse.json(
          { error: 'Coleção não encontrada' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(collection)
    }
    
    // Listar coleções do usuário
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const collections = await collectionService.getByUserId(session.user.email)
    return NextResponse.json(collections)
  } catch (error) {
    console.error('Erro ao buscar coleções:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar coleções' },
      { status: 500 }
    )
  }
} 
