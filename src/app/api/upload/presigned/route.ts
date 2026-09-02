import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// S3 Client 초기화 (R2 설정)
const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.error('R2 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
    });

    // 5분(300초) 동안 유효한 업로드 전용 일회용 URL 생성
    const presignedUrl = await getSignedUrl(S3, command, { expiresIn: 300 });

    // 최종적으로 저장될 파일의 퍼블릭 URL
    const publicUrl = `${R2_PUBLIC_URL}/${filename}`;

    return NextResponse.json({ presignedUrl, publicUrl, fileKey: filename });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
