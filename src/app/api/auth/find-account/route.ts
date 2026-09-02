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
        const { action, name, phone, email } = await request.json();

        if (!action || !name || !phone) {
            return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. users 테이블에서 이름으로 사용자 찾은 후 연락처 매칭 (DB에 하이픈이 있을 수 있으므로 JS에서 필터링)
        const { data: usersData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('name', name);

        if (userError || !usersData || usersData.length === 0) {
            return NextResponse.json({ error: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 연락처 숫자만 추출하여 비교
        const numericPhoneInput = phone.replace(/[^0-9]/g, "");
        const users = usersData.filter(u => {
            if (!u.phone) return false;
            return u.phone.replace(/[^0-9]/g, "") === numericPhoneInput;
        });

        if (users.length === 0) {
            return NextResponse.json({ error: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' }, { status: 404 });
        }

        if (users.length > 1) {
            return NextResponse.json({ error: '동일한 정보의 계정이 여러 개 존재합니다. 관리자에게 문의해주세요.' }, { status: 400 });
        }

        const matchedUser = users[0];

        // 2. Auth에서 실제 이메일 가져오기
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(matchedUser.id);

        if (authError || !authUser?.user) {
            return NextResponse.json({ error: '인증 정보를 불러오는데 실패했습니다.' }, { status: 500 });
        }

        const realEmail = authUser.user.email;

        // --- 아이디 찾기 ---
        if (action === 'id') {
            return NextResponse.json({
                success: true,
                email: matchedUser.login_id || realEmail || '이메일 정보가 없습니다.'
            });
        }

        // --- 비밀번호 초기화 ---
        if (action === 'password') {
            if (!email) {
                return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
            }

            // 제공된 이메일이 실제 이메일(또는 login_id)과 일치하는지 검증
            if (email !== realEmail && email !== matchedUser.login_id) {
                return NextResponse.json({ error: '입력하신 이메일 정보가 일치하지 않습니다.' }, { status: 401 });
            }

            // 자동 초기화 (gla + 연락처 뒷자리 4개)
            const numericPhone = phone.replace(/[^0-9]/g, "");
            const last4 = numericPhone.slice(-4);
            const newPassword = 'gla' + last4;

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(matchedUser.id, {
                password: newPassword,
            });

            if (updateError) {
                return NextResponse.json({ error: '비밀번호 초기화 중 오류가 발생했습니다: ' + updateError.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: `비밀번호가 안전하게 초기화되었습니다.\n새 비밀번호: gla${last4}`
            });
        }

        return NextResponse.json({ error: '잘못된 액션입니다.' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || '서버 내부 오류' }, { status: 500 });
    }
}