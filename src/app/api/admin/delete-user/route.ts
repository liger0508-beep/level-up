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
    const { targetUserId, callerName } = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ error: '대상 유저 ID가 필요합니다.' }, { status: 400 });
    }

    if (callerName !== '슈퍼관리자') {
      return NextResponse.json({ error: '슈퍼관리자만 사용할 수 있습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Delete from public.users first to avoid foreign key constraint errors
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', targetUserId);
    
    if (dbError) {
      console.error('Delete user failed in public.users:', dbError);
      // Even if this fails, we might still want to try deleting from auth.users, but usually this needs to succeed.
    }

    // 2. Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (authError) {
      console.error('Delete user failed in Supabase auth:', authError);
      return NextResponse.json({ error: `계정 삭제 실패: ${authError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete user API error:', error);
    return NextResponse.json({ error: `서버 에러가 발생했습니다: ${error?.message || '알 수 없는 오류'}` }, { status: 500 });
  }
}