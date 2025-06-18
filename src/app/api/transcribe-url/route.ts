import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { transcriptionService } from '@/services/transcriptionService';
import { prisma } from '@/lib/prisma';
import { performance } from 'perf_hooks';

const TIMEOUT_MS = 30000; // 30 segundos
const MIN_DELAY_MS = 30000; // 30 segundos entre transcrições
const MAX_DELAY_MS = 120000; // 2 minutos entre transcrições

// Configuração do OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

async function downloadImage(url: string): Promise<string> {
  console.log('Baixando imagem da URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao baixar imagem: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  
  // Detecta o tipo MIME da imagem
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mimeType = contentType.split(';')[0];
  
  console.log('Imagem baixada com sucesso:', {
    size: buffer.length,
    mimeType,
    base64Length: base64.length
  });

  return `data:${mimeType};base64,${base64}`;
}

async function transcribeWithOpenRouter(imageBase64: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Chave da API OpenRouter não configurada');
  }

  console.log('Iniciando transcrição via OpenRouter...');

  const requestBody = {
    model: "opengvlab/internvl3-14b:free",
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
              url: imageBase64
            }
          }
        ]
      }
    ],
    max_tokens: 2048,
    temperature: 0.7
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

async function processImageWithTimeout(imageUrl: string): Promise<string> {
  console.log('Iniciando processamento da imagem...');
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout ao processar a imagem')), TIMEOUT_MS);
  });

  console.log('Baixando imagem da URL...');
  const imageBase64 = await downloadImage(imageUrl);
  
  console.log('Iniciando transcrição via OpenRouter...');
  const transcriptionPromise = transcribeWithOpenRouter(imageBase64);
  const result = await Promise.race([transcriptionPromise, timeoutPromise]);
  
  console.log('Transcrição concluída:', result);
  return result;
}

export async function POST(request: Request) {
  const startTime = performance.now();
  
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

    const { url } = await request.json();

    if (!url) {
      console.log('URL da imagem não fornecida');
      return NextResponse.json(
        { error: 'URL da imagem é obrigatória' },
        { status: 400 }
      );
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'URL inválida' },
        { status: 400 }
      );
    }

    // Não verifica mais créditos
    console.log('Processando imagem da URL:', url);
    const text = await processImageWithTimeout(url);
    console.log('Texto processado:', text);

    console.log('Salvando transcrição no banco de dados...');
    const transcription = await transcriptionService.create({
      userId: session.user.id,
      imageUrl: url, // Salvar a URL da imagem
      text,
      confidence: 1.0,
      status: 'completed'
    });
    console.log('Transcrição salva:', transcription);

    const endTime = performance.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);

    const response = {
      transcription: text,
      processingTime: `${processingTime} segundos`,
      status: 'success'
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