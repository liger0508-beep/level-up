import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { recordQrScan } from '@/lib/qr-sync';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const SECRET = new TextEncoder().encode(
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-key-fallback'
);

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        
        // Only coaches or admins can scan
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (!profile || profile.role === 'athlete' || profile.role === 'parent') {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        const { token, eventId } = await request.json();
        if (!token || !eventId) {
            return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
        }

        // Verify Token
        let athleteId;
        try {
            const { payload } = await jwtVerify(token, SECRET);
            athleteId = payload.athleteId as string;
        } catch (e: any) {
            if (e.code === 'ERR_JWT_EXPIRED') {
                return NextResponse.json({ error: '만료된 QR 코드입니다. 다시 생성해주세요.' }, { status: 400 });
            }
            return NextResponse.json({ error: '유효하지 않은 QR 코드입니다.' }, { status: 400 });
        }

        // Admin client to bypass RLS for inserting athlete's attendance
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Record Scan
        const result = await recordQrScan(eventId, athleteId, adminSupabase);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('QR Scan error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
