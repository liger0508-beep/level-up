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
  );
};
export async function POST(request: Request) {
  try {
    const { targetUserId, targetPhone, callerName } = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ error: '대상 유저 ID가 필요합니다.' }, { status: 400 });
    }

    if (callerName !== '슈퍼관리자') {
      return NextResponse.json({ error: '슈퍼관리자만 사용할 수 있습니다.' }, { status: 403 });
    }

    if (!targetPhone || targetPhone.length < 4) {
      return NextResponse.json({ error: '대상 유저의 연락처 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    // Extract the last 4 digits of the phone number
    const numericPhone = targetPhone.replace(/[^0-9]/g, '');
    if (numericPhone.length < 4) {
      return NextResponse.json({ error: '대상 유저의 연락처 정보(숫자)가 부족합니다.' }, { status: 400 });
    }
    const newPassword = 'gla' + numericPhone.slice(-4);

    // Update password using Supabase Admin Auth API
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (error) {
      console.error('Password reset failed in Supabase auth:', error);
      return NextResponse.json({ error: `비밀번호 변경 실패: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, newPassword });
  } catch (error: any) {
    console.error('Reset password API error:', error);
    return NextResponse.json({ error: `서버 에러가 발생했습니다: ${error?.message || '알 수 없는 오류'}` }, { status: 500 });
  }
}