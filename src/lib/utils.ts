import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getKstDateStr(date: string | number | Date = new Date()) {
    return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // "YYYY-MM-DD"
}

export function getKstTimeStr(date: string | number | Date = new Date()) {
    return new Date(date).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }); // "HH:mm"
}

export function formatDate(date: string | number | Date) {
    const dStr = getKstDateStr(date); // YYYY-MM-DD
    const tStr = getKstTimeStr(date); // HH:mm
    const [, month, day] = dStr.split('-');
    return `${month}.${day} ${tStr}`;
}

export function formatTime(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}시간 ${minutes}분`;
    }
    if (minutes > 0) {
        return `${minutes}분 ${remainingSeconds}초`;
    }
    return `${remainingSeconds}초`;
}

export function formatLocalDate(date: Date | string | number = new Date()) {
    return getKstDateStr(date);
}

export function formatScore(val: any, decimals: number = 2): string {
    if (val === null || val === undefined || isNaN(Number(val))) return (0).toFixed(decimals);
    const numVal = Number(val);
    const formatted = numVal.toFixed(decimals);
    const num = parseFloat(formatted);
    if (num === 0) return Math.abs(num).toFixed(decimals);
    return num > 0 ? `+${formatted}` : formatted;
}

export function getYoutubeEmbedUrl(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
    }
    return null;
}
