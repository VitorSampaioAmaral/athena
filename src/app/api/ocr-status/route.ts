import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({
        status: 'error',
        message: 'Chave da API OpenRouter não configurada',
        error: 'OPENROUTER_API_KEY não encontrada nas variáveis de ambiente'
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'available',
      message: 'Sistema de transcrição via OpenRouter disponível',
      provider: 'OpenRouter',
      model: 'opengvlab/internvl3-14b:free',
      pricing: 'Gratuito',
      features: [
        'Transcrição de imagens',
        'Suporte a múltiplos formatos',
        'Alta precisão',
        'Modelo gratuito com visão'
      ]
    });
  } catch (error) {
    console.error('Erro ao verificar status do OpenRouter:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Erro ao verificar configuração do OpenRouter',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 