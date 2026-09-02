import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchLessonTemplates } from "@/lib/lesson-template-sync";
import { parseMediaUrls } from "@/lib/analysis-sync";
import { CheckCircle2, ChevronLeft, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import { CustomVideoPlayer } from "@/components/ui/CustomVideoPlayer";

export default function ReportLessonDetail({ lessonId }: { lessonId: string }) {
    const [lesson, setLesson] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const carouselRef = useRef<HTMLDivElement>(null);
    const contentCarouselRef = useRef<HTMLDivElement>(null);
    const afterCarouselRef = useRef<HTMLDivElement>(null);

    const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
        if (ref.current) {
            const scrollAmount = ref.current.clientWidth;
            ref.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth"
            });
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!lessonId) return;
            setIsLoading(true);
            const supabase = createClient();

            try {
                const { data, error } = await supabase
                    .from("records")
                    .select(`
                        id, type, category, title, content, media_urls, created_at,
                        user:users!records_user_id_fkey(name),
                        coach:users!records_coach_id_fkey(name)
                    `)
                    .eq("id", lessonId)
                    .single();

                if (error || !data) throw error || new Error("No data");

                const templatesData = await fetchLessonTemplates();
                const allMedia = parseMediaUrls(data.media_urls);
                const beforeMediaFiles = allMedia.filter(url => url.startsWith('http')).map(url => ({
                    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    url
                }));
                const afterMediaFiles = allMedia.filter(url => url.startsWith('after:http')).map(url => {
                    const actualUrl = url.replace('after:', '');
                    return {
                        type: actualUrl.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                        url: actualUrl
                    };
                });
                const templateIds = allMedia
                    .filter(url => url.startsWith('template:'))
                    .map(url => url.replace('template:', ''));

                const templates = templatesData.filter(t => templateIds.includes(t.id));

                let beforeContent = data.content || "";
                let afterContent = "";
                const afterSplitIndex = beforeContent.indexOf("[교정 후]");
                if (afterSplitIndex !== -1) {
                    afterContent = beforeContent.substring(afterSplitIndex + 7).trim();
                    beforeContent = beforeContent.substring(0, afterSplitIndex).trim();
                }

                setLesson({
                    id: data.id,
                    writer: (data.coach as any)?.[0]?.name || (data.coach as any)?.name || "Unknown",
                    player: (data.user as any)?.[0]?.name || (data.user as any)?.name || "Unknown",
                    typeLabel: data.category?.toUpperCase(),
                    date: ((data.created_at) ? new Date(data.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : ""),
                    title: data.title || "제목 없음",
                    content: beforeContent,
                    afterContent: afterContent,
                    selectedImages: templates.map(t => ({ url: t.imageUrl, title: t.title })),
                    media: beforeMediaFiles,
                    afterMedia: afterMediaFiles,
                });
            } catch (err) {
                console.error("Failed to fetch lesson detail:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [lessonId]);

    if (isLoading) {
        return <div className="p-8 text-center text-zinc-400 text-sm">레슨 정보를 불러오는 중...</div>;
    }

    if (!lesson) {
        return <div className="p-8 text-center text-zinc-400 text-sm">레슨 정보를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wider">
                        {lesson.typeLabel}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">{lesson.date}</span>
                </div>
                <div className="flex items-center justify-end gap-3 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1"><User size={12} /> 코치: {lesson.writer}</div>
                </div>
            </div>



            {/* Content Sections */}
            {lesson.content && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm mt-6">
                    <div className="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                        {lesson.content}
                    </div>
                </div>
            )}

            {lesson.afterContent && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm mt-6">
                    <div className="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                        {lesson.afterContent}
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <Link href={`/lessons/${lesson.id}`} className="text-[10px] font-bold text-brand-navy hover:underline">
                    레슨 상세 화면으로 이동 &rarr;
                </Link>
            </div>
        </div>
    );
}