import { NextResponse } from 'next/server';

// Generate a 10-second silent WAV file on the fly
export async function GET() {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSeconds = 10;
  
  const numSamples = sampleRate * durationSeconds;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const headerSize = 44;
  const fileSize = headerSize + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Data section: all zeros = silence
  // ArrayBuffer is already initialized to zeros, so no need to write anything

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': fileSize.toString(),
    },
  });
}
