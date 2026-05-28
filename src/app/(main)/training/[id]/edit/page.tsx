"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Calendar, FileText, Upload, X, ChevronDown, ChevronUp, Layers, Search, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchTrainingTemplates, TrainingTemplate } from "@/lib/training-template-sync";
import { updateTrainingRecord, fetchRecentTrainingsByPlayer, TrainingRecord } from "@/lib/training-sync";
import { cn } from "@/lib/utils";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { AthleteSearch } from "@/components/ui/AthleteSearch";
import { TopicPickerSheet } from "@/components/ui/TopicPickerSheet";

const ALL_SLOTS = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];
const AM_SLOTS = ALL_SLOTS.filter((s) => parseInt(s) < 13);
const PM_SLOTS = ALL_SLOTS.filter((s) => parseInt(s) >= 13);

function slotLabel(slot: string) {
    const h = parseInt(slot.split(":")[0]);
    const m = slot.split(":")[1];
    return `${h > 12 ? h - 12 : h}:${m}`;
}

const partOptions: { key: string; label: string }[] = [
    { key: "shot", label: "Shot" },
    { key: "pitch", label: "Pitch" },
    { key: "bunker", label: "Bunker" },
    { key: "approach", label: "Approach" },
    { key: "putt", label: "Putt" },
    { key: "physical", label: "Physical" },
    { key: "etc", label: "Etc" },
];

const trainingTypeOptions = [
    { key: "individual", label: "개인 훈련" },
    { key: "group", label: "단체 훈련" },
];

