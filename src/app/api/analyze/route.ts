import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { pipeline } from '@xenova/transformers';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { broadcastProgress } from '../progress/route';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { transcriptionService } from '@/services/transcriptionService';

// Tipos para análise
type AnalysisStatus = 'started' | 'completed' | 'error' | 'hit';

interface CacheEntry {
    result: string;
    timestamp: number;
}

// Cache para armazenar resultados de análises similares
const analysisCache = new Map<string, CacheEntry>();
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB em bytes

// Cache para o modelo e prompt base
let generator: any = null;
const BASE_PROMPT = `Você é um especialista em análise de imagens e acessibilidade.
Como assistente de descrição de imagens, sua tarefa é fornecer uma análise detalhada e acessível em português.
Foque em ajudar pessoas com deficiência visual a compreender completamente o conteúdo.
Mantenha suas respostas diretas e relevantes ao conteúdo apresentado.
Nunca mencione filmes, cinema ou outros temas não relacionados à imagem.
Analise o seguinte conteúdo:

`;

// Cache para o modelo
let detector: any = null;

// Configuração do ambiente ONNX Runtime
process.env.ONNXRUNTIME_LOG_LEVEL = '3'; // 3 = ERROR, ignora warnings
process.env.ONNXRUNTIME_LOG_VERBOSITY_LEVEL = '0'; // Minimiza verbosidade

interface AnalysisLog {
  timestamp: number;
  stage: string;
  status: 'started' | 'completed' | 'error';
  message: string;
  details?: any;
}

const analysisLogs: AnalysisLog[] = [];

function logAnalysis(stage: string, status: AnalysisStatus, message: string, data?: any) {
    const log = {
        stage,
        status,
        message,
        data,
        timestamp: Date.now()
    };
    console.log(`[${new Date(log.timestamp).toISOString()}] ${stage}: ${message}`);
    broadcastProgress(log);
}

// --- Funções de Validação e Tradução ---
function isValidPortuguese(text: string): boolean {
    if (!text || text.trim().length < 3) return false;

    const commonPortugueseWords = ['de', 'o', 'a', 'os', 'as', 'um', 'uma', 'e', 'que', 'para', 'em', 'com', 'não', 'por', 'mais', 'da', 'do', 'na', 'no'];

    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    if (words.length === 0) return false;

    const commonWordsFound = words.filter(word => commonPortugueseWords.includes(word));
    const ratio = commonWordsFound.length / words.length;

    const hasPortugueseChars = /[áàâãéèêíïóôõöúüçñ]/i.test(text);
    const hasValidStructure = /^[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ]/.test(text.trim());
    const hasLetters = /[a-záàâãéèêíïóôõöúüçñ]/i.test(text);

    return hasLetters && (ratio >= 0.15 || hasPortugueseChars || (hasValidStructure && words.length >= 2));
}

function isEnglish(text: string): boolean {
    if (!text || text.trim().length < 3) return false;

    const commonEnglishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'is', 'this', 'are', 'we'];

    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    if (words.length === 0) return false;

    const commonWordsFound = words.filter(word => commonEnglishWords.includes(word));
    const ratio = commonWordsFound.length / words.length;

    const hasPortugueseChars = /[áàâãéèêíïóôõöúüçñ]/i.test(text);
    const hasLetters = /[a-z]/i.test(text);

    return hasLetters && ratio >= 0.1 && !hasPortugueseChars;
}

// Função para detectar o tipo de imagem baseado nos bytes iniciais
function detectImageType(buffer: Buffer): string {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
    const bmpSignature = Buffer.from([0x42, 0x4D]);
    const gifSignature = Buffer.from([0x47, 0x49, 0x46]);

    if (buffer.slice(0, pngSignature.length).equals(pngSignature)) {
        return 'png';
    } else if (buffer.slice(0, jpegSignature.length).equals(jpegSignature)) {
        return 'jpg';
    } else if (buffer.slice(0, bmpSignature.length).equals(bmpSignature)) {
        return 'bmp';
    } else if (buffer.slice(0, gifSignature.length).equals(gifSignature)) {
        return 'gif';
    }
    return 'png'; // Fallback para PNG
}

