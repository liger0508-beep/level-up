import { isSameDay } from "date-fns";
import { getKstDateStr, getKstTimeStr } from "./utils";
import { ScheduleEvent } from "@/components/schedule/ScheduleCalendar";
import { createClient } from "./supabase/client";

// ── Supabase-backed schedule sync ──

/**
 * Fetch all schedule events from the database.
 * Coach/Admin see all events; athletes see only their own.
 */
export async function getStoredEvents(startDate?: string, endDate?: string): Promise<ScheduleEvent[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get user role
    const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    const role = profile?.role || "athlete";

    let query = supabase
        .from("schedules")
        .select(`
            id,
            user_id,
            creator_id,
            title,
            event_type,
            start_time,
            end_time,
            status,
            users!schedules_user_id_fkey(name),
            creator:users!schedules_creator_id_fkey(name)
        `)
        .order("start_time", { ascending: true });

    let targetUserId = user.id;
    if (role === "parent") {
        const match = profile?.name?.match(/^(.*?) \(/);
        const athleteName = match ? match[1] : profile?.name;
        const { data: athlete } = await supabase.from('users').select('id').eq('role', 'athlete').eq('name', athleteName).maybeSingle();
        if (athlete) {
            targetUserId = athlete.id;
        }
    }

    // Athletes only see their own schedules
    if (role === "athlete" || role === "parent") {
        query = query.eq("user_id", targetUserId);
    }

    if (startDate) {
        query = query.gte("start_time", `${startDate}T00:00:00+09:00`);
    }
    if (endDate) {
        query = query.lte("start_time", `${endDate}T23:59:59+09:00`);
    }

    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) {
            console.error("Error fetching schedules:", error);
            break;
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
    }

    const stored = typeof window !== "undefined" ? localStorage.getItem("gla_coach_completed_items") : null;
    const localCompleted = stored ? JSON.parse(stored) : [];

    return allData.map((item: any) => {
        const isLocalCompleted = localCompleted.some((c: any) =>
            c.participantName === (item.users?.name || "") &&
            c.date === getKstDateStr(item.start_time) &&
            c.type === mapEventType(item.event_type, item.title)
        );

        return {
            id: item.id,
            title: item.title,
            start: new Date(item.start_time),
            end: new Date(item.end_time),
            type: mapEventType(item.event_type, item.title),
            status: item.status === "completed" || isLocalCompleted ? "completed" : "scheduled",
            category: extractCategory(item.title),
            participantName: item.users?.name || "",
            coachName: item.creator?.name || "",
            ownerRole: (item.user_id === user.id || item.creator_id === user.id) ? "me" : (role === "coach" || role === "admin" ? "athlete" : "coach"),
        };
    });
}

/**
 * Save a new event to the database.
 */
export async function saveEvent(event: ScheduleEvent): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
        const res = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event: {
                    ...event,
                    start: event.start.toISOString(),
                    end: event.end.toISOString(),
                },
                userId: user.id
            }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
            console.error("Error saving schedule via API:", json.error);
            return null;
        }
        return event.id;
    } catch (err) {
        console.error("Failed to save schedule:", err);
        return null;
    }
}

/**
 * Update an existing event in the database.
 */
export async function updateEvent(updatedEvent: ScheduleEvent): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    try {
        const res = await fetch("/api/schedules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event: {
                    ...updatedEvent,
                    start: updatedEvent.start.toISOString(),
                    end: updatedEvent.end.toISOString(),
                },
                userId: user.id
            }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
            console.error("Error updating schedule via API:", json.error);
            return false;
        }
        return true;
    } catch (err) {
        console.error("Failed to update schedule:", err);
        return false;
    }
}

/**
 * Delete an event from the database.
 */
export async function deleteEvent(id: string): Promise<boolean> {
    try {
        const res = await fetch("/api/schedules", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
            console.error("Error deleting schedule via API:", json.error);
            return false;
        }
        return true;
    } catch (err) {
        console.error("Failed to delete schedule:", err);
        return false;
    }
}

/**
 * Get today's scheduled items by type (for lesson/training/analysis pages).
 */
export function getTodayScheduledItems(type: "lesson" | "analysis" | "training") {
    // This is now handled directly on each page via Supabase queries
    return [];
}

