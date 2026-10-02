import { NextResponse } from 'next/server';
import { recordQrScan } from '@/lib/qr-sync';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        
        // Only coaches or admins can scan manually
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (!profile || profile.role === 'athlete' || profile.role === 'parent') {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        const { athleteId, eventId } = await request.json();
        if (!athleteId || !eventId) {
            return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
        }

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const result = await recordQrScan(eventId, athleteId, adminSupabase);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Manual Scan error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const supabase = await createClient();
        
        // Only coaches or admins can cancel manually
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (!profile || profile.role === 'athlete' || profile.role === 'parent') {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        const url = new URL(request.url);
        const eventId = url.searchParams.get("eventId");
        const athleteId = url.searchParams.get("athleteId");
        
        if (!athleteId || !eventId) {
            return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
        }

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await adminSupabase
            .from("poll_responses")
            .delete()
            .eq("poll_id", eventId)
            .eq("user_id", athleteId);
            
        if (error) throw new Error(error.message);
        
        return NextResponse.json({ success: true, message: "참가 취소 완료" });
    } catch (error: any) {
        console.error('Manual Cancel error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