// --- Funções de OCR e Tradução ---
async function detectText(imageBuffer: Buffer): Promise<string> {
    try {
        console.log('Iniciando OCR com OpenRouter...');
        
        // Verifica se a API Key está configurada
        if (!process.env.OPENROUTER_API_KEY) {
            console.error('API Key do OpenRouter não encontrada no ambiente');
            throw new Error('API Key do OpenRouter não encontrada. Configure a variável de ambiente OPENROUTER_API_KEY no arquivo .env.local');
        }

        // Detecta o tipo da imagem
        const imageType = detectImageType(imageBuffer);
        console.log('Tipo de imagem detectado:', imageType);

        // Converte o buffer para base64
        const base64Image = `data:${imageType};base64,${imageBuffer.toString('base64')}`;
        console.log('Imagem convertida para base64', {
            imageSize: imageBuffer.length,
            base64Size: base64Image.length,
            imageType
        });

        // Configuração do OpenRouter
        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
        const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

        const requestBody = {
            model: "opengvlab/internvl3-14b:free",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Extraia apenas o texto visível nesta imagem. Retorne apenas o texto encontrado, sem comentários adicionais ou análises."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64Image
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1024,
            temperature: 0.1
        };

        console.log('Enviando requisição para OpenRouter...');

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

        console.log('Resposta do OpenRouter:', {
            status: response.status,
            statusText: response.statusText
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro na API OpenRouter:', errorData);
            throw new Error(`Erro na API OpenRouter: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Resposta do OpenRouter:', data);

        const text = data.choices?.[0]?.message?.content || '';
        console.log('Texto extraído via OpenRouter:', {
            length: text.length,
            preview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
            hasContent: text.length > 0
        });
        
        return text.trim() || 'Não foi possível detectar texto na imagem.';
    } catch (error: any) {
        console.error('Erro detalhado no OCR com OpenRouter:', {
            message: error.message,
            name: error.name,
            status: error.response?.status,
            statusText: error.response?.statusText,
            stack: error.stack?.slice(0, 500)
        });

        // Mensagens de erro mais específicas
        if (error.message.includes('API Key')) {
            throw new Error('Erro de configuração da API Key do OpenRouter. Verifique se a chave está configurada corretamente no arquivo .env.local');
        } else if (error.response?.status === 401) {
            throw new Error('API Key do OpenRouter inválida. Verifique se a chave está correta no arquivo .env.local');
        } else if (error.response?.status === 403) {
            throw new Error('Acesso negado ao OpenRouter. Verifique se sua API Key tem permissões suficientes');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Timeout na conexão com OpenRouter. O serviço pode estar sobrecarregado, tente novamente mais tarde');
        }

        throw error;
    }
}

// Função para traduzir usando Lecto AI
async function translateWithLecto(text: string): Promise<string> {
    try {
        // Validação inicial do texto
        if (!text || typeof text !== 'string') {
            throw new Error('Texto inválido fornecido para tradução');
        }

        const textToTranslate = text.trim();
        if (textToTranslate.length === 0) {
            throw new Error('Texto vazio fornecido para tradução');
        }

        // Divide o texto preservando a pontuação
        const chunks = textToTranslate
            .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
            ?.map(chunk => chunk.trim())
            .filter(chunk => chunk.length > 0) || [textToTranslate];

        const translations: string[] = [];

        console.log('Iniciando tradução com Lecto AI:', {
            totalChunks: chunks.length,
            chunkSizes: chunks.map(chunk => chunk.length)
        });

        for (const chunk of chunks) {
            console.log('Processando chunk:', {
                size: chunk.length,
                preview: chunk
            });

            const response = await fetch('https://api.lecto.ai/v1/translate/text', {
                method: 'POST',
                headers: {
                    'X-API-Key': process.env.LECTO_API_KEY || '',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    texts: [chunk],
                    to: ['pt-BR'],
                    from: 'en'
                })
            });

            const responseText = await response.text();
            console.log('Resposta da API Lecto:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseText
            });

            if (!response.ok) {
                throw new Error(`Erro na API Lecto (${response.status}): ${responseText}`);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e: unknown) {
                console.error('Erro ao parsear JSON:', responseText);
                const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido';
                throw new Error(`Erro ao parsear resposta da API Lecto: ${errorMessage}`);
            }

            // Validação detalhada da estrutura da resposta
            if (!data) {
                throw new Error('Resposta vazia da API Lecto');
            }

            // Extrai a tradução da estrutura aninhada
            let translatedText: string | undefined;

            if (Array.isArray(data.translations)) {
                const translation = data.translations[0];
                if (translation && typeof translation === 'object') {
                    if (Array.isArray(translation.translated) && translation.translated.length > 0) {
                        translatedText = translation.translated[0];
                    }
                } else if (typeof translation === 'string') {
                    translatedText = translation;
                }
            }

            if (!translatedText || typeof translatedText !== 'string') {
                console.error('Formato inesperado da resposta:', {
                    data,
                    translatedText,
                    responseText
                });
                throw new Error('Não foi possível extrair a tradução da resposta');
            }

            // Garante que a pontuação final seja preservada
            if (!translatedText.match(/[.!?]$/)) {
                const originalPunctuation = chunk.match(/[.!?]+$/)?.[0];
                if (originalPunctuation) {
                    translatedText += originalPunctuation;
                }
            }

            console.log('Chunk traduzido:', {
                original: chunk,
                translated: translatedText
            });

            translations.push(translatedText);
        }

        // Junta as traduções preservando espaços e pontuação
        const translatedText = translations
            .map(t => t.trim())
            .join(' ')
            .replace(/\s+([.!?])/g, '$1') // Remove espaços antes da pontuação
            .replace(/([.!?])(?=[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ])/g, '$1 '); // Adiciona espaço após pontuação seguida de maiúscula

        console.log('Tradução completa:', {
            originalLength: textToTranslate.length,
            translatedLength: translatedText.length,
            preview: translatedText
        });

        // Validação mais flexível do português
        if (translatedText.length > 0 && (
            isValidPortuguese(translatedText) || 
            translatedText.match(/[áàâãéèêíïóôõöúüçñ]/i) ||
            /^[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ].*[.!?]$/.test(translatedText)
        )) {
            return translatedText;
        }

        throw new Error(`Tradução inválida retornada pela Lecto AI: ${translatedText}`);
    } catch (error: any) {
        const errorDetails = {
            message: error.message,
            status: error.status,
            response: error.response,
            stack: error.stack,
            originalError: error.originalError || error
        };

        console.error('Erro na tradução com Lecto AI:', errorDetails);
        throw error;
    }
}

async function translateToPortuguese(text: string): Promise<string> {
    try {
        console.time('translation-time');
        
        // Validação inicial do texto
        if (!text || typeof text !== 'string') {
            throw new Error('Texto inválido fornecido para tradução');
        }

        const textToTranslate = text.trim();
        if (textToTranslate.length === 0) {
            throw new Error('Texto vazio fornecido para tradução');
        }

        console.log('Iniciando tradução:', {
            textLength: textToTranslate.length,
            preview: textToTranslate.slice(0, 50) + '...'
        });

        // Usando apenas Lecto AI para tradução
        try {
            console.log('Traduzindo com Lecto AI...');
            const lectoTranslation = await translateWithLecto(textToTranslate);
            if (isValidPortuguese(lectoTranslation)) {
                console.log('Tradução com Lecto AI bem-sucedida');
                console.timeEnd('translation-time');
                return lectoTranslation;
            }
        } catch (error: any) {
            console.error('Erro na tradução com Lecto AI:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
            throw error;
        }

        throw new Error('Não foi possível obter uma tradução válida');

    } catch (error: any) {
        console.error('Erro geral na tradução:', {
            error: error.message,
            stack: error.stack
        });
        return `Erro no serviço de tradução. Texto original: ${text}`;
    }
}

// Função para analisar elementos simbólicos usando Sharp
async function analyzeSymbolicElements(imageBuffer: Buffer): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(imageBuffer);
    
    // Obtém metadados da imagem
    const metadata = await image.metadata();
    
    // Analisa cores predominantes
    const { dominant } = await image.stats();
    const colors = await analyzeColors(imageBuffer);
    
    const symbolicElements: string[] = [];

    // Analisa proporções da imagem
    if (metadata.width && metadata.height) {
      const ratio = metadata.width / metadata.height;
      if (ratio > 1.5) {
        symbolicElements.push('Imagem em formato paisagem (pode indicar cenas amplas ou panorâmicas)');
      } else if (ratio < 0.67) {
        symbolicElements.push('Imagem em formato retrato (pode indicar foco em elementos verticais)');
      }
    }

    // Analisa cores predominantes
    if (colors.includes('vermelho')) {
      symbolicElements.push('Uso significativo da cor vermelha (pode indicar alerta, perigo ou proibição)');
    }
    if (colors.includes('verde')) {
      symbolicElements.push('Uso significativo da cor verde (pode indicar sucesso, aprovação ou permissão)');
    }
    if (colors.includes('amarelo')) {
      symbolicElements.push('Uso significativo da cor amarela (pode indicar cautela ou atenção)');
    }
    if (colors.includes('azul')) {
      symbolicElements.push('Uso significativo da cor azul (pode indicar confiança, segurança ou informação)');
    }

    // Analisa contraste
    const { channels } = await image.stats();
    const contrast = Math.max(...channels.map((c: { stdev: number }) => c.stdev)) / 128;
    if (contrast > 0.7) {
      symbolicElements.push('Alto contraste na imagem (pode indicar elementos dramáticos ou importantes)');
    } else if (contrast < 0.3) {
      symbolicElements.push('Baixo contraste na imagem (pode indicar sutileza ou suavidade)');
    }

    // Analisa nitidez
    const { entropy } = await image.stats();
    if (entropy > 7) {
      symbolicElements.push('Imagem com alta nitidez (pode indicar foco em detalhes)');
    } else if (entropy < 4) {
      symbolicElements.push('Imagem com baixa nitidez (pode indicar suavidade ou desfoque)');
    }

    return symbolicElements.length > 0 
      ? `\nElementos Simbólicos Detectados:\n${symbolicElements.join('\n')}`
      : '';
  } catch (error) {
    console.error('Erro na análise de elementos simbólicos:', error);
    return '';
  }
}

// Função para analisar o significado da imagem usando InternVL3 14B
async function analyzeImageMeaning(imageBuffer: Buffer): Promise<string> {
  const startTime = performance.now();
  const base64Image = imageBuffer.toString('base64');
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/VitorSampaioAmaral/athena",
      "X-Title": "Athena Image Analysis",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "opengvlab/internvl3-14b:free",
      "messages": [
        {
          "role": "system",
          "content": "Você é um especialista em análise de imagens e acessibilidade. Como assistente de descrição de imagens, sua tarefa é fornecer uma análise detalhada e acessível em português. Foque em ajudar pessoas com deficiência visual a compreender completamente o conteúdo."
        },
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": "Analise esta imagem de forma completa e acessível. Forneça:\n\n1. TEXTO EXTRAÍDO: Todo o texto visível na imagem\n2. DESCRIÇÃO VISUAL: Descrição detalhada incluindo:\n   - Cores predominantes e contrastes\n   - Símbolos, ícones e elementos gráficos\n   - Layout e organização dos elementos\n   - Objetos, pessoas ou cenários visíveis\n   - Qualquer informação contextual importante\n\n3. CONTEXTO: O que a imagem representa ou comunica\n\nFormate a resposta assim:\n\n=== TEXTO EXTRAÍDO ===\n[texto encontrado]\n\n=== DESCRIÇÃO VISUAL ===\n[descrição detalhada]\n\n=== CONTEXTO ===\n[contexto da imagem]"
            },
            {
              "type": "image_url",
              "image_url": {
                "url": `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      "temperature": 0.7,
      "max_tokens": 2048,
      "stream": false
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`Erro na requisição ao OpenRouter: ${response.statusText}`);
  }

  const result = await response.json();
  const endTime = performance.now();
  const processingTime = ((endTime - startTime) / 1000).toFixed(2);

  const firstChoice = result.choices?.[0];
  if (!firstChoice) {
    throw new Error('Resposta da API não possui choices válidas');
  }

  const content =
    (typeof firstChoice === 'string' ? firstChoice : null) ||
    firstChoice.message?.content ||
    firstChoice.content ||
    firstChoice.text ||
    firstChoice.response ||
    (typeof firstChoice === 'object' ? JSON.stringify(firstChoice) : null);

  if (!content || content.trim() === '') {
    throw new Error('Resposta da API vazia');
  }

  return content;
}

// Função para gerar resposta usando o modelo de texto
async function generateResponse(prompt: string): Promise<string> {
  const startTime = performance.now();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/VitorSampaioAmaral/athena",
      "X-Title": "Athena Image Analysis",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "opengvlab/internvl3-14b:free",
      "messages": [
        {
          "role": "system",
          "content": "Você é um assistente especializado em análise de imagens. Sua resposta DEVE ser em português do Brasil e seguir o formato:\n\n=== TEXTO EXTRAÍDO ===\n[texto encontrado]\n\n=== DESCRIÇÃO VISUAL ===\n[descrição detalhada]\n\n=== CONTEXTO ===\n[contexto da imagem]\n\nUse português do Brasil e mantenha a resposta acessível e detalhada."
        },
        {
          "role": "user",
          "content": `Com base na análise anterior: "${prompt}", forneça uma interpretação detalhada seguindo o formato:\n\n=== TEXTO EXTRAÍDO ===\n[texto encontrado]\n\n=== DESCRIÇÃO VISUAL ===\n[descrição detalhada]\n\n=== CONTEXTO ===\n[contexto da imagem]\n\nUse português do Brasil e mantenha a resposta acessível e detalhada.`
        }
      ],
      "temperature": 0.7,
      "max_tokens": 2048
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(`Erro na requisição ao OpenRouter: ${response.statusText}`);
  }

  const result = await response.json();
  const endTime = performance.now();
  const processingTime = ((endTime - startTime) / 1000).toFixed(2);

  const firstChoice = result.choices?.[0];
  if (!firstChoice) {
    throw new Error('Resposta da API não possui choices válidas');
  }

  const content =
    (typeof firstChoice === 'string' ? firstChoice : null) ||
    firstChoice.message?.content ||
    firstChoice.content ||
    firstChoice.text ||
    firstChoice.response ||
    (typeof firstChoice === 'object' ? JSON.stringify(firstChoice) : null);

  if (!content || content.trim() === '') {
    throw new Error('Resposta da API vazia');
  }

  return content;
}

// Função para converter RGB para HSV
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;

    if (diff !== 0) {
        switch (max) {
            case r:
                h = 60 * ((g - b) / diff + (g < b ? 6 : 0));
                break;
            case g:
                h = 60 * ((b - r) / diff + 2);
                break;
            case b:
                h = 60 * ((r - g) / diff + 4);
                break;
        }
    }

    return { h, s: s * 100, v: v * 100 };
}

