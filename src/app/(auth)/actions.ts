'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        redirect('/login?message=' + encodeURIComponent('이메일 또는 비밀번호가 올바르지 않습니다.'))
    }

    if (authData.user) {
        await supabase.from('login_logs').insert([{ user_id: authData.user.id }])
        // 새롭게 추가한 활동 로그 테이블에도 'login' 기록 남기기
        await supabase.from('user_activity_logs').insert([{ user_id: authData.user.id, activity_type: 'login' }])
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
    // 중복 확인 (이름 또는 전화번호 중 하나라도 같으면 차단)
    const adminSupabase = await createAdminClient()
    const { data: existingUser } = await adminSupabase
        .from('users')
        .select('id, name, phone')
        .or(`name.eq.${name},phone.eq.${phone}`)
        .limit(1)
        .maybeSingle()

    if (existingUser) {
        if (existingUser.name === name) {
            redirect(`/signup?message=${encodeURIComponent('동일한 이름으로 가입된 계정이 이미 존재합니다. (동명이인 불가)')}`)
        } else {
            redirect(`/signup?message=${encodeURIComponent('동일한 전화번호로 가입된 계정이 이미 존재합니다.')}`)
        }
    }

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

