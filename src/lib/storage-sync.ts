import { createClient } from './supabase/client'

const supabase = createClient()

export async function uploadFile(file: File, bucket: string = 'records', folder: string = ''): Promise<string> {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file)

    if (error) {
        console.error('Error uploading file:', error)
        throw error
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

    return publicUrl
}

export async function uploadFiles(files: File[], bucket: string = 'records'): Promise<string[]> {
    if (!files || files.length === 0) return []

    const uploadPromises = files.map(file => uploadFile(file, bucket))
    return Promise.all(uploadPromises)
}