// Função para determinar o nome da cor usando HSV
function getNomeCorHSV(h: number, s: number, v: number): string {
    // Ajusta o matiz para lidar com o vermelho (que cruza 0/360)
    if (h < 0) h += 360;
    if (h >= 360) h -= 360;

    // Casos especiais primeiro (cores acromáticas)
    if (v <= 20) return 'Preto';
    if (v >= 95 && s <= 10) return 'Branco';
    if (s <= 10) {
        if (v < 30) return 'Cinza Escuro';
        if (v < 70) return 'Cinza';
        return 'Cinza Claro';
    }

    // Define as faixas de cores
    if (h >= 345 || h < 10) {
        return v < 50 ? 'Vermelho Escuro' : 'Vermelho';
    }
    if (h >= 10 && h < 20) {
        return v < 50 ? 'Marrom Escuro' : 'Marrom';
    }
    if (h >= 20 && h < 40) {
        if (s < 40 && v > 80) return 'Bege';
        if (s > 80 && v > 60) return 'Dourado';
        return 'Laranja';
    }
    if (h >= 40 && h < 70) {
        return v > 90 ? 'Amarelo Claro' : 'Amarelo';
    }
    if (h >= 70 && h < 150) {
        if (h < 90) return 'Verde Lima';
        return v < 50 ? 'Verde Escuro' : 'Verde';
    }
    if (h >= 150 && h < 180) {
        return 'Verde Água';
    }
    if (h >= 180 && h < 200) {
        return 'Ciano';
    }
    if (h >= 200 && h < 270) {
        if (v < 50) return 'Azul Marinho';
        if (v > 80) return 'Azul Claro';
        return 'Azul';
    }
    if (h >= 270 && h < 290) {
        return v < 50 ? 'Roxo Escuro' : 'Roxo';
    }
    if (h >= 290 && h < 345) {
        return v > 80 ? 'Rosa Claro' : 'Rosa';
    }

    return 'Cor Indefinida';
}

