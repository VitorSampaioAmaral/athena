import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { transcriptionService } from '@/services/transcriptionService';
import { prisma } from '@/lib/prisma';

const TIMEOUT_MS = 30000; // 30 segundos
const MIN_DELAY_MS = 30000; // 30 segundos entre transcrições
const MAX_DELAY_MS = 120000; // 2 minutos entre transcrições

// Configuração do OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

async function transcribeWithOpenRouter(imageUrl: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Chave da API OpenRouter não configurada');
  }

  console.log('Iniciando transcrição via OpenRouter...');

  const requestBody = {
    model: "opengvlab/internvl3-14b:free", // Modelo gratuito com :free
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise esta imagem de forma completa e acessível. Forneça:\n\n1. TEXTO EXTRAÍDO: Todo o texto visível na imagem\n2. DESCRIÇÃO VISUAL: Descrição detalhada incluindo:\n   - Cores predominantes e contrastes\n   - Símbolos, ícones e elementos gráficos\n   - Layout e organização dos elementos\n   - Objetos, pessoas ou cenários visíveis\n   - Qualquer informação contextual importante\n\n3. CONTEXTO: O que a imagem representa ou comunica\n\nFormate a resposta assim:\n\n=== TEXTO EXTRAÍDO ===\n[texto encontrado]\n\n=== DESCRIÇÃO VISUAL ===\n[descrição detalhada]\n\n=== CONTEXTO ===\n[contexto da imagem]"
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Athena OCR System',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Erro na API OpenRouter:', errorData);
    throw new Error(`Erro na API OpenRouter: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Resposta do OpenRouter:', data);

  const text = data.choices?.[0]?.message?.content || '';
  console.log('Texto extraído via OpenRouter:', text);
  
  return text.trim();
}

async function checkCredits(userId: string): Promise<{ canProceed: boolean; nextAvailable?: Date; waitTime?: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Verificar limite diário (50 transcrições por dia)
  const todayTranscriptions = await prisma.transcription.count({
    where: {
      userId,
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  if (todayTranscriptions >= 50) {
    return { canProceed: false };
  }

  // Verificar delay desde última transcrição
  const lastTranscription = await prisma.transcription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  if (lastTranscription) {
    const timeSinceLast = Date.now() - lastTranscription.createdAt.getTime();
    const delayNeeded = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, timeSinceLast));
    
    if (timeSinceLast < delayNeeded) {
      const nextAvailable = new Date(lastTranscription.createdAt.getTime() + delayNeeded);
      return { 
        canProceed: false, 
        nextAvailable,
        waitTime: delayNeeded - timeSinceLast
      };
    }
  }

  return { canProceed: true };
}

async function processImageWithTimeout(imageUrl: string): Promise<string> {
  console.log('Iniciando processamento da imagem...');
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout ao processar a imagem')), TIMEOUT_MS);
  });

  console.log('Iniciando transcrição via OpenRouter...');
  const transcriptionPromise = transcribeWithOpenRouter(imageUrl);
  const result = await Promise.race([transcriptionPromise, timeoutPromise]);
  
  console.log('Transcrição concluída:', result);
  return result;
}

export async function POST(request: Request) {
  try {
    console.log('Recebendo requisição de transcrição por URL...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('Usuário não autorizado');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { imageUrl } = await request.json();

    if (!imageUrl) {
      console.log('URL da imagem não fornecida');
      return NextResponse.json(
        { error: 'URL da imagem é obrigatória' },
        { status: 400 }
      );
    }

    // Validar URL
    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: 'URL inválida' },
        { status: 400 }
      );
    }

    // Verificar créditos antes de processar
    const creditCheck = await checkCredits(session.user.id);
    if (!creditCheck.canProceed) {
      if (creditCheck.nextAvailable) {
        return NextResponse.json(
          { 
            error: 'Aguarde antes de fazer outra transcrição',
            nextAvailable: creditCheck.nextAvailable,
            waitTime: creditCheck.waitTime
          },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          { error: 'Limite diário de transcrições atingido (50 por dia)' },
          { status: 429 }
        );
      }
    }

    console.log('Processando imagem da URL:', imageUrl);
    const text = await processImageWithTimeout(imageUrl);
    console.log('Texto processado:', text);

    console.log('Salvando transcrição no banco de dados...');
    const transcription = await transcriptionService.create({
      userId: session.user.id,
      imageUrl: imageUrl, // Salvar a URL da imagem
      text,
      confidence: 1.0,
      status: 'completed'
    });
    console.log('Transcrição salva:', transcription);

    const response = {
      transcription: text,
      id: transcription.id
    };
    console.log('Enviando resposta:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro ao transcrever imagem:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar a imagem' },
      { status: 500 }
    );
  }
} 