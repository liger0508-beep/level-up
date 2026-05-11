import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getYoutubeEmbedUrl(url: string) {
    if (!url) return null;
    let videoId = "";
    if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1]?.split("?")[0];
    } else if (url.includes("youtube.com/watch?v=")) {
        videoId = url.split("v=")[1]?.split("&")[0];
    } else if (url.includes("youtube.com/embed/")) {
        videoId = url.split("embed/")[1]?.split("?")[0];
    } else if (url.includes("youtube.com/shorts/")) {
        videoId = url.split("shorts/")[1]?.split("?")[0];
    } else if (url.includes("youtube.com/live/")) {
        videoId = url.split("live/")[1]?.split("?")[0];
    }
    
    // modestbranding=1: Hide YouTube logo
    // rel=0: Show related videos from same channel
    // iv_load_policy=3: Hide annotations
    // autohide=1: Hide controls quickly (deprecated but sometimes works)
    // showinfo=0: Hide title/author (deprecated but sometimes works)
    return videoId ? `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&autohide=1&showinfo=0` : url;
}
export function formatLocalDate(date: Date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
