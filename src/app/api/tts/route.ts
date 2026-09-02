import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get('text');

  if (!text) {
    return new NextResponse('Missing text parameter', { status: 400 });
  }

  try {
    // Use Google Translate's free TTS endpoint
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ko&client=tw-ob`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google TTS API returned ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    return new NextResponse('Error generating TTS', { status: 500 });
  }
}
