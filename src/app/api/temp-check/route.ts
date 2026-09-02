import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        const supabaseAdmin = getSupabaseAdmin();
        const { data: records, error } = await supabaseAdmin
            .from('records')
            .select('*')
            .eq('user_id', id);
            
        if (error) return NextResponse.json({ error }, { status: 500 });
            
        return NextResponse.json({ records });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
