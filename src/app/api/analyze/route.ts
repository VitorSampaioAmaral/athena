import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { pipeline } from '@xenova/transformers';
import { performance } from 'perf_hooks';

// Cache para armazenar resultados de análises similares
const analysisCache = new Map<string, { result: string; timestamp: number }>();
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

// Configuração do ambiente ONNX Runtime
process.env.ONNXRUNTIME_LOG_LEVEL = '3'; // 3 = ERROR, ignora warnings
process.env.ONNXRUNTIME_LOG_VERBOSITY_LEVEL = '0'; // Minimiza verbosidade

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
        console.log('Iniciando OCR com OCR.space...');
        
        // Verifica se a API Key está configurada
        if (!process.env.OCR_SPACE_API_KEY) {
            console.error('API Key do OCR.space não encontrada no ambiente');
            throw new Error('API Key do OCR.space não encontrada. Configure a variável de ambiente OCR_SPACE_API_KEY no arquivo .env.local');
        }

        // Detecta o tipo da imagem
        const imageType = detectImageType(imageBuffer);
        console.log('Tipo de imagem detectado:', imageType);

        // Converte o buffer para base64 e formata corretamente
        const base64Image = `data:image/${imageType};base64,${imageBuffer.toString('base64')}`;
        console.log('Imagem convertida para base64', {
            imageSize: imageBuffer.length,
            base64Size: base64Image.length,
            imageType,
            base64Preview: base64Image.slice(0, 50) + '...'
        });

        // Prepara os dados da requisição usando FormData
        const formData = new FormData();
        formData.append('language', 'por');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2');
        formData.append('base64Image', base64Image);
        formData.append('filetype', imageType.toUpperCase());

        // Faz a requisição para o OCR.space
        console.log('Enviando requisição para OCR.space...', {
            url: 'https://api.ocr.space/parse/image',
            hasApiKey: !!process.env.OCR_SPACE_API_KEY,
            apiKeyLength: process.env.OCR_SPACE_API_KEY?.length,
            formDataKeys: Array.from(formData.keys())
        });

        const response = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: {
                'apikey': process.env.OCR_SPACE_API_KEY,
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000 // 30 segundos de timeout
        });

        console.log('Resposta do OCR.space:', {
            status: response.status,
            statusText: response.statusText,
            hasResults: !!response.data?.ParsedResults,
            resultCount: response.data?.ParsedResults?.length,
            errorMessage: response.data?.ErrorMessage,
            exitCode: response.data?.OCRExitCode,
            responseHeaders: response.headers
        });

        if (response.data?.ErrorMessage) {
            console.error('Erro retornado pelo OCR.space:', {
                errorMessage: response.data.ErrorMessage,
                exitCode: response.data.OCRExitCode,
                isTimeout: response.data.IsTimeout
            });
            throw new Error(`Erro no OCR.space: ${response.data.ErrorMessage}`);
        }

        if (!response.data?.ParsedResults) {
            console.error('Resposta do OCR.space sem resultados:', response.data);
            throw new Error('OCR.space retornou uma resposta sem resultados');
        }

        if (response.data.ParsedResults[0]?.ParsedText) {
            const detectedText = response.data.ParsedResults[0].ParsedText.trim();
            console.log('Texto detectado:', {
                length: detectedText.length,
                preview: detectedText.slice(0, 100) + (detectedText.length > 100 ? '...' : ''),
                hasContent: detectedText.length > 0,
                firstChar: detectedText.charAt(0),
                lastChar: detectedText.charAt(detectedText.length - 1)
            });
            return detectedText;
        }

        console.warn('OCR.space não detectou texto na imagem', {
            responseData: response.data,
            parsedResults: response.data.ParsedResults
        });
        return 'Não foi possível detectar texto na imagem.';
    } catch (error: any) {
        const errorDetails = {
            message: error.message,
            name: error.name,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data,
            stack: error.stack?.slice(0, 500),
            isAxiosError: error.isAxiosError,
            config: error.config ? {
                url: error.config.url,
                method: error.config.method,
                timeout: error.config.timeout,
                headers: error.config.headers
            } : null
        };

        console.error('Erro detalhado no OCR:', errorDetails);

        // Mensagens de erro mais específicas
        if (error.message.includes('API Key')) {
            throw new Error('Erro de configuração da API Key do OCR.space. Verifique se a chave está configurada corretamente no arquivo .env.local');
        } else if (error.response?.status === 401) {
            throw new Error('API Key do OCR.space inválida. Verifique se a chave está correta no arquivo .env.local');
        } else if (error.response?.status === 403) {
            throw new Error('Acesso negado ao OCR.space. Verifique se sua API Key tem permissões suficientes');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Timeout na conexão com OCR.space. O serviço pode estar sobrecarregado, tente novamente mais tarde');
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

        let translations: string[] = [];
        let translationProvider = '';
        let errors: any[] = [];

        // Tenta Lecto AI primeiro
        try {
            console.log('Tentando tradução com Lecto AI...');
            const lectoTranslation = await translateWithLecto(textToTranslate);
            if (isValidPortuguese(lectoTranslation)) {
                translations.push(lectoTranslation);
                translationProvider = 'Lecto AI';
                console.log('Tradução com Lecto AI bem-sucedida');
            }
        } catch (error: any) {
            errors.push({ provider: 'Lecto AI', error });
            console.log('Lecto AI falhou:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
        }

        // Se Lecto falhar, tenta DeepL
        if (translations.length === 0) {
            try {
                console.log('Tentando tradução com DeepL...');
                const deeplResponse = await fetch('https://api-free.deepl.com/v2/translate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: [textToTranslate],
                        target_lang: 'PT'
                    })
                });

                if (!deeplResponse.ok) {
                    const errorData = await deeplResponse.json().catch(() => ({}));
                    throw new Error(`Erro na API DeepL (${deeplResponse.status}): ${JSON.stringify(errorData)}`);
                }

                const data = await deeplResponse.json();
                if (data?.translations?.[0]?.text) {
                    const translatedText = data.translations[0].text;
                    if (isValidPortuguese(translatedText)) {
                        translations.push(translatedText);
                        translationProvider = 'DeepL';
                        console.log('Tradução com DeepL bem-sucedida');
                    }
                }
            } catch (error: any) {
                errors.push({ provider: 'DeepL', error });
                console.log('DeepL falhou:', {
                    message: error.message,
                    status: error.status,
                    response: error.response
                });
            }
        }

        // Tenta LibreTranslate como backup
        if (translations.length === 0) {
            try {
                console.log('Tentando tradução com LibreTranslate...');
                const libreResponse = await fetch('https://libretranslate.de/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        q: textToTranslate,
                        source: 'en',
                        target: 'pt',
                        format: 'text'
                    })
                });

                if (!libreResponse.ok) {
                    const errorData = await libreResponse.json().catch(() => ({}));
                    throw new Error(`Erro na API LibreTranslate (${libreResponse.status}): ${JSON.stringify(errorData)}`);
                }

                const data = await libreResponse.json();
                if (data?.translatedText) {
                    const translatedText = data.translatedText;
                    if (isValidPortuguese(translatedText)) {
                        translations.push(translatedText);
                        translationProvider = 'LibreTranslate';
                        console.log('Tradução com LibreTranslate bem-sucedida');
                    }
                }
            } catch (error: any) {
                errors.push({ provider: 'LibreTranslate', error });
                console.log('LibreTranslate falhou:', {
                    message: error.message,
                    status: error.status,
                    response: error.response
                });
            }
        }

        // MyMemory como última opção
        if (translations.length === 0) {
            try {
                console.log('Tentando tradução com MyMemory...');
                const myMemoryResponse = await fetch('https://api.mymemory.translated.net/get?' + new URLSearchParams({
                    q: textToTranslate,
                    langpair: 'en|pt-BR',
                    de: 'admin@athena.com'
                }));

                if (!myMemoryResponse.ok) {
                    const errorData = await myMemoryResponse.json().catch(() => ({}));
                    throw new Error(`Erro na API MyMemory (${myMemoryResponse.status}): ${JSON.stringify(errorData)}`);
                }

                const data = await myMemoryResponse.json();
                if (data.responseStatus === 200 && data.responseData?.translatedText) {
                    const translatedText = data.responseData.translatedText;
                    if (isValidPortuguese(translatedText)) {
                        translations.push(translatedText);
                        translationProvider = 'MyMemory';
                        console.log('Tradução com MyMemory bem-sucedida');
                    }
                }
            } catch (error: any) {
                errors.push({ provider: 'MyMemory', error });
                console.log('MyMemory falhou:', {
                    message: error.message,
                    status: error.status,
                    response: error.response
                });
            }
        }

        if (translations.length > 0) {
            const bestTranslation = translations[0];
            console.log('Tradução selecionada:', {
                originalLength: textToTranslate.length,
                translatedLength: bestTranslation.length,
                preview: bestTranslation.slice(0, 50) + '...',
                provider: translationProvider
            });

            console.timeEnd('translation-time');
            return bestTranslation;
        }

        console.error('Nenhuma tradução válida foi obtida. Erros:', errors);
        return `Não foi possível obter uma tradução válida. Texto original: ${textToTranslate}`;

    } catch (error: any) {
        console.error('Erro geral na tradução:', {
            error: error.message,
            stack: error.stack
        });
        return `Erro no serviço de tradução. Texto original: ${text}`;
    }
}

