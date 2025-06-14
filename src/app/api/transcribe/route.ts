import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { transcriptionService } from '@/services/transcriptionService';
import { pipeline } from '@xenova/transformers';

const TIMEOUT_MS = 30000; // 30 segundos

async function processImageWithTimeout(imageData: Buffer): Promise<string> {
  console.log('Iniciando processamento da imagem...');
  const ocr = await pipeline('image-to-text', 'Xenova/trocr-base-handwritten');
  console.log('Modelo OCR carregado');
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout ao processar a imagem')), TIMEOUT_MS);
  });

  console.log('Iniciando OCR...');
  const ocrPromise = ocr(imageData.toString('base64'));
  const result = await Promise.race([ocrPromise, timeoutPromise]);
  console.log('Resultado do OCR:', result);
  
  const text = result[0]?.generated_text || '';
  console.log('Texto extraído:', text);
  return text;
}

export async function POST(request: Request) {
  try {
    console.log('Recebendo requisição de transcrição...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('Usuário não autorizado');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      console.log('Nenhuma imagem enviada');
      return NextResponse.json(
        { error: 'Nenhuma imagem enviada' },
        { status: 400 }
      );
    }

    console.log('Processando imagem...');
    const imageBuffer = await imageFile.arrayBuffer();
    const imageData = Buffer.from(imageBuffer);

    const text = await processImageWithTimeout(imageData);
    console.log('Texto processado:', text);

    console.log('Salvando transcrição no banco de dados...');
    const transcription = await transcriptionService.create({
      userId: session.user.id,
      imageUrl: '', // URL da imagem será atualizada depois
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