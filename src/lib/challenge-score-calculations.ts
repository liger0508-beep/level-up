import { createClient } from './supabase/client';

export async function fetchScoringBaselines() {
    // Keep this function so existing calls in useEffects don't break
    return [];
}

const APPROACH_10M_SCORES: Record<number, number> = {
    0: -1.10, 1: 0.00, 2: 0.25, 3: 0.50, 4: 0.60, 5: 0.70,
    6: 0.75, 7: 0.80, 8: 0.85, 9: 0.90, 10: 0.95, 11: 1.00,
    12: 1.04, 13: 1.08, 14: 1.11, 15: 1.14, 16: 1.16,
    17: 1.18, 18: 1.20, 19: 1.21, 20: 1.22, 30: 1.23
};

const APPROACH_11_25M_SCORES: Record<number, number> = {
    0: -1.35, 1: -0.25, 2: 0.00, 3: 0.25, 4: 0.35, 5: 0.45,
    6: 0.50, 7: 0.55, 8: 0.60, 9: 0.65, 10: 0.70, 11: 0.75,
    12: 0.79, 13: 0.83, 14: 0.86, 15: 0.89, 16: 0.91,
    17: 0.93, 18: 0.95, 19: 0.96, 20: 0.97, 30: 0.98
};

const APPROACH_26_30M_SCORES: Record<number, number> = {
    0: -1.60, 1: -0.50, 2: -0.25, 3: 0.00, 4: 0.10, 5: 0.20,
    6: 0.25, 7: 0.30, 8: 0.35, 9: 0.40, 10: 0.45, 11: 0.50,
    12: 0.54, 13: 0.58, 14: 0.61, 15: 0.64, 16: 0.66,
    17: 0.68, 18: 0.70, 19: 0.71, 20: 0.72, 30: 0.73
};

const BUNKER_25M_SCORES: Record<number, number> = {
    0: -1.60, 1: -0.50, 2: -0.25, 3: 0.00, 4: 0.10, 5: 0.20,
    6: 0.25, 7: 0.30, 8: 0.35, 9: 0.40, 10: 0.45, 11: 0.50,
    12: 0.54, 13: 0.58, 14: 0.61, 15: 0.64, 16: 0.66,
    17: 0.68, 18: 0.70, 19: 0.71, 20: 0.72, 30: 0.73
};

const BUNKER_26_30M_SCORES: Record<number, number> = {
    0: -1.65, 1: -0.55, 2: -0.30, 3: -0.05, 4: 0.05, 5: 0.15,
    6: 0.20, 7: 0.25, 8: 0.30, 9: 0.35, 10: 0.40, 11: 0.45,
    12: 0.49, 13: 0.53, 14: 0.56, 15: 0.59, 16: 0.61,
    17: 0.63, 18: 0.65, 19: 0.66, 20: 0.67, 30: 0.68
};

const PUTT_BASE_SCORES: Record<number, number> = {
    0: 0.90, 1: 0.90, 2: 0.65, 3: 0.40, 4: 0.30, 5: 0.20, 6: 0.15, 7: 0.10, 8: 0.05, 9: 0.00,
    10: -0.05, 11: -0.10, 12: -0.14, 13: -0.18, 14: -0.21, 15: -0.24, 16: -0.26, 17: -0.28, 18: -0.30, 19: -0.31, 20: -0.32
};

const getScore = (scores: Record<number, number>, prox: number) => {
    if (prox <= 0) return scores[0];
    if (prox <= 20) return scores[prox];
    if (prox <= 29) return scores[20];
    return scores[30];
}

export function calculateChallengeSG(attemptDist: number, prox: number, baselines?: any[]): number {
    if (attemptDist === 8) return getScore(APPROACH_10M_SCORES, prox);
    if (attemptDist === 15 || attemptDist === 20 || attemptDist === 25) return getScore(APPROACH_11_25M_SCORES, prox);
    if (attemptDist === 30) return getScore(APPROACH_26_30M_SCORES, prox);

    if (attemptDist === 17) return getScore(BUNKER_25M_SCORES, prox);
    if (attemptDist === 27) return getScore(BUNKER_26_30M_SCORES, prox);

    return 0;
}

export function getChallengePuttScore(distance: number, putts: number): number {
    if (putts === 0) return 0;

    let base = 0;
    if (Number.isInteger(distance)) {
        base = PUTT_BASE_SCORES[distance] ?? 0;
    } else {
        const lower = Math.floor(distance);
        const upper = Math.ceil(distance);
        const lowerBase = PUTT_BASE_SCORES[lower] ?? 0;
        const upperBase = PUTT_BASE_SCORES[upper] ?? 0;
        base = (lowerBase + upperBase) / 2;
    }

    if (putts === 1) return base - 1;
    if (putts === 2) return base;
    return base + (putts - 2);
}