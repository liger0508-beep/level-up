import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, branch } = body;

        if (!name || !phone || !branch) {
            return NextResponse.json(
                { error: '이름, 폰번호, 지점을 모두 입력해주세요.' },
                { status: 400 }
            );
        }

        // Create Supabase client with SERVICE_ROLE_KEY to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Find the athlete
        const { data: athletes, error: athleteError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'athlete')
            .eq('name', name)
            .eq('phone', phone)
            .eq('branch', branch);

        if (athleteError) {
            console.error('Error finding athlete:', athleteError);
            return NextResponse.json(
                { error: '선수 정보를 조회하는 중 오류가 발생했습니다.' },
                { status: 500 }
            );
        }

        if (!athletes || athletes.length === 0) {
            return NextResponse.json(
                { error: '일치하는 선수 정보를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const athlete = athletes[0];

        // 2. Find how many parents are already linked to this athlete
        // to assign the correct name (e.g. 홍길동 (학부모-1), 홍길동 (학부모-2))
        const { count: parentCount, error: countError } = await supabase
            .from('parent_athlete_mappings')
            .select('*', { count: 'exact', head: true })
            .eq('athlete_id', athlete.id);

        if (countError) {
            console.error('Error counting parents:', countError);
            // Fallback to 0 if there's an error (or if table doesn't exist yet during development)
        }

        const nextParentNumber = (parentCount || 0) + 1;
        const parentDisplayName = `${athlete.name} (학부모-${nextParentNumber})`;

        return NextResponse.json({
            success: true,
            athleteId: athlete.id,
            parentDisplayName: parentDisplayName
        });

    } catch (error) {
        console.error('Verify athlete API error:', error);
        return NextResponse.json(
            { error: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}