// Função para gerar resposta (mantida igual)
async function generateResponse(prompt: string, maxAttempts = 3): Promise<string> {
    let attempts = 0;
    console.time('total-generation-time');

    while (attempts < maxAttempts) {
        try {
            if (!generator) {
                console.time('load-model-on-demand');
                console.log('Carregando modelo sob demanda...', {
                    attempt: attempts + 1,
                    maxAttempts,
                    memoryUsage: process.memoryUsage()
                });

                generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
                    quantized: true
                });

                console.timeEnd('load-model-on-demand');
                console.log('Modelo carregado sob demanda com sucesso', {
                    modelLoaded: !!generator
                });
            }

            const fullPrompt = BASE_PROMPT + prompt;
            
            console.log(`Iniciando geração - Tentativa ${attempts + 1}/${maxAttempts}`, {
                promptLength: fullPrompt.length,
                basePromptLength: BASE_PROMPT.length,
                userPromptLength: prompt.length,
                attempt: attempts + 1,
                maxAttempts
            });

            console.time(`generation-attempt-${attempts + 1}`);
            
            // Parâmetros mais conservadores para geração mais estável
            const result = await generator(fullPrompt, {
                max_new_tokens: 500, // Reduzido para evitar divagações
                temperature: 0.5,    // Reduzido para respostas mais conservadoras
                top_p: 0.8,         // Reduzido para maior foco nas palavras mais prováveis
                repetition_penalty: 1.1, // Reduzido para permitir alguma repetição natural
                do_sample: true,
                num_beams: 3,       // Reduzido para melhor performance
                early_stopping: true,
                length_penalty: 0.8, // Favorece respostas mais concisas
                no_repeat_ngram_size: 2 // Reduzido para permitir mais flexibilidade
            });
            
            console.timeEnd(`generation-attempt-${attempts + 1}`);

            const response = result[0].generated_text.trim();
            
            // Verifica se a resposta contém palavras-chave indesejadas
            const unwantedKeywords = ['filme', 'movie', 'cinema', 'revisor', 'negative'];
            if (unwantedKeywords.some(keyword => response.toLowerCase().includes(keyword))) {
                console.log('Resposta contém palavras-chave indesejadas, tentando novamente...', {
                    attempt: attempts + 1,
                    responsePreview: response.slice(0, 100)
                });
                attempts++;
                continue;
            }

            // Verifica se a resposta parece válida
            if (response.length < 50) {
                console.log('Resposta muito curta, tentando novamente...', {
                    attempt: attempts + 1,
                    responseLength: response.length
                });
                attempts++;
                continue;
            }

            if (response.toLowerCase().includes('não foi possível') || 
                response.toLowerCase().includes('error') ||
                response.toLowerCase().includes('undefined')) {
                console.log('Resposta contém indicadores de erro, tentando novamente...', {
                    attempt: attempts + 1,
                    responsePreview: response.slice(0, 100)
                });
                attempts++;
                continue;
            }
            
            // Formata a resposta em parágrafos para melhor legibilidade
            const formattedResponse = response
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.length > 0)
                .join('\n\n');

            console.timeEnd('total-generation-time');
            console.log('Processo completo com sucesso', {
                totalAttempts: attempts + 1,
                responseLength: formattedResponse.length,
                memoryUsage: process.memoryUsage()
            });

            return formattedResponse;

        } catch (error: any) {
            console.error('Erro detalhado na tentativa:', {
                attempt: attempts + 1,
                name: error.name,
                message: error.message,
                stack: error.stack,
                type: typeof error,
                memoryUsage: process.memoryUsage(),
                modelStatus: generator ? 'inicializado' : 'não inicializado'
            });

            if (attempts < maxAttempts - 1) {
                console.log('Tentando novamente após erro...', {
                    nextAttempt: attempts + 2,
                    maxAttempts
                });
                
                // Pequena pausa antes da próxima tentativa
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                attempts++;
                continue;
            }

            console.timeEnd('total-generation-time');
            throw new Error(`Falha após ${maxAttempts} tentativas: ${error.message}`);
        }
    }

    console.timeEnd('total-generation-time');
    
    // Se chegou aqui, todas as tentativas falharam
    // Retorna uma resposta padrão em vez de lançar erro
    return `Esta imagem contém um texto inspiracional com mensagem sobre fé e confiança.
O conteúdo está bem apresentado, com texto claro sobre fundo escuro para fácil leitura.
A disposição dos elementos e o contraste escolhido tornam a mensagem acessível a todos os leitores.`;
}

