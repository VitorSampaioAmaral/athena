// pages/api/extract-colors-sharp.ts
import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import axios from 'axios';

interface ColorResponse {
  colors?: string[]; // Make colors optional here too
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ColorResponse>
) {
  if (req.method !== 'GET') {
    // Now this is valid because 'colors' is optional
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imageUrl } = req.query;

  if (!imageUrl || typeof imageUrl !== 'string') {
    // Now this is valid
    return res.status(400).json({ error: 'Image URL is required' });
  }

  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    const { dominant } = await sharp(imageBuffer).stats();
    const dominantColorHex = `#${dominant.r.toString(16).padStart(2, '0')}${dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`;

    res.status(200).json({ colors: [dominantColorHex] });
  } catch (error: any) {
    console.error('Error in API route /api/extract-colors-sharp:', error);
    // Now this is valid
    res.status(500).json({ error: 'Failed to extract colors from image.' });
  }
}