import { createClient } from "./supabase/client";
import { format, endOfMonth } from "date-fns";

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
    const startDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
    const endDate = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");
    const monthString = format(new Date(year, month - 1, 1), "yyyy-MM");

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
            .gte("created_at", startDate + "T00:00:00.000Z")
            .lte("created_at", endDate + "T23:59:59.999Z")
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
            .gte("created_at", startDate + "T00:00:00.000Z")
            .lte("created_at", endDate + "T23:59:59.999Z")
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
