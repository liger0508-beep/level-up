export interface CoachSlotConfig {
    id: string;
    coachId: string;
    coachName: string;
    month: string; // "default" or "YYYY-MM"
    useAm: boolean;
    amStart: string; // "HH:mm"
    amEnd: string;   // "HH:mm"
    usePm: boolean;
    pmStart: string; // "HH:mm"
    pmEnd: string;   // "HH:mm"
    durationMinutes: number;
    breakMinutes: number;
    disabledSlots?: string[];
    updatedAt: string;
}

export interface TimeSlotItem {
    key: string;
    label: string;
    start: string;
    end: string;
}

export const ATHLETE_DEFAULT_SLOTS: TimeSlotItem[] = [
    { key: "09:00", label: "9시", start: "09:00", end: "10:00" },
    { key: "10:00", label: "10시", start: "10:00", end: "11:00" },
    { key: "11:00", label: "11시", start: "11:00", end: "12:00" },
    { key: "14:00", label: "14시", start: "14:00", end: "15:00" },
    { key: "15:00", label: "15시", start: "15:00", end: "16:00" },
    { key: "16:00", label: "16시", start: "16:00", end: "17:00" },
    { key: "17:00", label: "17시", start: "17:00", end: "18:00" },
];

export const COACH_DEFAULT_SLOTS: TimeSlotItem[] = [
    { key: "08:00", label: "8시", start: "08:00", end: "09:00" },
    { key: "09:00", label: "9시", start: "09:00", end: "10:00" },
    { key: "10:00", label: "10시", start: "10:00", end: "11:00" },
    { key: "11:00", label: "11시", start: "11:00", end: "12:00" },
    { key: "13:00", label: "13시", start: "13:00", end: "14:00" },
    { key: "14:00", label: "14시", start: "14:00", end: "15:00" },
    { key: "15:00", label: "15시", start: "15:00", end: "16:00" },
    { key: "16:00", label: "16시", start: "16:00", end: "17:00" },
    { key: "17:00", label: "17시", start: "17:00", end: "18:00" },
    { key: "18:00", label: "18시", start: "18:00", end: "19:00" },
    { key: "19:00", label: "19시", start: "19:00", end: "20:00" },
    { key: "20:00", label: "20시", start: "20:00", end: "21:00" },
];

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatSlotLabel(startHHMM: string, durationMinutes: number): string {
    const [h, m] = startHHMM.split(":").map(Number);
    if (durationMinutes === 60 && m === 0) {
        return `${h}시`;
    }
    return startHHMM;
}

export function generateSlotsFromConfig(
    config: Partial<CoachSlotConfig>,
    includeDisabled = false
): TimeSlotItem[] {
    const duration = Math.max(10, Math.min(180, Number(config.durationMinutes) || 60));
    const breakMin = Math.max(0, Math.min(120, Number(config.breakMinutes) || 0));
    const step = duration + breakMin;
    const disabled = new Set(config.disabledSlots || []);
    const result: TimeSlotItem[] = [];

    const addRange = (startStr: string, endStr: string) => {
        let cur = toMinutes(startStr);
        const endLimit = toMinutes(endStr);
        let guard = 0;
        while (cur + duration <= endLimit && guard < 100) {
            const start = toHHMM(cur);
            const end = toHHMM(cur + duration);
            if (includeDisabled || !disabled.has(start)) {
                result.push({
                    key: start,
                    label: formatSlotLabel(start, duration),
                    start,
                    end,
                });
            }
            cur += step;
            guard++;
        }
    };

    if (config.useAm !== false && config.amStart && config.amEnd) {
        addRange(config.amStart, config.amEnd);
    }
    if (config.usePm !== false && config.pmStart && config.pmEnd) {
        addRange(config.pmStart, config.pmEnd);
    }

    return result;
}

export function resolveCoachSlotConfig(
    configs: CoachSlotConfig[],
    coachName: string,
    dateStr: string
): CoachSlotConfig | null {
    if (!coachName || !configs || configs.length === 0) return null;
    const cleanName = coachName.replace(/ (감독|코치|프로)$/, "").trim();
    const monthStr = dateStr ? dateStr.slice(0, 7) : "";

    // 1. Exact month match
    if (monthStr) {
        const monthMatch = configs.find(
            (c) =>
                (c.coachName === cleanName || c.coachName === coachName.trim()) &&
                c.month === monthStr
        );
        if (monthMatch) return monthMatch;
    }

    // 2. Default config for this coach
    const defaultMatch = configs.find(
        (c) =>
            (c.coachName === cleanName || c.coachName === coachName.trim()) &&
            c.month === "default"
    );
    return defaultMatch || null;
}

