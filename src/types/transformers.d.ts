declare module '@xenova/transformers' {
  export interface PretrainedOptions {
    device?: 'cpu' | 'webgpu';
    dtype?: {
      [key: string]: string;
    } | string;
    quantized?: boolean;
  }

  export interface GenerationConfig {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    repetition_penalty?: number;
    do_sample?: boolean;
  }

  export type Pipeline = (input: string | string[], options?: GenerationConfig) => Promise<Array<{
    generated_text: string;
  }>>;

  export function pipeline(
    task: string,
    model: string,
    options?: PretrainedOptions
  ): Promise<Pipeline>;
} 