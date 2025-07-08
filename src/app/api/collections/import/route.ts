import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { collectionService } from '@/services/collectionService'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    console.log('[IMPORT] Sessão do usuário:', session)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { accessId } = await request.json()
    console.log('[IMPORT] accessId recebido:', accessId)

    if (!accessId) {
      return NextResponse.json(
        { error: 'ID de acesso é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar a coleção original pelo ID de acesso
    const originalCollection = await collectionService.getByAccessId(accessId)
    console.log('[IMPORT] Coleção original encontrada:', originalCollection)
    
    if (!originalCollection) {
      return NextResponse.json(
        { error: 'Coleção não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o usuário já tem uma coleção com o mesmo nome
    const existingCollection = await prisma.collection.findFirst({
      where: {
        userId: session.user.id,
        name: originalCollection.name
      }
    })
    console.log('[IMPORT] Coleção existente:', existingCollection)

    let collectionName = originalCollection.name
    if (existingCollection) {
      // Se já existe, adicionar um número ao nome
      let counter = 1
      while (await prisma.collection.findFirst({
        where: {
          userId: session.user.id,
          name: `${originalCollection.name} (${counter})`
        }
      })) {
        counter++
      }
      collectionName = `${originalCollection.name} (${counter})`
    }

    // Criar uma nova coleção para o usuário atual
    const newCollection = await collectionService.create({
      userId: session.user.id,
      name: collectionName,
      description: originalCollection.description || undefined,
    })
    console.log('[IMPORT] Nova coleção criada:', newCollection)

    // Copiar todas as transcrições da coleção original
    if (originalCollection.items && originalCollection.items.length > 0) {
      for (const item of originalCollection.items) {
        console.log('[IMPORT] Item da coleção:', item)
        // Verificar se a transcrição já existe para este usuário
        const existingTranscription = await prisma.transcription.findFirst({
          where: {
            userId: session.user.id,
            imageUrl: item.transcription.imageUrl
          }
        })
        console.log('[IMPORT] Transcrição existente:', existingTranscription)

        let transcriptionId = existingTranscription?.id

        // Se não existe, criar uma nova transcrição
        if (!existingTranscription) {
          const newTranscription = await prisma.transcription.create({
            data: {
              userId: session.user.id,
              imageUrl: item.transcription.imageUrl,
              text: item.transcription.text,
              confidence: item.transcription.confidence,
              status: item.transcription.status,
              error: item.transcription.error,
            }
          })
          transcriptionId = newTranscription.id
          console.log('[IMPORT] Nova transcrição criada:', newTranscription)
        }

        // Adicionar à nova coleção
        if (transcriptionId) {
          await collectionService.addTranscription({
            collectionId: newCollection.id,
            transcriptionId: transcriptionId
          })
          console.log('[IMPORT] Transcrição adicionada à coleção:', transcriptionId)
        }
      }
    }

    // Buscar a coleção completa com os itens
    const importedCollection = await collectionService.getById(newCollection.id)
    console.log('[IMPORT] Coleção importada final:', importedCollection)
    
    return NextResponse.json(importedCollection)
  } catch (error) {
    console.error('Erro ao importar coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao importar coleção' },
      { status: 500 }
    )
  }
} 