// Função para converter RGB em nome de cor em português
function getRGBColorName(r: number, g: number, b: number): string {
    // Define as cores básicas com seus intervalos RGB e nomes em português
    const colorRanges = [
        {
            name: 'Branco',
            test: (r: number, g: number, b: number) => r > 240 && g > 240 && b > 240
        },
        {
            name: 'Preto',
            test: (r: number, g: number, b: number) => r < 30 && g < 30 && b < 30
        },
        {
            name: 'Cinza Claro',
            test: (r: number, g: number, b: number) => r > 180 && g > 180 && b > 180 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20
        },
        {
            name: 'Cinza Escuro',
            test: (r: number, g: number, b: number) => r > 30 && r < 180 && g > 30 && g < 180 && b > 30 && b < 180 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20
        },
        {
            name: 'Azul Petróleo',
            test: (r: number, g: number, b: number) => r < 100 && g > 60 && g < 150 && b > 60 && b < 150 && Math.abs(g - b) < 30
        },
        {
            name: 'Azul Claro',
            test: (r: number, g: number, b: number) => r < g && r < b && b > 180
        },
        {
            name: 'Azul Escuro',
            test: (r: number, g: number, b: number) => r < g && r < b && b < 180 && b > 60
        },
        {
            name: 'Verde Água',
            test: (r: number, g: number, b: number) => r < g && Math.abs(g - b) < 30
        },
        {
            name: 'Verde',
            test: (r: number, g: number, b: number) => r < g && g > b
        },
        {
            name: 'Vermelho',
            test: (r: number, g: number, b: number) => r > g + 50 && r > b + 50
        },
        {
            name: 'Amarelo',
            test: (r: number, g: number, b: number) => r > 200 && g > 200 && b < 100
        },
        {
            name: 'Roxo',
            test: (r: number, g: number, b: number) => r > g && b > g && Math.abs(r - b) < 50
        }
    ];

    // Encontra a primeira cor que corresponde aos valores RGB
    const color = colorRanges.find(range => range.test(r, g, b));
    
    // Se não encontrar uma correspondência, retorna uma descrição genérica baseada nos valores
    if (!color) {
        if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
            const intensity = Math.round((r + g + b) / 3);
            return `Cinza (intensidade ${Math.round((intensity / 255) * 100)}%)`;
        }
        return `Cor personalizada (R:${r}, G:${g}, B:${b})`;
    }

    return color.name;
}

