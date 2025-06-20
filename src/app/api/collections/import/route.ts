import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { collectionService } from '@/services/collectionService'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { accessId } = await request.json()

    if (!accessId) {
      return NextResponse.json(
        { error: 'ID de acesso é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar a coleção original pelo ID de acesso
    const originalCollection = await collectionService.getByAccessId(accessId)
    
    if (!originalCollection) {
      return NextResponse.json(
        { error: 'Coleção não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o usuário já tem uma coleção com o mesmo nome
    const existingCollection = await prisma.collection.findFirst({
      where: {
        userId: session.user.email,
        name: originalCollection.name
      }
    })

    let collectionName = originalCollection.name
    if (existingCollection) {
      // Se já existe, adicionar um número ao nome
      let counter = 1
      while (await prisma.collection.findFirst({
        where: {
          userId: session.user.email,
          name: `${originalCollection.name} (${counter})`
        }
      })) {
        counter++
      }
      collectionName = `${originalCollection.name} (${counter})`
    }

    // Criar uma nova coleção para o usuário atual
    const newCollection = await collectionService.create({
      userId: session.user.email,
      name: collectionName,
      description: originalCollection.description || undefined,
    })

    // Copiar todas as transcrições da coleção original
    if (originalCollection.items && originalCollection.items.length > 0) {
      for (const item of originalCollection.items) {
        // Verificar se a transcrição já existe para este usuário
        const existingTranscription = await prisma.transcription.findFirst({
          where: {
            userId: session.user.email,
            imageUrl: item.transcription.imageUrl
          }
        })

        let transcriptionId = existingTranscription?.id

        // Se não existe, criar uma nova transcrição
        if (!existingTranscription) {
          const newTranscription = await prisma.transcription.create({
            data: {
              userId: session.user.email,
              imageUrl: item.transcription.imageUrl,
              text: item.transcription.text,
              confidence: item.transcription.confidence,
              status: item.transcription.status,
              error: item.transcription.error,
            }
          })
          transcriptionId = newTranscription.id
        }

        // Adicionar à nova coleção
        if (transcriptionId) {
          await collectionService.addTranscription({
            collectionId: newCollection.id,
            transcriptionId: transcriptionId
          })
        }
      }
    }

    // Buscar a coleção completa com os itens
    const importedCollection = await collectionService.getById(newCollection.id)
    
    return NextResponse.json(importedCollection)
  } catch (error) {
    console.error('Erro ao importar coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao importar coleção' },
      { status: 500 }
    )
  }
} 