async function analyzeColors(imageBuffer: Buffer): Promise<string> {
    try {
        // Processa a imagem usando sharp para obter os pixels
        const { data, info } = await sharp(imageBuffer)
            .resize(300, 300, { fit: 'inside' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        console.log('Informações da imagem:', {
            width: info.width,
            height: info.height,
            channels: info.channels,
            size: data.length
        });

        const pixels = [];
        const channels = info.channels;

        // Converte os pixels para HSV
        for (let i = 0; i < data.length; i += channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Pula pixels transparentes se houver canal alpha
            if (channels === 4 && data[i + 3] === 0) continue;

            const hsv = rgbToHsv(r, g, b);
            
            // Log para debug dos primeiros pixels
            if (pixels.length < 5) {
                console.log('Pixel RGB:', { r, g, b });
                console.log('Pixel HSV:', hsv);
            }

            pixels.push(hsv);
        }

        // Agrupa cores similares usando HSV
        const colorGroups = new Map();
        pixels.forEach(pixel => {
            // Ajusta os intervalos para melhor agrupamento
            const h = Math.floor(pixel.h / 20) * 20; // Grupos de 20 graus
            const s = Math.floor(pixel.s / 20) * 20; // Grupos de 20%
            const v = Math.floor(pixel.v / 20) * 20; // Grupos de 20%
            
            const key = `${h},${s},${v}`;
            colorGroups.set(key, (colorGroups.get(key) || 0) + 1);
        });

        // Debug das cores encontradas
        console.log('Grupos de cores:', Array.from(colorGroups.entries()).slice(0, 5));

        // Converte para array e ordena por frequência
        const sortedColors = Array.from(colorGroups.entries())
            .map(([key, count]) => {
                const [h, s, v] = key.split(',').map((x: string) => parseFloat(x));
                return {
                    h, s, v,
                    count,
                    percentage: (count / pixels.length) * 100
                };
            })
            .sort((a, b) => b.percentage - a.percentage)
            .filter(color => color.percentage > 1) // Reduz o limiar para 1%
            .slice(0, 10); // Aumenta para 10 cores

        // Debug das cores ordenadas
        console.log('Cores ordenadas:', sortedColors.slice(0, 3));

        // Gera o relatório
        let colorAnalysis = 'Análise de Cores:\nCores predominantes:\n';
        sortedColors.forEach(color => {
            const colorName = getNomeCorHSV(color.h, color.s, color.v);
            const percentage = color.percentage.toFixed(1);
            colorAnalysis += `- ${colorName} (${percentage}%, HSV: ${Math.round(color.h)}°, ${Math.round(color.s)}%, ${Math.round(color.v)}%)\n`;
        });

        return colorAnalysis;
    } catch (error) {
        console.error('Erro ao analisar cores:', error);
        return 'Erro ao analisar as cores da imagem.';
    }
}

interface ImageElement {
    type: string;
    description: string;
    position?: string;
    coverage?: string;
    confidence?: number;
}

// Função para detectar elementos na imagem usando Sharp
async function detectElements(imageBuffer: Buffer): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(imageBuffer);
    
    // Obtém metadados da imagem
    const metadata = await image.metadata();
    
    // Analisa características da imagem
    const { channels, entropy } = await image.stats();
    const contrast = Math.max(...channels.map((c: { stdev: number }) => c.stdev)) / 128;
    
    const elements: string[] = [];

    // Analisa proporções
    if (metadata.width && metadata.height) {
      const ratio = metadata.width / metadata.height;
      if (ratio > 1.5) {
        elements.push('Formato paisagem');
      } else if (ratio < 0.67) {
        elements.push('Formato retrato');
      } else {
        elements.push('Formato quadrado');
      }
    }

    // Analisa contraste
    if (contrast > 0.7) {
      elements.push('Alto contraste');
    } else if (contrast < 0.3) {
      elements.push('Baixo contraste');
    } else {
      elements.push('Contraste médio');
    }

    // Analisa nitidez
    if (entropy > 7) {
      elements.push('Alta nitidez');
    } else if (entropy < 4) {
      elements.push('Baixa nitidez');
    } else {
      elements.push('Nitidez média');
    }

    // Analisa cores
    const colors = await analyzeColors(imageBuffer);
    if (Array.isArray(colors)) {
      elements.push(...colors);
    } else {
      elements.push(colors);
    }

    return elements.join(', ');
  } catch (error) {
    console.error('Erro na detecção de elementos:', error);
    return '';
  }
}

