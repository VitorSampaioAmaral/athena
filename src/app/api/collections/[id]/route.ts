import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { collectionService } from '@/services/collectionService'

export async function GET(request: Request, context: any) {
  const { params } = await context;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const collection = await collectionService.getById(params.id)
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Coleção não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a coleção pertence ao usuário
    if (collection.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    return NextResponse.json(collection)
  } catch (error) {
    console.error('Erro ao buscar coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar coleção' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: any) {
  const { params } = await context;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Verificar se a coleção pertence ao usuário
    const collection = await collectionService.getById(params.id)
    if (!collection || collection.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Coleção não encontrada ou não autorizada' },
        { status: 404 }
      )
    }

    await collectionService.delete(params.id)
    
    return NextResponse.json({ message: 'Coleção excluída com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir coleção' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, context: any) {
  const { params } = await context;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()

    // Verificar se a coleção pertence ao usuário
    const collection = await collectionService.getById(params.id)
    if (!collection || collection.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Coleção não encontrada ou não autorizada' },
        { status: 404 }
      )
    }

    const updatedCollection = await collectionService.update(params.id, {
      name: data.name,
      description: data.description,
    })
    
    return NextResponse.json(updatedCollection)
  } catch (error) {
    console.error('Erro ao atualizar coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar coleção' },
      { status: 500 }
    )
  }
} 