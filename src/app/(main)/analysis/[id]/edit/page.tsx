"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Calendar, FileText, Image as ImageIcon, Upload, Flag, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { AnalysisType } from "@/components/analysis/AnalysisCard";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { fetchAnalysisRecords, fetchAnalysisById, updateAnalysisRecord } from "@/lib/analysis-sync";
import { uploadFiles } from "@/lib/storage-sync";

const dummyAnalysisDetail = {
    id: "1",
    writer: "김코치",
    player: "이수진",
    type: "shot" as AnalysisType,
    date: "2026-03-05",
    title: "드라이버 슬라이스 교정 및 체중 이동 연습",
    content: "백스윙 탑에서 오버스윙되는 현상을 수정했습니다. 다운스윙 시 골반 회전을 먼저 시작하고 양팔이 자연스럽게 따라오도록 신경 써야 합니다. \n\n집에서 연습하실 때 거울을 보고 백스윙 아크를 유지하는 빈스윙을 하루 50번씩 해주세요. 임팩트 순간 고개가 뒤로 많이 젖혀지는 버릇은 많이 좋아졌습니다.",
    media: [
        { type: "image", url: "https://images.unsplash.com/photo-1587394625514-6d9b3a3250b7?auto=format&fit=crop&q=80&w=800&h=600" },
        { type: "video", url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
        { type: "image", url: "https://images.unsplash.com/photo-1593111774640-36fbb0143891?auto=format&fit=crop&q=80&w=800&h=600" },
    ],
    attachments: [
        { id: "a1", name: "swing_analysis.pdf", size: "2.4MB" }
    ]
};

const mockRecentAnalysis: { id: string; date: string; type: AnalysisType; title: string }[] = [
    { id: "a1", date: "2026-03-05", type: "shot", title: "드라이버 슬라이스 교정" },
    { id: "a2", date: "2026-03-02", type: "physical", title: "어깨 가동성 측정" },
    { id: "a3", date: "2026-02-28", type: "short_game", title: "어프로치 경사도 피드백" },
];

const partOptions: { key: AnalysisType; label: string }[] = [
    { key: "shot", label: "Shot" },
    { key: "short_game", label: "Short Game" },
    { key: "physical", label: "Physical" },
    { key: "etc", label: "Etc" },
];

const mockRecentScore = {
    id: "s1",
    date: "2026-03-04",
    course: "레이크힐스 CC",
    score: 82,
    teeShot: "Fairway 60%",
    iron: "GIR 45%",
    pitch: "Scrambling 30%",
    aroundGreen: "Sand Save 50%",
    putting: "32 Putts",
    challengeFocus: "백스윙 템포 유지",
    strongPoint: "드라이버 비거리 안정적",
};

const dummyImages = [
    "https://images.unsplash.com/photo-1587394625514-6d9b3a3250b7?auto=format&fit=crop&q=80&w=200&h=200",
    "https://images.unsplash.com/photo-1593111774640-36fbb0143891?auto=format&fit=crop&q=80&w=200&h=200",
    "https://images.unsplash.com/photo-1586227740560-8cf2732c1531?auto=format&fit=crop&q=80&w=200&h=200",
    "https://images.unsplash.com/photo-1535136104956-f1b21abdbf1f?auto=format&fit=crop&q=80&w=200&h=200",
];

export default function EditAnalysisPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = typeof params.id === 'string' ? params : { id: Array.isArray(params.id) ? params.id[0] : '' };

    const [isLoading, setIsLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [analysisDate, setAnalysisDate] = useState("");
    const [selectedPart, setSelectedPart] = useState<AnalysisType | "">("");
    const [analysisContent, setAnalysisContent] = useState("");
    const [analysisTime, setAnalysisTime] = useState("12:00");
    const [selectedImages, setSelectedImages] = useState<string[]>([]);

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const recordId = typeof id === 'string' ? id : (Array.isArray(id) ? id[0] : '');

    useEffect(() => {
        if (!recordId) return;
        fetchAnalysisById(recordId).then(data => {
            if (data) {
                setSelectedPlayer(data.playerName);
                setAnalysisDate(data.date);
                setSelectedPart(data.type);
                setAnalysisContent(data.comment);
                setAnalysisTime(data.time || "12:00");
                setSelectedImages(data.media_urls || []);
            }
            setIsLoading(false);
        });
    }, [id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeNewFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingMedia = (urlToRemove: string) => {
        setSelectedImages(prev => prev.filter(url => url !== urlToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer) return alert("선수를 선택해주세요.");
        if (!selectedPart) return alert("파트를 선택해주세요.");
        if (!analysisContent) return alert("분석 내용을 입력해주세요.");

        try {
            setIsUploading(true);

            // Upload newly added files
            const uploadedUrls = await uploadFiles(selectedFiles);
            const combinedUrls = [...selectedImages, ...uploadedUrls];

            await updateAnalysisRecord(recordId, {
                playerName: selectedPlayer,
                type: selectedPart as AnalysisType,
                title: `${selectedPlayer} 분석 (${selectedPart})`,
                content: analysisContent,
                media_urls: combinedUrls,
                date: analysisDate,
                time: analysisTime
            });

            alert("분석 내용이 성공적으로 수정되었습니다.");
            router.push(`/analysis/${recordId}`);
        } catch (err: any) {
            console.error(err);
            alert("수정 실패: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-sm text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">

                {/* ── Header ── */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            분석 수정
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── 1. Basic Info ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Player Selection (Search/Autocomplete) */}
                            <div className="space-y-2 relative">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    선수 선택 <span className="text-brand-red">*</span>
                                </label>
                                <AthleteSearch
                                    multi={false}
                                    selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                    onSelect={(name: string) => setSelectedPlayer(name)}
                                    onRemove={() => setSelectedPlayer("")}
                                    placeholder="선수 이름을 검색하세요..."
                                />
                            </div>

                            {/* Date Selection */}
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    분석 일자 <span className="text-brand-red">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={analysisDate}
                                        onChange={(e) => setAnalysisDate(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Part Selection */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    파트 선택 <span className="text-brand-red">*</span>
                                </label>
                                <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 -mb-2 scrollbar-hide">
                                    {partOptions.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setSelectedPart(opt.key)}
                                            className={`whitespace-nowrap shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors border
                                                ${selectedPart === opt.key
                                                    ? "bg-brand-navy text-white border-brand-navy"
                                                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── 2. History & Analysis (Conditional) ── */}
                    {/* (Skipped history box for simplicity as in detail page unless explicitly loaded) */}


                    {/* ── 3. Content Input ── */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">

                        {/* Text Content */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                분석 내용
                            </label>
                            <textarea
                                rows={6}
                                value={analysisContent}
                                onChange={(e) => setAnalysisContent(e.target.value)}
                                placeholder="분석 내용을 상세히 기록해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>

                        {/* File Attachment */}
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                첨부파일 추가 ({selectedFiles.length}개 추가됨)
                            </label>
                            <label className="flex w-fit items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                                <Upload size={16} className="text-zinc-500" />
                                새 파일 업로드
                                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                            </label>

                            {/* New Files Preview */}
                            {selectedFiles.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {selectedFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                            <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[80%]">{file.name}</span>
                                            <button type="button" onClick={() => removeNewFile(idx)} className="text-zinc-400 hover:text-brand-red"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Existing Media List */}
                            {selectedImages.length > 0 && (
                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                                        기존 첨부 유지 중 ({selectedImages.length}개)
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {selectedImages.map((src, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 group">
                                                {/\.(mp4|webm|ogg|mov)(?:\?.*)?$/i.test(src) ? (
                                                    <video src={src} className="w-full h-full object-cover opacity-80" />
                                                ) : (
                                                    <img src={src} alt="Media" className="w-full h-full object-cover opacity-80" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <button type="button" onClick={() => removeExistingMedia(src)} className="bg-white text-red-500 rounded-full p-2 hover:bg-red-50 hover:scale-110 transition-all shadow-sm">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── 4. Footers / Actions ── */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading}
                            className={`bg-brand-red hover:bg-brand-red-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isUploading ? '저장 중...' : '수정 내용 저장'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
