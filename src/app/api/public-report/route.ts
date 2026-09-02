import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const getSupabaseAdmin = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        
        // 1. Fetch the report
        const { data: report, error: reportError } = await supabaseAdmin
            .from('player_reports')
            .select('*')
            .eq('id', id)
            .single();

        if (reportError || !report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const athleteId = report.athlete_id;
        const month = report.month;
        const content = report.content || {};

        // 2. Fetch the athlete's name/branch
        const { data: athlete } = await supabaseAdmin
            .from('users')
            .select('name, branch')
            .eq('id', athleteId)
            .single();

        // 3. Fetch scorecards
        const { data: allScorecards } = await supabaseAdmin
            .from('scorecards')
            .select('id, round_date, total_score')
            .eq('user_id', athleteId);
        
        const savedScorecards = content.scorecards || [];
        const scorecards = (allScorecards || []).filter(s => savedScorecards.includes(s.id));

        // 4. Fetch lessons and tests
        const { data: recordsRes } = await supabaseAdmin
            .from('records')
            .select('id, type, category, title, content, score, media_urls, created_at, coach_id')
            .eq('user_id', athleteId)
            .in('type', ['lesson', 'analysis'])
            .order('created_at', { ascending: false });

        // Since we cannot do relational join easily without mapping coach_id to users, let's just fetch all coaches
        const { data: coaches } = await supabaseAdmin.from('users').select('id, name');
        const coachMap = new Map((coaches || []).map(c => [c.id, c.name]));

        const records = (recordsRes || []).map(r => ({
            ...r,
            coach: { name: coachMap.get(r.coach_id) || '코치' }
        }));

        const monthRecords = records.filter(r => r.created_at && r.created_at.startsWith(month));
        
        const includedLessonIds = new Set(content.lessons || content.includedLessonIds || []);
        const lessons = records.filter(r => r.type === 'lesson' && includedLessonIds.has(r.id));
        const analyses = monthRecords.filter(r => r.type === 'analysis');

        const { data: testsRes } = await supabaseAdmin
            .from('test_sessions')
            .select('*')
            .eq('user_id', athleteId);

        const savedTests = new Set(content.tests || []);
        const monthTests = (testsRes || []).filter(t => savedTests.has(t.id)).map(t => ({
            ...t,
            type: 'test',
            score: t.total_score,
            coach: { name: coachMap.get(t.coach_id) || '코치' },
            content: {
                ...t.raw_shot_data,
                driver: { score: t.driver_score },
                iron: { score: t.iron_score },
                short_putt: t.short_putt_score,
                middle_putt: t.middle_putt_score,
                long_putt: t.long_putt_score,
                shortApproach: t.short_approach_score,
                middleApproach: t.middle_approach_score,
                longApproach: t.long_approach_score,
                shortBunker: t.short_bunker_score,
                longBunker: t.long_bunker_score
            }
        }));

        // 5. Fetch trainings
        const savedTrainings = new Set(content.trainings || []);
        let trainings: any[] = [];
        
        if (savedTrainings.size > 0) {
            const { data: trainingsRes } = await supabaseAdmin
                .from('records')
                .select('*')
                .eq('user_id', athleteId)
                .eq('type', 'training')
                .in('id', Array.from(savedTrainings));
            trainings = trainingsRes || [];
        } else {
            // fallback: fetch all for the month
            const { data: trainingsRes } = await supabaseAdmin
                .from('records')
                .select('*')
                .eq('user_id', athleteId)
                .eq('type', 'training');
            const isInMonth = (dateStr: string | null | undefined) => {
                if (!dateStr) return false;
                if (dateStr.length === 7) return dateStr === month;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return dateStr.startsWith(month);
                
                // Convert to KST (+9 hours) since server might run in UTC
                const kstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
                const m = kstDate.getUTCMonth() + 1;
                const y = kstDate.getUTCFullYear();
                return `${y}-${m.toString().padStart(2, '0')}` === month;
            };

            trainings = (trainingsRes || []).filter(t => 
                isInMonth(t.created_at) || 
                isInMonth(t.training_start) ||
                isInMonth(t.training_end) ||
                (t.training_start && t.training_end && t.training_start <= month + '-31' && t.training_end >= month + '-01')
            );
        }

        // 6. Fetch tournament results
        const { data: tourList } = await supabaseAdmin
            .from('tournament_results')
            .select('*, tournaments(name)')
            .eq('athlete_name', athlete?.name || 'unknown');

        let finalTours: any[] = [];
        if (tourList) {
            const filteredTours = tourList.filter(t => t.round_date && t.round_date.startsWith(month));
            const uniqueToursMap = new Map<string, any>();
            const tournamentDatesMap = new Map<string, string[]>();
            
            for (const tour of filteredTours) {
                const key = tour.tournament_id || tour.tournaments?.name || tour.notes || "unknown";
                
                if (tour.round_date) {
                    const currentDates = tournamentDatesMap.get(key) || [];
                    if (!currentDates.includes(tour.round_date)) {
                        currentDates.push(tour.round_date);
                    }
                    tournamentDatesMap.set(key, currentDates);
                }
                
                const existing = uniqueToursMap.get(key);
                if (!existing || (Number(tour.round_number || 0) > Number(existing.round_number || 0))) {
                    uniqueToursMap.set(key, tour);
                }
            }
            
            finalTours = Array.from(uniqueToursMap.values()).map(tour => {
                const key = tour.tournament_id || tour.tournaments?.name || tour.notes || "unknown";
                const dates = tournamentDatesMap.get(key) || [];
                
                let dateSpan = "-";
                if (dates.length > 0) {
                    const sortedDates = [...dates].sort();
                    if (sortedDates.length === 1) {
                        const parts = sortedDates[0].split('-');
                        dateSpan = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : sortedDates[0].substring(5).replace('-', '/');
                    } else {
                        const first = sortedDates[0];
                        const last = sortedDates[sortedDates.length - 1];
                        const firstParts = first.split('-');
                        const lastParts = last.split('-');
                        if (firstParts.length >= 3 && lastParts.length >= 3) {
                            if (firstParts[1] === lastParts[1]) {
                                dateSpan = `${firstParts[1]}/${firstParts[2]}-${lastParts[2]}`;
                            } else {
                                dateSpan = `${firstParts[1]}/${firstParts[2]}-${lastParts[1]}/${lastParts[2]}`;
                            }
                        } else {
                            dateSpan = `${first.substring(5).replace('-', '/')}-${last.substring(5).replace('-', '/')}`;
                        }
                    }
                }
                
                return {
                    ...tour,
                    formattedDateSpan: dateSpan
                };
            });
        }

        // 7. Return aggregated data
        return NextResponse.json({
            report,
            athlete: {
                name: athlete?.name || '선수',
                branch: athlete?.branch || '지점'
            },
            scorecards,
            lessons,
            analyses,
            tests: monthTests,
            trainings: trainings || [],
            tournamentResults: finalTours
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
