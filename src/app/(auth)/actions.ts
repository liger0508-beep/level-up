'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        redirect('/login?message=' + encodeURIComponent('이메일 또는 비밀번호가 올바르지 않습니다.'))
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const role = formData.get('role') as string
    const phone = formData.get('phone') as string
    const branch = formData.get('branch') as string

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                role,
                phone,
                branch,
            },
        },
    })

    if (error) {
        redirect(`/signup?message=${encodeURIComponent(`회원가입 중 오류가 발생했습니다: ${error.message}`)}`)
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

