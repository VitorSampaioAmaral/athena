// pages/api/proxy-image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { imageUrl } = req.query;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ error: 'URL da imagem inválida.' });
  }

  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Cuidado com o '*' em produção
    res.send(Buffer.from(response.data, 'binary'));
  } catch (error: any) {
    console.error('Erro ao buscar imagem:', error);
    return res.status(500).json({ error: 'Erro ao buscar a imagem.' });
  }
}