export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';
import { v4 as uuidv4 } from 'uuid';
import { transcriptionService } from '@/services/transcriptionService';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Chave da API OpenRouter não configurada' }, { status: 500 });
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'Nenhuma imagem fornecida' }, { status: 400 });
    }

    // Converter imagem para base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // Prompt para descrição detalhada e acessível
    const prompt = `Descreva de forma detalhada e acessível para uma pessoa cega todo o conteúdo da imagem enviada. Inclua:
- As cores predominantes
- Figuras, símbolos e seus significados conceituais (ex: X = negação, coração = amor, etc)
- Todo o texto presente na imagem
- O significado geral ou contexto da imagem
Responda em um parágrafo curto começando com "Imagem contendo ...".`;

    // Chamada à API do OpenRouter (exemplo usando modelo multimodal com visão)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3.2-24b-instruct:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${imageFile.type};base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 512,
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na resposta da API OpenRouter:', data);
      throw new Error(data.error || JSON.stringify(data) || 'Erro na transcrição via OpenRouter');
    }

    // Ajuste conforme a resposta real da API
    const transcription = data.choices?.[0]?.message?.content || 'Não foi possível transcrever a imagem.';

    // Salvar transcrição no banco de dados diretamente
    let newTranscription;
    try {
      const generatedImageUrl = `upload://${uuidv4()}`;
      newTranscription = await transcriptionService.create({
        userId: session.user.id,
        imageUrl: generatedImageUrl,
        text: transcription,
        confidence: 1.0,
        status: 'completed',
        source: 'file',
      });
      console.log('[DEBUG] Transcrição criada diretamente:', newTranscription);
    } catch (e) {
      console.error('Erro ao salvar transcrição no histórico:', e);
    }

    return NextResponse.json({
      transcription: transcription,
      id: newTranscription?.id // Retorna o ID da transcrição salva
    });

  } catch (error) {
    console.error('Erro na transcrição:', error instanceof Error ? error.message : JSON.stringify(error), error);
    return NextResponse.json({ error: error instanceof Error ? error.message : JSON.stringify(error) }, { status: 500 });
  }
} 