export default function EditTrainingPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [trainingDate, setTrainingDate] = useState("");
    const [termStart, setTermStart] = useState("");
    const [termEnd, setTermEnd] = useState("");
    const [startSlot, setStartSlot] = useState<string | null>(null);
    const [endSlot, setEndSlot] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(7);
    const [period, setPeriod] = useState<"am" | "pm">("am");

    const [selectedPart, setSelectedPart] = useState<string>("");
    const [selectedTrainingType, setSelectedTrainingType] = useState<string>("individual");
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [templateSettings, setTemplateSettings] = useState<any[]>([]);
    const [trainingComment, setTrainingComment] = useState("");
    
    const [dbTemplates, setDbTemplates] = useState<TrainingTemplate[]>([]);
    const [templateSearchQuery, setTemplateSearchQuery] = useState("");
    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const supabase = createClient();
                
                // 1. Fetch training record
                const { data, error } = await supabase
                    .from("records")
                    .select(`
                        *,
                        users!records_user_id_fkey(name)
                    `)
                    .eq("id", id)
                    .single();

                if (error) throw error;

                // 2. Fetch templates
                const templatesData = await fetchTrainingTemplates();
                setDbTemplates(templatesData);

                // 3. Initialize state
                if (data) {
                    setSelectedPlayer(data.users?.name || "");
                    const createdAtDate = data.created_at ? data.created_at.split('T')[0] : "";
                    const createdAtTime = data.created_at ? data.created_at.split('T')[1]?.slice(0, 5) : "09:00";
                    
                    setTrainingDate(createdAtDate);
                    setStartSlot(createdAtTime);
                    // Estimate end slot if not stored (e.g., +1 hour)
                    const h = parseInt(createdAtTime.split(":")[0]);
                    const m = createdAtTime.split(":")[1];
                    const endH = (h + 1).toString().padStart(2, '0');
                    setEndSlot(`${endH}:${m}`);
                    setPeriod(h >= 13 ? "pm" : "am");

                    setSelectedPart(data.category || "");
                    setTermStart(data.training_start || createdAtDate);
                    setTermEnd(data.training_end || createdAtDate);
                    setTotalCount(data.total_count || 7);
                    setTrainingComment(data.content || "");
                    
                    const settings = data.template_settings || [];
                    setTemplateSettings(settings);
                    setSelectedTemplates(settings.map((s: any) => s.id));
                }
            } catch (err) {
                console.error("Failed to load training for edit:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const slots = period === "am" ? AM_SLOTS : PM_SLOTS;

    const handleSlotClick = (slot: string) => {
        if (!startSlot || (startSlot && endSlot)) {
            setStartSlot(slot);
            setEndSlot(null);
        } else {
            const si = ALL_SLOTS.indexOf(startSlot);
            const ei = ALL_SLOTS.indexOf(slot);
            if (ei >= si) {
                setEndSlot(slot);
            } else {
                setEndSlot(startSlot);
                setStartSlot(slot);
            }
        }
    };

    const isInRange = (slot: string) => {
        if (!startSlot) return false;
        const si = ALL_SLOTS.indexOf(startSlot);
        const ci = ALL_SLOTS.indexOf(slot);
        if (!endSlot) return slot === startSlot;
        const ei = ALL_SLOTS.indexOf(endSlot);
        return ci >= si && ci <= ei;
    };

    const timeLabel = useMemo(() => {
        if (!startSlot) return "시간을 선택하세요";
        if (!endSlot) return `${slotLabel(startSlot)} ~ (종료 시간 선택)`;
        return `${slotLabel(startSlot)} ~ ${slotLabel(endSlot)}`;
    }, [startSlot, endSlot]);

    const visibleTemplates = useMemo(() => {
        return dbTemplates.filter((t) =>
            (t.title.toLowerCase().includes(templateSearchQuery.toLowerCase()) || 
             (t.description && t.description.toLowerCase().includes(templateSearchQuery.toLowerCase()))) &&
            !selectedTemplates.includes(t.id)
        );
    }, [templateSearchQuery, dbTemplates, selectedTemplates]);

    const handleTemplateAdd = (templateId: string) => {
        if (selectedTemplates.includes(templateId)) return;
        const template = dbTemplates.find(t => t.id === templateId);
        if (!template) return;

        setSelectedTemplates(prev => [...prev, templateId]);
        setTemplateSettings(prev => [...prev, {
            id: template.id,
            title: template.title,
            description: template.description || "",
            purpose: template.purpose || "",
            goal: template.goal || ""
        }]);
        setTemplateSearchQuery("");
        setIsTemplateDropdownOpen(false);
    };

    const handleTemplateRemove = (templateId: string) => {
        setSelectedTemplates(prev => prev.filter(v => v !== templateId));
        setTemplateSettings(prev => prev.filter(s => s.id !== templateId));
    };

    const handleTemplateToggle = (templateId: string) => {
        if (selectedTemplates.includes(templateId)) {
            handleTemplateRemove(templateId);
        } else {
            handleTemplateAdd(templateId);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlayer || !selectedPart || selectedTemplates.length === 0) {
            alert("필수 항목을 모두 입력해주세요.");
            return;
        }

        setIsSaving(true);
        try {
            const combinedTitle = templateSettings.map(s => s.title).join(", ") || "훈련 기록";
            
            const { error } = await updateTrainingRecord(id, {
                playerName: selectedPlayer,
                category: selectedPart,
                title: combinedTitle,
                content: trainingComment,
                date: trainingDate,
                startTime: startSlot || "12:00",
                training_start: termStart,
                training_end: termEnd,
                total_count: totalCount,
                template_settings: templateSettings
            });

            if (error) throw new Error(error);

            alert("훈련 기록이 수정되었습니다.");
            router.push(`/training/${id}`);
            router.refresh();
        } catch (err: any) {
            console.error("Failed to update training:", err);
            alert("수정에 실패했습니다: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <button type="button" onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">훈련 수정</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Info */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2 relative md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">선수 선택 <span className="text-brand-red">*</span></label>
                                <AthleteSearch
                                    multi={false}
                                    selectedNames={selectedPlayer ? [selectedPlayer] : []}
                                    onSelect={(name: string) => setSelectedPlayer(name)}
                                    onRemove={() => setSelectedPlayer("")}
                                    placeholder="선수 이름을 검색하세요..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 일자 <span className="text-brand-red">*</span></label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} required className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center" />
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">시간 선택 <span className="text-brand-red">*</span></label>
                                <div className="flex bg-transparent border border-zinc-200 dark:bg-zinc-800 rounded-lg p-0.5 w-fit mb-3">
                                    <button type="button" onClick={() => setPeriod("am")} className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all", period === "am" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400")}>오전</button>
                                    <button type="button" onClick={() => setPeriod("pm")} className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all", period === "pm" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm" : "text-zinc-500 dark:text-zinc-400")}>오후</button>
                                </div>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {slots.map((slot) => {
                                        const active = isInRange(slot);
                                        const isStart = slot === startSlot;
                                        const isEnd = slot === endSlot;
                                        return (
                                            <button key={slot} type="button" onClick={() => handleSlotClick(slot)} className={cn("py-2.5 rounded-xl text-xs font-medium transition-all border", isStart || isEnd ? "bg-brand-navy text-white border-brand-navy" : active ? "bg-brand-navy/10 text-brand-navy border-brand-navy/20 dark:bg-brand-navy/30 dark:text-white" : "bg-transparent dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400")}>{slotLabel(slot)}</button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-zinc-500">선택: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{timeLabel}</span></p>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">파트 선택 <span className="text-brand-red">*</span></label>
                                <div className="flex flex-nowrap overflow-x-auto gap-2 scrollbar-hide pb-2">
                                    {partOptions.map((opt) => (
                                        <button key={opt.key} type="button" onClick={() => setSelectedPart(opt.key)} className={cn("whitespace-nowrap shrink-0 px-4 py-2.5 rounded-full text-sm font-medium border transition-all", selectedPart === opt.key ? "bg-brand-navy text-white border-brand-navy" : "bg-transparent dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50")}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Content Section */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 총 횟수 <span className="text-brand-red">*</span></label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number"
                                    value={totalCount}
                                    onChange={(e) => setTotalCount(parseInt(e.target.value) || 0)}
                                    className="w-24 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-zinc-900 dark:text-zinc-100 font-bold"
                                />
                                <span className="text-sm text-zinc-500">회</span>
                            </div>
                        </div>

                        {/* Training Content Selection */}
                        <div className="space-y-3 relative">
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                    훈련 컨텐츠 <span className="text-brand-red">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <TopicPickerSheet
                                        items={dbTemplates.map(t => ({ id: t.id, title: t.title, imageUrl: t.mediaUrl }))}
                                        selectedValues={selectedTemplates}
                                        onToggle={handleTemplateToggle}
                                        placeholder="훈련 컨텐츠 검색..."
                                        trigger={
                                            <button
                                                type="button"
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-brand-navy-light text-xs font-bold hover:bg-brand-navy/10 transition-colors border border-brand-navy/10"
                                            >
                                                <Layers size={14} />
                                                훈련 컨텐츠 선택
                                            </button>
                                        }
                                    />
                                </div>
                            </div>

                            {selectedTemplates.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {selectedTemplates.map((val, index) => {
                                        const template = dbTemplates.find(t => t.id === val);
                                        return (
                                            <span key={`${val}-${index}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                                                {template?.title || val}
                                                <button type="button" onClick={() => handleTemplateRemove(val)} className="hover:text-blue-600 dark:hover:text-blue-100 transition-colors"><X size={12} /></button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="relative" ref={templateDropdownRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <input
                                        type="text"
                                        value={templateSearchQuery}
                                        onChange={(e) => {
                                            setTemplateSearchQuery(e.target.value);
                                            setIsTemplateDropdownOpen(e.target.value.trim().length > 0);
                                        }}
                                        placeholder="훈련 컨텐츠명을 입력하여 검색하세요..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                                    />
                                </div>

                                {isTemplateDropdownOpen && templateSearchQuery.trim().length > 0 && visibleTemplates.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                                        {visibleTemplates.map((template) => (
                                            <button key={template.id} type="button" onClick={() => handleTemplateAdd(template.id)} className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-none">
                                                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{template.title}</div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate uppercase">{template.categoryId}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련 기간 {termStart && termEnd && (
                                    <span className="text-blue-500 ml-1 underline underline-offset-4 decoration-2">
                                        ({Math.ceil((new Date(termEnd).getTime() - new Date(termStart).getTime()) / (1000 * 60 * 60 * 24)) + 1}일)
                                    </span>
                                )} <span className="text-brand-red">*</span>
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <DatePickerInput value={termStart} onChange={(e) => setTermStart(e.target.value)} placeholder="시작일" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center" />
                                </div>
                                <span className="text-zinc-400 text-sm">~</span>
                                <div className="flex-1 relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <DatePickerInput value={termEnd} onChange={(e) => setTermEnd(e.target.value)} placeholder="종료일" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center" />
                                </div>
                            </div>
                        </div>

                        {/* Selected Template Details */}
                        {templateSettings.length > 0 && (
                            <div className="space-y-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Layers size={16} className="text-blue-500" />
                                    선택된 훈련 컨텐츠 상세 설정
                                </h3>
                                <div className="space-y-4">
                                    {templateSettings.map((setting) => (
                                        <div key={setting.id} className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 space-y-4 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{setting.title}</h4>
                                                <button type="button" onClick={() => handleTemplateRemove(setting.id)} className="text-zinc-400 hover:text-brand-red transition-colors"><X size={16} /></button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 text-xs">
                                                <div className="space-y-1">
                                                    <span className="font-bold text-zinc-400 uppercase tracking-tight">훈련 방법</span>
                                                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">{setting.description || "설명 없음"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="font-bold text-zinc-400 uppercase tracking-tight">훈련 목적</span>
                                                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">{setting.purpose || "목적 없음"}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight">훈련 목표 (변경 가능)</label>
                                                    <textarea value={setting.goal} onChange={(e) => setTemplateSettings(prev => prev.map(s => s.id === setting.id ? { ...s, goal: e.target.value } : s))} placeholder="훈련 목표를 입력하세요..." className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-brand-navy/40 transition-all min-h-[60px] resize-none" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 코멘트</label>
                            <textarea rows={4} value={trainingComment} onChange={(e) => setTrainingComment(e.target.value)} placeholder="코치님의 코멘트를 입력해주세요..." className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y" />
                        </div>
                    </section>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-400">취소</button>
                        <button type="submit" disabled={isSaving} className="bg-brand-red hover:bg-brand-red-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg disabled:opacity-50">
                            {isSaving ? "수정 중..." : "수정 내용 저장"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