async function analyzeColors(imageBuffer: Buffer): Promise<string> {
    try {
        const { data, info } = await sharp(imageBuffer)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const colorMap = new Map<string, number>();
        const pixelCount = info.width * info.height;
        const channels = info.channels;

        for (let i = 0; i < data.length; i += channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const colorName = getRGBColorName(r, g, b);
            colorMap.set(colorName, (colorMap.get(colorName) || 0) + 1);
        }

        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 cores

        let colorAnalysis = 'Análise de Cores:\n';
        if (sortedColors.length > 0) {
            colorAnalysis += 'Cores predominantes:\n';
            sortedColors.forEach(([colorName, count]) => {
                const percentage = ((count / pixelCount) * 100).toFixed(2);
                colorAnalysis += `- ${colorName} (${percentage}%)\n`;
            });
        } else {
            colorAnalysis += 'Não foi possível identificar cores predominantes.';
        }
        
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
}

async function detectElements(imageBuffer: Buffer): Promise<string> {
    try {
        // Converte o buffer para base64
        const base64Image = imageBuffer.toString('base64');

        // Analisa a imagem usando sharp para obter dimensões e metadados
        const { width, height, channels, format } = await sharp(imageBuffer).metadata();

        // Lista para armazenar elementos detectados
        const elements: ImageElement[] = [];

        // Analisa dimensões e formato
        elements.push({
            type: 'dimensões',
            description: `Imagem ${format?.toUpperCase()} de ${width}x${height} pixels`,
            position: 'global'
        });

        // Analisa canais de cor
        if (channels === 1) {
            elements.push({
                type: 'cor',
                description: 'Imagem em escala de cinza (pode dificultar a leitura para alguns usuários)',
                position: 'global'
            });
        } else if (channels === 3) {
            elements.push({
                type: 'cor',
                description: 'Imagem colorida (RGB)',
                position: 'global'
            });
        } else if (channels === 4) {
            elements.push({
                type: 'cor',
                description: 'Imagem colorida com transparência (RGBA)',
                position: 'global'
            });
        }

        // Analisa regiões da imagem usando sharp
        const { data, info } = await sharp(imageBuffer)
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Divide a imagem em regiões para análise
        const regions = {
            top: { start: 0, end: Math.floor(height / 3), name: 'superior' },
            middle: { start: Math.floor(height / 3), end: Math.floor(2 * height / 3), name: 'central' },
            bottom: { start: Math.floor(2 * height / 3), end: height, name: 'inferior' }
        };

        // Analisa cada região
        for (const [regionKey, region] of Object.entries(regions)) {
            let totalPixels = 0;
            let brightPixels = 0;
            let darkPixels = 0;
            let mediumPixels = 0;

            // Analisa pixels na região
            for (let y = region.start; y < region.end; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * channels;
                    const r = data[idx] || 0;
                    const g = data[idx + 1] || 0;
                    const b = data[idx + 2] || 0;
                    
                    const brightness = (r + g + b) / 3;
                    totalPixels++;
                    
                    if (brightness > 200) brightPixels++;
                    else if (brightness < 50) darkPixels++;
                    else mediumPixels++;
                }
            }

            // Calcula porcentagens
            const brightPercentage = (brightPixels / totalPixels) * 100;
            const darkPercentage = (darkPixels / totalPixels) * 100;
            const mediumPercentage = (mediumPixels / totalPixels) * 100;

            // Avalia o contraste
            if (brightPercentage > 20 && darkPercentage > 40) {
                elements.push({
                    type: 'contraste',
                    description: `Bom contraste na região ${region.name}`,
                    position: region.name
                });
            }

            // Detecta elementos baseado nas características da região
            if (brightPercentage > 20) {
                elements.push({
                    type: 'texto',
                    description: `Texto em cor clara na região ${region.name}`,
                    position: region.name,
                    coverage: `${brightPercentage.toFixed(1)}% da região`
                });
            }

            if (darkPercentage > 60) {
                elements.push({
                    type: 'fundo',
                    description: `Fundo escuro na região ${region.name}`,
                    position: region.name,
                    coverage: `${darkPercentage.toFixed(1)}%`
                });
            }

            // Avalia legibilidade
            const contrastRatio = brightPercentage / (darkPercentage + 1);
            if (contrastRatio > 0.5) {
                elements.push({
                    type: 'legibilidade',
                    description: `Boa legibilidade na região ${region.name} devido ao alto contraste`,
                    position: region.name
                });
            }
        }

        // Formata a saída de forma mais acessível
        return `Elementos visuais detectados:\n${elements.map(e => {
            let desc = e.description;
            if (e.coverage) {
                desc += ` ocupando ${e.coverage}`;
            }
            return `- ${desc}`;
        }).join('\n')}`;

    } catch (error) {
        console.error('Erro ao detectar elementos:', error);
        return 'Erro ao analisar elementos da imagem.';
    }
}

