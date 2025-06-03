const https = require('https');
const fs = require('fs');
const path = require('path');

const MODEL_URL = 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf';
const MODEL_PATH = path.join(process.cwd(), 'public', 'models', 'llama-2-7b-chat.gguf');

// Cria o diretório se não existir
const modelDir = path.dirname(MODEL_PATH);
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

console.log('Baixando modelo LLaMA...');
console.log('Isso pode levar alguns minutos dependendo da sua conexão.');

const file = fs.createWriteStream(MODEL_PATH);
https.get(MODEL_URL, response => {
  const total = parseInt(response.headers['content-length'], 10);
  let current = 0;

  response.on('data', chunk => {
    current += chunk.length;
    const progress = (current / total) * 100;
    process.stdout.write(`\rProgresso: ${progress.toFixed(2)}%`);
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log('\nDownload concluído!');
  });
}).on('error', err => {
  fs.unlink(MODEL_PATH);
  console.error('Erro ao baixar o modelo:', err.message);
}); 