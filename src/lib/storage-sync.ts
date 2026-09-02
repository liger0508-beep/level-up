import { createClient } from './supabase/client'

const supabase = createClient()

export async function uploadFile(file: File, bucket: string = 'records', folder: string = ''): Promise<string> {
    let fileToUpload = file;
    let fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    // HEIC 파일일 경우 프론트엔드 단에서 JPG로 변환
    if (fileExt === 'heic' || fileExt === 'heif') {
        try {
            // Dynamic import to prevent SSR 'window is not defined' error
            const heic2any = (await import('heic2any')).default;
            
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.8
            });
            
            const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            
            // 기존 파일명에서 확장자를 .jpg로 변경
            const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            fileToUpload = new File([finalBlob], newName, { type: 'image/jpeg' });
            fileExt = 'jpg';
        } catch (err) {
            console.error('HEIC 변환 실패:', err);
            // 실패 시 원본 그대로 진행 (폴백)
        }
    }

    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // R2 업로드를 위한 Presigned URL 요청
    const presignedRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename: filePath,
            contentType: fileToUpload.type || 'application/octet-stream',
        }),
    });

    if (!presignedRes.ok) {
        const errorData = await presignedRes.json();
        console.error('Failed to get presigned URL:', errorData);
        throw new Error(errorData.error || 'Failed to get presigned URL');
    }

    const { presignedUrl, publicUrl } = await presignedRes.json();

    // R2로 실제 파일 직접 업로드 (PUT 요청)
    const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': fileToUpload.type || 'application/octet-stream',
        },
        body: fileToUpload,
    });

    if (!uploadRes.ok) {
        console.error('Error uploading file to R2:', await uploadRes.text());
        throw new Error('Failed to upload file to R2');
    }

    return publicUrl
}

export async function uploadFiles(files: File[], bucket: string = 'records'): Promise<string[]> {
    if (!files || files.length === 0) return []

    const uploadPromises = files.map(file => uploadFile(file, bucket))
    return Promise.all(uploadPromises)
}
