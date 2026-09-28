import { createClient } from "./supabase/client";
import { endOfMonth } from "date-fns";
import { getKstDateStr } from "./utils";

export interface MonthlyStatistic {
    id: string; // user id
    name: string;
    branch: string;
    coach: string;
    lesson: number;
    lessonByCoach: number;
    training: number;
    trainingByCoach: number;
    trainingRate: number;
    measurement: number;
    challenge: number;
    score: number;
    consultation: number;
    trainingLog: number;
    attendance: number;
    competition: number;
    reportView: number;
    login: number;
}

export async function fetchMonthlyStatistics(
    year: number,
    month: number,
    searchQuery?: string
): Promise<MonthlyStatistic[]> {
    const supabase = createClient();

    // 1. Get dates
    const startDate = getKstDateStr(new Date(year, month - 1, 1));
    const endDate = getKstDateStr(endOfMonth(new Date(year, month - 1, 1)));
    const monthString = startDate.slice(0, 7);

    try {
        // 2. Fetch all athletes
        let usersQuery = supabase
            .from("users")
            .select("id, name, branch")
            .eq("role", "athlete");

        if (searchQuery) {
            usersQuery = usersQuery.like("name", `%${searchQuery}%`);
        }

        const { data: athletes, error: usersError } = await usersQuery;

        if (usersError || !athletes || athletes.length === 0) {
            return [];
        }

        const athleteIds = athletes.map((a) => a.id);

        // 3. Fetch Monthly Assignments (Coach)
        const { data: assignments } = await supabase
            .from("monthly_assignments")
            .select(`
                athlete_id,
                coach_id,
                coach:coach_id(name)
            `)
            .eq("month", monthString)
            .in("athlete_id", athleteIds);

        const coachMap: Record<string, string> = {};
        const coachIdMap: Record<string, string> = {};
        if (assignments) {
            assignments.forEach((a: any) => {
                coachMap[a.athlete_id] = a.coach?.name || "미지정";
                coachIdMap[a.athlete_id] = a.coach_id;
            });
        }

        // 4. Fetch Attendance
        const { data: attendances } = await supabase
            .from("attendance")
            .select("athlete_id")
            .gte("date", startDate)
            .lte("date", endDate)
            .in("athlete_id", athleteIds);

        const attendanceMap: Record<string, number> = {};
        if (attendances) {
            attendances.forEach((a) => {
                attendanceMap[a.athlete_id] = (attendanceMap[a.athlete_id] || 0) + 1;
            });
        }

        // 5. Fetch Records (lesson, training, analysis, scorecard, journal, challenge)
        // using inserted_at for date boundary
        const { data: records } = await supabase
            .from("records")
            .select("user_id, type, coach_id")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("user_id", athleteIds);

        const recordsMap: Record<string, { lesson: number, lessonByCoach: number, training: number, trainingByCoach: number, measurement: number, score: number, journal: number, challenge: number }> = {};
        
        athleteIds.forEach(id => {
            recordsMap[id] = { lesson: 0, lessonByCoach: 0, training: 0, trainingByCoach: 0, measurement: 0, score: 0, journal: 0, challenge: 0 };
        });

        if (records) {
            records.forEach((r) => {
                if (!r.user_id || !recordsMap[r.user_id]) return;
                
                const map = recordsMap[r.user_id];
                const assignedCoachId = coachIdMap[r.user_id];
                const isByAssignedCoach = assignedCoachId && r.coach_id === assignedCoachId;

                if (r.type === "lesson") {
                    map.lesson++;
                    if (isByAssignedCoach) map.lessonByCoach++;
                }
                if (r.type === "training") {
                    map.training++;
                    if (isByAssignedCoach) map.trainingByCoach++;
                }
                if (r.type === "analysis") map.measurement++;
                if (r.type === "scorecard") map.score++;
                if (r.type === "journal") map.journal++;
                if (r.type === "challenge") map.challenge++;
            });
        }

        // 6. Fetch Consultations
        const { data: consultations } = await supabase
            .from("consultations")
            .select("user_id")
            .gte("date", startDate)
            .lte("date", endDate)
            .in("user_id", athleteIds);

        const consultationMap: Record<string, number> = {};
        if (consultations) {
            consultations.forEach((c) => {
                if (c.user_id) {
                    consultationMap[c.user_id] = (consultationMap[c.user_id] || 0) + 1;
                }
            });
        }
        
        // 7. Fetch user activity (logins & report views)
        // We will create user_activity_logs table
        const { data: activities } = await supabase
            .from("user_activity_logs")
            .select("user_id, activity_type")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("user_id", athleteIds)
            // .catch() to silently ignore if table doesn't exist yet
            .then(res => res, err => ({ data: [] })); 

        const activityMap: Record<string, { login: number, reportView: number }> = {};
        athleteIds.forEach(id => {
            activityMap[id] = { login: 0, reportView: 0 };
        });

        if (activities && !('error' in activities && activities.error)) {
             (activities as any).forEach((a: any) => {
                 if (!a.user_id || !activityMap[a.user_id]) return;
                 if (a.activity_type === "login") activityMap[a.user_id].login++;
                 if (a.activity_type === "report_view") activityMap[a.user_id].reportView++;
             });
        }

        // Combine all data
        const result: MonthlyStatistic[] = athletes.map((athlete) => {
            const rMap = recordsMap[athlete.id];
            
            // For now, trainingRate is 100% if they have training, else 0% (Since we don't have total_assigned easily)
            // Or we could try fetching assignments if the system supports it.
            const trainingRate = rMap.training > 0 ? 100 : 0; 
            
            return {
                id: athlete.id,
                name: athlete.name,
                branch: athlete.branch || "미지정",
                coach: coachMap[athlete.id] || "미지정",
                lesson: rMap.lesson,
                lessonByCoach: rMap.lessonByCoach,
                training: rMap.training,
                trainingByCoach: rMap.trainingByCoach,
                trainingRate,
                measurement: rMap.measurement,
                challenge: rMap.challenge, // If challenges are tracked as records
                score: rMap.score,
                consultation: consultationMap[athlete.id] || 0,
                trainingLog: rMap.journal,
                attendance: attendanceMap[athlete.id] || 0,
                competition: 0, // Mock for now unless we know tournaments
                reportView: activityMap[athlete.id].reportView,
                login: activityMap[athlete.id].login,
            };
        });

        // Filter by coach search query if it doesn't match athlete
        if (searchQuery) {
             return result;
        }

        return result;
    } catch (err) {
        console.error("Error fetching monthly statistics:", err);
        return [];
    }
}