// Função para gerar hash de uma imagem
function generateImageHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Lock em memória para evitar múltiplas análises simultâneas por usuário
const userAnalysisLocks = new Set<string>();

// Função principal de análise
export async function POST(request: Request) {
    const startTime = performance.now();
    let analysisResult: string | null = null;
    let errorMessage: string | null = null;
    
    try {
        // Verificar autenticação
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.id) {
            console.log('Usuário não autorizado');
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            );
        }

        // BLOQUEIO: impede múltiplas análises simultâneas por usuário
        const userId = session.user.id;
        if (userAnalysisLocks.has(userId)) {
            return NextResponse.json(
                { error: 'Já existe uma análise em andamento para este usuário. Aguarde a conclusão.' },
                { status: 429 }
            );
        }
        userAnalysisLocks.add(userId);

        try {
            const formData = await request.formData();
            const file = formData.get('file') as File;
            
            if (!file) {
                return NextResponse.json(
                    { error: 'Nenhum arquivo enviado' },
                    { status: 400 }
                );
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            try {
                // Analisa a imagem
                analysisResult = await analyzeImageMeaning(buffer);
                console.log('Análise concluída com sucesso:', analysisResult);
            } catch (error) {
                console.error('Erro na análise da imagem:', error);
                errorMessage = error instanceof Error ? error.message : 'Erro na análise da imagem';
                // Continua para tentar gerar a resposta mesmo com erro na análise
            }

            try {
                // Gera a resposta final
                if (analysisResult) {
                    const response = await generateResponse(analysisResult);
                    console.log('Resposta gerada com sucesso:', response);
                    const endTime = performance.now();
                    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
                    
                    // Salvar no banco de dados
                    console.log('Salvando análise no banco de dados...');
                    const transcription = await transcriptionService.create({
                        userId: session.user.id,
                        imageUrl: '', // URL da imagem será atualizada depois
                        text: response,
                        confidence: 1.0,
                        status: 'completed'
                    });
                    console.log('Análise salva:', transcription);
                    
                    return NextResponse.json({
                        analysis: response,
                        processingTime: `${processingTime} segundos`,
                        status: 'success',
                        id: transcription.id
                    });
                }
            } catch (error) {
                console.error('Erro na geração da resposta:', error);
                errorMessage = error instanceof Error ? error.message : 'Erro na geração da resposta';
                // Continua para retornar o que temos
            }

            // Se chegou aqui, temos algum erro mas podemos ter uma análise
            const endTime = performance.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            
            if (analysisResult) {
                // Se temos uma análise, retornamos ela mesmo com erro
                console.log('Retornando análise parcial:', analysisResult);
                return NextResponse.json({
                    analysis: analysisResult,
                    processingTime: `${processingTime} segundos`,
                    status: 'partial',
                    error: errorMessage
                });
            }

            // Se não temos nem análise nem resposta, retornamos o erro
            console.error('Nenhuma análise disponível, retornando erro:', errorMessage);
            return NextResponse.json({
                error: errorMessage || 'Erro desconhecido',
                processingTime: `${processingTime} segundos`,
                status: 'error'
            }, { status: 500 });

        } finally {
            userAnalysisLocks.delete(userId);
        }

    } catch (error) {
        const endTime = performance.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2);
        console.error(`Erro durante o processamento (${processingTime}s):`, error);
        
        // Se temos uma análise mesmo com erro geral, retornamos ela
        if (analysisResult) {
            console.log('Retornando análise parcial após erro geral:', analysisResult);
            return NextResponse.json({
                analysis: analysisResult,
                processingTime: `${processingTime} segundos`,
                status: 'partial',
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
        
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            processingTime: `${processingTime} segundos`,
            status: 'error'
        }, { status: 500 });
    }
}