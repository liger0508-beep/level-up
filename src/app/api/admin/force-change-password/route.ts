import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

export async function POST(request: Request) {
    try {
        const { targetUserId, newPassword, callerName } = await request.json();

        if (!targetUserId || !newPassword) {
            return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 });
        }

        if (callerName !== '슈퍼관리자') {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. 관리자 권한으로 비밀번호 강제 변경
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
            password: newPassword,
        });

        if (updateError) {
            return NextResponse.json({ error: '비밀번호 변경 중 오류가 발생했습니다: ' + updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '비밀번호가 강제로 변경되었습니다.' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
    }
}