export interface CoachMonthlyStatistic {
    id: string; // user id
    name: string;
    branch: string;
    lesson: number;
    training: number;
    challenge: number;
    consultation: number;
    comment: number;
    reportRate: number;
    login: number;
}

export async function fetchCoachMonthlyStatistics(
    year: number,
    month: number,
    branch?: string
): Promise<CoachMonthlyStatistic[]> {
    const supabase = createClient();

    const startDate = getKstDateStr(new Date(year, month - 1, 1));
    const endDate = getKstDateStr(endOfMonth(new Date(year, month - 1, 1)));
    const monthString = startDate.slice(0, 7);

    try {
        // 1. Fetch Coaches
        let query = supabase.from("users").select("id, name, branch").in("role", ["coach", "admin", "office", "total"]);
        if (branch && branch !== "ALL") {
            query = query.eq("branch", branch);
        }
        
        const { data: coaches, error: usersError } = await query;
        if (usersError || !coaches || coaches.length === 0) return [];
        
        const coachIds = coaches.map((c) => c.id);

        const coachMap: Record<string, CoachMonthlyStatistic> = {};
        coaches.forEach(c => {
            coachMap[c.id] = {
                id: c.id,
                name: c.name,
                branch: c.branch || "미지정",
                lesson: 0,
                training: 0,
                challenge: 0,
                consultation: 0,
                comment: 0,
                reportRate: 0,
                login: 0,
            };
        });

        // 2. Fetch records (lesson, training) written by coaches
        const { data: records } = await supabase
            .from("records")
            .select("coach_id, type")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("coach_id", coachIds);
            
        if (records) {
            records.forEach(r => {
                if (r.coach_id && coachMap[r.coach_id]) {
                    if (r.type === 'lesson') coachMap[r.coach_id].lesson++;
                    if (r.type === 'training') coachMap[r.coach_id].training++;
                }
            });
        }

        // 3. Fetch challenges
        const { data: testSessions } = await supabase
            .from("test_sessions")
            .select("coach_id")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("coach_id", coachIds);
            
        if (testSessions) {
            testSessions.forEach(ts => {
                if (ts.coach_id && coachMap[ts.coach_id]) {
                    coachMap[ts.coach_id].challenge++;
                }
            });
        }

        // 4. Fetch consultations
        const { data: consultations } = await supabase
            .from("consultations")
            .select("coach_id")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("coach_id", coachIds);
            
        if (consultations) {
            consultations.forEach(c => {
                if (c.coach_id && coachMap[c.coach_id]) {
                    coachMap[c.coach_id].consultation++;
                }
            });
        }

        // 5. Fetch comments (any comment by the coach)
        const { data: comments } = await supabase
            .from("comments")
            .select("user_id")
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00")
            .in("user_id", coachIds);
            
        if (comments) {
            comments.forEach(c => {
                if (c.user_id && coachMap[c.user_id]) {
                    coachMap[c.user_id].comment++;
                }
            });
        }

        // 6. Fetch Report Writing Rate
        // 6.1 Get assigned athletes
        const { data: assignments } = await supabase
            .from("monthly_assignments")
            .select("coach_id, athlete_id")
            .eq("month", monthString)
            .in("coach_id", coachIds);
            
        const assignedAthletesCount: Record<string, number> = {};
        const athleteToCoach: Record<string, string> = {};
        if (assignments) {
            assignments.forEach(a => {
                if (a.coach_id && coachMap[a.coach_id]) {
                    assignedAthletesCount[a.coach_id] = (assignedAthletesCount[a.coach_id] || 0) + 1;
                    athleteToCoach[a.athlete_id] = a.coach_id;
                }
            });
        }
        
        // 6.2 Get reports created in this month
        const { data: reports } = await supabase
            .from("player_reports")
            .select("athlete_id")
            .eq("month", monthString);
            
        const reportsCount: Record<string, number> = {};
        if (reports) {
            // Count unique athlete_ids that have a report, and map them to coach
            const reportedAthletes = new Set(reports.map(r => r.athlete_id));
            reportedAthletes.forEach(athleteId => {
                const coachId = athleteToCoach[athleteId];
                if (coachId) {
                    reportsCount[coachId] = (reportsCount[coachId] || 0) + 1;
                }
            });
        }
        
        // Calculate rate
        coachIds.forEach(id => {
            const assigned = assignedAthletesCount[id] || 0;
            const written = reportsCount[id] || 0;
            if (assigned > 0) {
                coachMap[id].reportRate = Math.round((written / assigned) * 100);
            } else {
                coachMap[id].reportRate = 0; // Or -1 to indicate no assignments
            }
        });

        // 7. Fetch logins
        const { data: activityLogs } = await supabase
            .from("user_activity_logs")
            .select("user_id, created_at, activity_type")
            .in("user_id", coachIds)
            .gte("created_at", startDate + "T00:00:00+09:00")
            .lte("created_at", endDate + "T23:59:59+09:00");
            
        const { data: loginLogs } = await supabase
            .from("login_logs")
            .select("user_id, login_time")
            .in("user_id", coachIds)
            .gte("login_time", startDate + "T00:00:00+09:00")
            .lte("login_time", endDate + "T23:59:59+09:00");
            
        const loginMap: Record<string, Set<string>> = {};
        if (activityLogs) {
            activityLogs.forEach(a => {
                if (a.activity_type === "daily_visit") {
                    if (!loginMap[a.user_id]) loginMap[a.user_id] = new Set();
                    loginMap[a.user_id].add(a.created_at.split("T")[0]);
                }
            });
        }
        if (loginLogs) {
            loginLogs.forEach(l => {
                if (!loginMap[l.user_id]) loginMap[l.user_id] = new Set();
                const date = l.login_time.split("T")[0];
                loginMap[l.user_id].add(date);
            });
        }
        
        coachIds.forEach(id => {
            coachMap[id].login = loginMap[id] ? loginMap[id].size : 0;
        });

        return Object.values(coachMap).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        console.error("Error fetching coach monthly statistics:", err);
        return [];
    }
}