/**
 * Mark a schedule item as completed in the database.
 */
export async function completeScheduleItem(participantName: string, date: string, type: string, time?: string, scheduleId?: string) {
    const supabase = createClient();

    // 1. If scheduleId is provided, use it directly (most reliable)
    if (scheduleId) {
        const { error } = await supabase
            .from("schedules")
            .update({ status: "completed" })
            .eq("id", scheduleId);

        if (!error) return;
        console.error("Error updating schedule by ID:", error);
    }

    // 2. Fallback: Find matching schedule by name and date
    const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("name", participantName)
        .maybeSingle();

    if (!user) return;

    const startOfDay = `${date}T00:00:00+09:00`;
    const endOfDay = `${date}T23:59:59+09:00`;

    let query = supabase
        .from("schedules")
        .update({ status: "completed" })
        .eq("user_id", user.id)
        .eq("event_type", mapToDbEventType(type as any))
        .gte("start_time", startOfDay)
        .lte("start_time", endOfDay);

    const { error } = await query;
    if (error) {
        console.error("Error updating schedule status FULL DETAILS:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });

        // Fallback to localStorage
        const dateStr = date;
        const COMPLETED_KEY = "gla_coach_completed_items";
        const stored = typeof window !== "undefined" ? localStorage.getItem(COMPLETED_KEY) : null;
        const completed = stored ? JSON.parse(stored) : [];
        completed.push({ participantName, date: dateStr, type, time });
        if (typeof window !== "undefined") localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
    }
}

export async function saveCompletedItem(item: { participantName: string; date: string; type: string; time?: string; scheduleId?: string }) {
    // Migration to database completion
    await completeScheduleItem(item.participantName, item.date, item.type, item.time, item.scheduleId);
}

export function isCompleted(participantName: string, date: Date, type: string, time?: string): boolean {
    if (typeof window === "undefined") return false;
    const COMPLETED_KEY = "gla_coach_completed_items";
    const stored = localStorage.getItem(COMPLETED_KEY);
    if (!stored) return false;
    try {
        const completed = JSON.parse(stored);
        const dateStr = getKstDateStr(date);
        const timeStr = time || getKstTimeStr(date);

        return completed.some((c: any) =>
            c.participantName === participantName &&
            c.date === dateStr &&
            c.type === type &&
            (!c.time || c.time === timeStr)
        );
    } catch {
        return false;
    }
}

// ── Helpers ──

function mapEventType(dbType: string, title: string): ScheduleEvent["type"] {
    // Check title prefix first for precise types
    if (title.startsWith("[분석]")) return "analysis";
    if (title.startsWith("[상담]")) return "consultation";

    const map: Record<string, ScheduleEvent["type"]> = {
        lesson: "lesson",
        training: "training",
        tournament: "other",
        field_lesson: "lesson",
    };
    return map[dbType] || "other";
}

function mapToDbEventType(uiType: ScheduleEvent["type"]): string {
    // DB constraint: 'lesson', 'training', 'tournament', 'field_lesson'
    const map: Record<string, string> = {
        lesson: "lesson",
        training: "training",
        analysis: "lesson",
        consultation: "lesson",
        other: "training",
    };
    return map[uiType] || "training";
}

function getTitleWithType(uiType: ScheduleEvent["type"], title: string): string {
    const prefixMap: Record<string, string> = {
        analysis: "[분석]",
        consultation: "[상담]",
    };
    const prefix = prefixMap[uiType] || "";
    if (prefix && !title.startsWith(prefix)) {
        return `${prefix} ${title}`;
    }
    return title;
}

function extractCategory(title: string): string | undefined {
    const match = title.match(/\(([^)]+)\)/);
    if (match) {
        const cat = match[1].toLowerCase();
        // Match against common categories
        const validCategories = ["shot", "pitch", "bunker", "approach", "putt", "physical", "etc", "field", "short_game"];
        if (validCategories.includes(cat)) return cat;
        // Fallback for Korean labels if they exist in the title
        if (cat.includes("샷")) return "shot";
        if (cat.includes("퍼트")) return "putt";
    }
    return undefined;
}
