import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = 'records';
const FILE_PATH = 'settings/coach_blockouts.json';

export interface CoachBlockout {
    id: string;
    coachId: string;
    coachName: string;
    type: 'recurring' | 'specific_date';
    dayOfWeek?: number; // 0=Sun, 1=Mon, ..., 6=Sat
    date?: string; // YYYY-MM-DD
    allDay: boolean;
    slots?: string[]; // e.g. ["09:00", "10:00"]
    reason: string;
    createdAt: string;
    createdBy?: string;
}

async function loadBlockouts(): Promise<CoachBlockout[]> {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .download(FILE_PATH);

        if (error || !data) return [];
        const text = await data.text();
        return JSON.parse(text || '[]');
    } catch (e) {
        return [];
    }
}

async function saveBlockouts(blockouts: CoachBlockout[]): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(FILE_PATH, JSON.stringify(blockouts, null, 2), {
                contentType: 'application/json',
                upsert: true
            });
        return !error;
    } catch (e) {
        return false;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const coachName = searchParams.get('coachName');
        const coachId = searchParams.get('coachId');
        const date = searchParams.get('date');

        let blockouts = await loadBlockouts();

        if (coachName) {
            const clean = coachName.replace(/ (감독|코치|프로)$/, '').trim();
            blockouts = blockouts.filter(b => b.coachName === coachName || b.coachName === clean);
        }

        if (coachId) {
            blockouts = blockouts.filter(b => b.coachId === coachId);
        }

        if (date) {
            const [y, m, d] = date.split('-').map(Number);
            const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
            blockouts = blockouts.filter(b => {
                if (b.type === 'recurring') {
                    return b.dayOfWeek === dayOfWeek;
                }
                return b.date === date;
            });
        }

        return NextResponse.json({ blockouts });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, blockouts: [] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { coachId, coachName, type, dayOfWeek, date, allDay, slots, reason, createdBy } = body;

        if (!coachName || !type) {
            return NextResponse.json({ error: '필수 입력값이 누락되었습니다.' }, { status: 400 });
        }

        const newRule: CoachBlockout = {
            id: crypto.randomUUID(),
            coachId: coachId || '',
            coachName: coachName.trim(),
            type,
            dayOfWeek: type === 'recurring' ? (dayOfWeek ?? 1) : undefined,
            date: type === 'specific_date' ? date : undefined,
            allDay: Boolean(allDay),
            slots: allDay ? ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"] : (slots || []),
            reason: reason || (type === 'recurring' ? '정기 휴무' : '일정 불가'),
            createdAt: new Date().toISOString(),
            createdBy: createdBy || 'admin'
        };

        const existing = await loadBlockouts();
        existing.unshift(newRule);
        const success = await saveBlockouts(existing);

        if (!success) {
            return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, rule: newRule });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
        }

        const existing = await loadBlockouts();
        const filtered = existing.filter(b => b.id !== id);
        const success = await saveBlockouts(filtered);

        if (!success) {
            return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