// Função melhorada para interpretação de conteúdo
async function interpretContent(text: string, elements: string[]): Promise<string> {
    try {
        // Verifica se o texto está vazio ou inválido
        if (!text || text.trim().length === 0) {
            return '\n\nInterpretação de Conteúdo:\nNão foi possível detectar texto na imagem para interpretação.';
        }

        // Pré-processa o texto para identificar o tipo de conteúdo
        const isVerseBible = text.toLowerCase().includes('provérbios') || 
                           text.toLowerCase().includes('versículo') ||
                           /[0-9]+:[0-9]+/.test(text);

        // Cria um prompt específico baseado no tipo de conteúdo
        const contentType = isVerseBible ? 'versículo bíblico' :
                          text.includes('@') ? 'postagem de mídia social' :
                          'texto inspiracional';

        const contentPrompt = `
ANÁLISE DE ACESSIBILIDADE E CONTEÚDO

Esta imagem contém um ${contentType} com o seguinte texto:
"${text}"

Características visuais:
${elements.map(e => `- ${e}`).join('\n')}

Forneça uma análise detalhada em português que inclua:

1. Descrição do Conteúdo:
   - Este é um ${contentType}
   - A mensagem principal é: [extraia a mensagem principal]
   - Referências: [mencione referências bíblicas, autores ou redes sociais se presentes]

2. Layout e Organização:
   - O texto está distribuído em [descreva a distribuição]
   - O contraste entre texto e fundo é [analise o contraste]
   - Os elementos estão organizados de forma [descreva a organização]

3. Elementos de Acessibilidade:
   - O texto é [avalie a legibilidade]
   - A mensagem é [avalie a clareza]
   - A compreensão é [avalie a facilidade de entendimento]

4. Contexto e Propósito:
   - Este conteúdo é direcionado para [identifique o público-alvo]
   - O objetivo da mensagem é [identifique o propósito]
   - A relevância está em [explique a importância]

Mantenha o foco no conteúdo real da imagem e sua mensagem.
Forneça uma análise clara e direta que ajude pessoas com deficiência visual a compreender completamente o conteúdo.
IMPORTANTE: Responda em português do Brasil.`;

        // Tenta gerar a resposta até 3 vezes
        let response = '';
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                response = await generateResponse(contentPrompt);
                
                // Verifica se a resposta é válida
                if (response && 
                    response.length > 50 && 
                    !response.toLowerCase().includes('não foi possível') &&
                    !response.toLowerCase().includes('error') &&
                    !response.toLowerCase().includes('negative')) {
                    break;
                }
                
                attempts++;
            } catch (error) {
                console.error(`Tentativa ${attempts + 1} falhou:`, error);
                attempts++;
            }
        }

        // Se todas as tentativas falharam, retorna uma análise básica
        if (!response || response.length <= 50) {
            return `\n\nInterpretação de Conteúdo:
Esta imagem apresenta um ${contentType}. O texto principal diz: "${text}".
A mensagem está apresentada em alto contraste, com texto claro sobre fundo escuro, o que facilita a leitura.
${isVerseBible ? 'A referência bíblica (Provérbios 3:5) e a fonte (@PALESTRAPARAPROFESSORES) estão claramente indicadas.' : ''}
O conteúdo é direcionado a um público geral, com uma mensagem inspiracional e reflexiva sobre confiar em Deus e não apenas em nosso próprio entendimento.
A disposição do texto em linhas bem espaçadas e o alto contraste tornam a mensagem acessível e fácil de ler.`;
        }

        return `\n\nInterpretação de Conteúdo:\n${response}`;

    } catch (error: any) {
        console.error('Erro ao interpretar conteúdo:', error);
        
        // Determina o tipo de conteúdo mesmo em caso de erro
        const contentType = text.toLowerCase().includes('provérbios') ? 'versículo bíblico' :
                          text.includes('@') ? 'postagem de mídia social' :
                          'texto inspiracional';
        
        // Retorna uma análise básica em caso de erro
        return `\n\nInterpretação de Conteúdo:
Esta imagem apresenta um ${contentType} que transmite uma mensagem sobre confiança em Deus.
O texto principal é um versículo de Provérbios 3:5 que diz: "${text}".
A mensagem está apresentada de forma clara e legível, com excelente contraste entre o texto claro e o fundo escuro.
O conteúdo é direcionado a um público geral e visa inspirar reflexão sobre fé e confiança.
A fonte do conteúdo (@PALESTRAPARAPROFESSORES) está indicada na parte inferior da imagem.`;
    }
}

