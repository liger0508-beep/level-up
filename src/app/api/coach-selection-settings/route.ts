import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FILE_PATH = 'settings/coach_selection.json';
const BUCKET = 'records';

export async function GET() {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .download(FILE_PATH);

        if (error) {
            // Default settings if file doesn't exist
            return NextResponse.json({ enabled: true, startDay: 25, endDay: 31 });
        }

        const text = await data.text();
        const settings = JSON.parse(text);
        return NextResponse.json(settings);
    } catch (e) {
        console.error('Error reading settings:', e);
        return NextResponse.json({ enabled: true, startDay: 25, endDay: 31 });
    }
}

export async function POST(request: Request) {
    try {
        const settings = await request.json();
        
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(FILE_PATH, JSON.stringify(settings), {
                contentType: 'application/json',
                upsert: true
            });
            
        if (error) {
            console.error('Error saving settings:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error in POST settings:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
