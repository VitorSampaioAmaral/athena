// src/app/api/extract-colors-sharp/route.ts
import { NextRequest, NextResponse } from 'next/server'; // Use these for App Router
import sharp from 'sharp'; // Make sure you have 'sharp' installed
import axios from 'axios'; // Make sure you have 'axios' installed

// Define the type for the response, making 'colors' optional for error cases
interface ColorResponse {
  colors?: string[];
  error?: string;
}

// Export a GET function to handle GET requests
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('imageUrl');

  if (!imageUrl) {
    // Return JSON response using NextResponse.json
    return NextResponse.json(
      { error: 'Image URL is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch the image data
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Use sharp to extract colors (simplified example)
    const { dominant } = await sharp(imageBuffer).stats();
    const dominantColorHex = `#<span class="math-inline">\{dominant\.r\.toString\(16\)\.padStart\(2, '0'\)\}</span>{dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`;

    // Return JSON response using NextResponse.json
    return NextResponse.json(
      { colors: [dominantColorHex] },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in App Router API route /api/extract-colors-sharp:', error);
    // Return JSON error response
    return NextResponse.json(
      { error: 'Failed to extract colors from image.' },
      { status: 500 }
    );
  }
}