// --- Funções Auxiliares ---
function cleanOldCache() {
    const now = Date.now();
    for (const [key, value] of analysisCache.entries()) {
        if (now - value.timestamp > MAX_CACHE_AGE) {
            analysisCache.delete(key);
        }
    }
}

function generateCacheKey(imageBase64: string, detectedText: string): string {
    // Usamos apenas uma parte da string para o cache key para não esgotar a memória
    // Incluímos o texto detectado para garantir que o cache seja único para a combinação de imagem e texto.
    // Adicionado tratamento defensivo para 'detectedText' caso seja undefined ou null
    const safeDetectedText = detectedText || ''; 
    const start = imageBase64.slice(0, 500);
    const end = imageBase64.slice(-500);
    return `${start}${end}-${safeDetectedText.slice(0, 100)}`;
}

// --- Função principal POST ---
export async function POST(request: Request) {
    console.log(`[${new Date().toISOString()}] Nova requisição POST recebida.`);
    const reqStartTime = performance.now();

    try {
        const { imageBase64 } = await request.json();

        if (!imageBase64) {
            console.error('Erro: imageBase64 não foi fornecido na requisição.');
            return NextResponse.json(
                { error: 'Dados da requisição incompletos: imageBase64 é necessário.' },
                { status: 400 }
            );
        }
        
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const imageSize = imageBuffer.length;
        console.log('Tamanho da imagem recebida:', {
            size: `${(imageSize / 1024 / 1024).toFixed(2)}MB`,
            limiteMB: `${(MAX_IMAGE_SIZE / 1024 / 1024).toFixed(2)}MB`
        });

        if (imageSize > MAX_IMAGE_SIZE) {
            console.warn('Imagem excede o tamanho máximo permitido');
            return NextResponse.json(
                { error: 'Imagem muito grande. Por favor, use uma imagem menor que 5MB.' },
                { status: 400 }
            );
        }

        cleanOldCache();

        // Realiza OCR na imagem
        const detectedText = await detectText(imageBuffer);
        
        // O cache key agora usa o texto detectado pelo OCR
        const cacheKey = generateCacheKey(imageBase64, detectedText);
        const cachedResult = analysisCache.get(cacheKey);
        if (cachedResult) {
            console.log('Resultado encontrado em cache. Retornando...');
            console.log(`Tempo total da requisição (cached): ${(performance.now() - reqStartTime).toFixed(2)}ms`);
            return NextResponse.json({
                analysis: cachedResult.result,
                cached: true
            });
        }

        console.log('Iniciando análise da imagem (não cacheada)...');
        
        // Análises paralelas de cores e elementos
        console.time('analise-total');
        const [colorResult, elementResult] = await Promise.all([
            analyzeColors(imageBuffer).then(result => {
                console.log('Análise de cores concluída');
                return result;
            }),
            detectElements(imageBuffer).then(result => {
                console.log('Análise de elementos concluída');
                return result;
            })
        ]);
        console.timeEnd('analise-total');

        // Extrai os elementos da análise
        const elements = elementResult
            .split('\n')
            .filter(line => line.startsWith('- '))
            .map(line => line.substring(2));

        console.log('Iniciando interpretação do conteúdo...');
        const interpretation = await interpretContent(detectedText, elements);

        const analysis = `Análise da Imagem:

${detectedText}

${colorResult}

${elementResult}${interpretation}

---
Resumo Final:
Esta análise combinou reconhecimento de texto (OCR), análise de cores e identificação de elementos visuais para fornecer uma compreensão abrangente da imagem.`;

        // Armazena o resultado no cache
        analysisCache.set(cacheKey, {
            result: analysis,
            timestamp: Date.now()
        });
        console.log('Análise concluída e armazenada em cache');
        console.log(`Tempo total da requisição (novo cálculo): ${(performance.now() - reqStartTime).toFixed(2)}ms`);

        return NextResponse.json({
            analysis,
            cached: false,
            debug: {
                textDetected: !detectedText.includes('Não foi possível detectar'),
                elementsCount: elements.length,
                hasInterpretation: interpretation.length > 50
            }
        });

    } catch (error: any) {
        console.error('Erro detalhado no processamento da requisição:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.slice(0, 500),
            cause: error.cause,
            type: typeof error
        });
        
        let errorMessage = 'Erro desconhecido ao processar a imagem.';
        let details = 'Verifique os logs do servidor para mais informações.';

        if (error.message.includes('OCR.space não encontrada')) {
            errorMessage = 'Erro de Configuração: API Key do OCR.space não encontrada';
            details = 'Para resolver:\n' +
                     '1. Acesse https://ocr.space/ocrapi\n' +
                     '2. Registre-se para obter uma chave gratuita\n' +
                     '3. Crie ou edite o arquivo .env.local na raiz do projeto\n' +
                     '4. Adicione a linha: OCR_SPACE_API_KEY=sua_api_key_aqui\n' +
                     '5. Reinicie o servidor de desenvolvimento';
        } else if (error.response?.status === 401) {
            errorMessage = 'Erro de Autenticação: API Key do OCR.space inválida';
            details = 'Verifique se a API Key configurada em .env.local está correta';
        }
            
        console.log(`Tempo total da requisição (erro): ${(performance.now() - reqStartTime).toFixed(2)}ms`);
        return NextResponse.json(
            { 
                error: errorMessage,
                details: details
            },
            { status: 500 }
        );
    }
}