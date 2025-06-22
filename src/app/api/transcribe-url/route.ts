import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/auth';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Chave da API OpenRouter não configurada' }, { status: 500 });
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL não fornecida' }, { status: 400 });
    }

    // Prompt para descrição detalhada e acessível
    const prompt = `Descreva de forma detalhada e acessível para uma pessoa cega todo o conteúdo da imagem enviada. Inclua:
- As cores predominantes
- Figuras, símbolos e seus significados conceituais (ex: X = negação, coração = amor, etc)
- Todo o texto presente na imagem
- O significado geral ou contexto da imagem
Responda em um parágrafo curto começando com "Imagem contendo ...".`;

    // Chamada à API do OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'opengvlab/internvl3-14b:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: url } }
            ]
          }
        ],
        max_tokens: 512,
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro na transcrição via OpenRouter');
    }

    const transcription = data.choices?.[0]?.message?.content || 'Não foi possível transcrever a imagem.';

    // Salvar transcrição no banco de dados
    let newTranscription;
    try {
      const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/transcriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: url,
          text: transcription,
          confidence: 1.0,
          source: 'url', // Indica que veio de URL
        }),
      });
      if (saveResponse.ok) {
        newTranscription = await saveResponse.json();
      } else {
        console.error('Falha ao salvar transcrição:', await saveResponse.text());
      }
    } catch (e) {
      console.error('Erro ao salvar transcrição no histórico:', e);
    }

    return NextResponse.json({
      transcription: transcription,
      id: newTranscription?.id
    });

  } catch (error) {
    console.error('Erro na transcrição da URL:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
} 
