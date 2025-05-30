import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama2',
      prompt: `Você é um assistente especializado em análise de imagens. 
Analise a seguinte descrição de imagem e forneça:

1. Cores predominantes que você imagina que estariam presentes
2. Objetos e figuras que você imagina que seriam identificados
3. Possível significado contextual
4. Possível simbolismo e interpretação

Por favor, responda em português de forma detalhada.

Descrição da imagem: ${imageBase64.substring(0, 100)}...`,
      stream: false
    });

    return NextResponse.json({
      analysis: response.data.response
    });
  } catch (error) {
    console.error('Erro na análise da imagem:', error);
    return NextResponse.json(
      { error: 'Erro ao processar a imagem. Por favor, tente um modelo mais leve como o Llama2 ou verifique se o Ollama está rodando.' },
      { status: 500 }
    );
  }
} 