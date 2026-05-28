"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    ChevronLeft,
    Check,
    Layout,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { getCourseInfoById, updateCourseInfo, CourseInfo } from "@/lib/course-info-sync";
import { createClient } from "@/lib/supabase/client";

export default function EditCourseInfoPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const [title, setTitle] = useState("");
    const [courseInput, setCourseInput] = useState("");
    const [courseDescription, setCourseDescription] = useState("");
    const [holes, setHoles] = useState<Record<number, string>>({});
    const [openHoles, setOpenHoles] = useState<Record<number, boolean>>({});
    const [isHolesOpen, setIsHolesOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            if (data?.user) setUserId(data.user.id);
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (id) {
            getCourseInfoById(id as string).then(data => {
                if (data) {
                    setCourseInfo(data);
                    setTitle(data.title);
                    try {
                        const parsed = JSON.parse(data.content);
                        setCourseInput(parsed.courseInput || "");
                        setCourseDescription(parsed.courseDescription || "");
                        setHoles(parsed.holes || {});
                    } catch (e) {
                        setCourseDescription(data.content);
                    }
                }
                setLoading(false);
            });
        }
    }, [id]);

    const toggleHole = (holeNum: number) => {
        setOpenHoles(prev => ({ ...prev, [holeNum]: !prev[holeNum] }));
    };

    const handleHoleChange = (holeNum: number, val: string) => {
        setHoles(prev => ({ ...prev, [holeNum]: val }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting || !courseInfo) return;

        if (!title.trim()) {
            alert("골프장 이름을 입력해 주세요.");
            return;
        }

        try {
            setIsSubmitting(true);
            
            const contentData = {
                courseDescription,
                courseInput,
                holes
            };

            await updateCourseInfo(id as string, {
                title,
                content: JSON.stringify(contentData),
            });
            alert("코스 정보가 수정되었습니다.");
            router.push(`/course-info/${id}`);
        } catch (err) {
            console.error(err);
            alert("수정 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
    if (!courseInfo) return <div className="flex items-center justify-center min-h-screen">코스 정보를 찾을 수 없습니다.</div>;

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        코스 정보 수정
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 pb-20">
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                골프장 <span className="text-brand-red">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="골프장 이름을 입력하세요..."
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                코스
                            </label>
                            <input
                                type="text"
                                value={courseInput}
                                onChange={(e) => setCourseInput(e.target.value)}
                                placeholder="코스 (예: IN/OUT 코스)"
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                            />
                        </div>
                    </section>

                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <Layout size={18} className="text-zinc-400" />
                            상세 내용
                        </label>
                        <textarea
                            rows={6}
                            value={courseDescription}
                            onChange={(e) => setCourseDescription(e.target.value)}
                            placeholder="상세 내용을 기록해주세요..."
                            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                        />
                    </section>

                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setIsHolesOpen(!isHolesOpen)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer">
                                <Layout size={18} className="text-zinc-400" />
                                홀별 추가 정보 기입
                            </label>
                            {isHolesOpen ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                        </button>

                        {isHolesOpen && (
                            <div className="px-6 pb-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
                                    <div key={hole} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/50">
                                        <button
                                            type="button"
                                            onClick={() => toggleHole(hole)}
                                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                        >
                                            <span>{hole}번 홀</span>
                                            {openHoles[hole] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        {openHoles[hole] && (
                                            <div className="p-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                                <textarea
                                                    rows={3}
                                                    value={holes[hole] || ""}
                                                    onChange={(e) => handleHoleChange(hole, e.target.value)}
                                                    placeholder={`${hole}번 홀의 추가 정보를 입력하세요...`}
                                                    className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-3 rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-brand-navy hover:bg-brand-navy-dark disabled:bg-zinc-400 text-white px-10 py-3 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                        >
                            <Check size={18} />
                            {isSubmitting ? "수정 중..." : "수정 완료"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
