"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageTitle } from "@/components/ui/Typography";
import { ChevronLeft, Save, Search, X, Calendar } from "lucide-react";
import { updateQrEvent, getQrEvents } from "@/lib/qr-sync";
import { getPollVoters } from "@/lib/vote-sync";
import { DatePickerInput } from "@/components/ui/DatePickerInput";
import { CustomTimePicker } from "@/components/ui/CustomTimePicker";

export default function EditQrEventPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = React.use(params);
    const eventId = resolvedParams.id;

    const [title, setTitle] = useState("");
    const [status, setStatus] = useState<"ACTIVE" | "CLOSED">("ACTIVE");
    
    // Dates
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("23:59");

    const [mainTarget, setMainTarget] = useState<"ALL" | "조이마루점" | "구미점" | "기타" | "POLL">("ALL");
    
    // For POLL_PARTICIPANTS
    const [polls, setPolls] = useState<any[]>([]);
    const [selectedPoll, setSelectedPoll] = useState<any>(null);
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [pollVoters, setPollVoters] = useState<any[]>([]);
    
    // Extra Athletes & Exclusions
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedAthletes, setSelectedAthletes] = useState<any[]>([]);
    const [excludedAthletes, setExcludedAthletes] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState("");

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);

            const { data: pData } = await supabase.from("polls")
                .select("id, title, options")
                .neq("type", "qr_check")
                .order("created_at", { ascending: false })
                .limit(20);
            if (pData) setPolls(pData);

            const { data: uData } = await supabase.from("users")
                .select("id, name, branch, role")
                .in("status", ["등록", "재직"]);
            if (uData) setAllUsers(uData);

            // Load existing QR event
            const { data: eData } = await supabase.from("polls").select("*").eq("id", eventId).single();
            if (eData) {
                setTitle(eData.title);
                setStatus(eData.status === "ongoing" ? "ACTIVE" : "CLOSED");
                setStartDate(eData.start_date || "");
                setEndDate(eData.end_date || "");
                setEndTime(eData.end_time || "23:59");
                
                const targetType = eData.description;
                const targetData = eData.final_roster || {};
                
                if (targetType === "ALL") {
                    setMainTarget("ALL");
                } else if (targetType === "BRANCH") {
                    setMainTarget(targetData.branch as any);
                } else if (targetType === "OTHER_BRANCH") {
                    setMainTarget("기타");
                } else if (targetType === "POLL_PARTICIPANTS") {
                    setMainTarget("POLL");
                    if (targetData.pollId) {
                        const poll = pData?.find((p: any) => p.id === targetData.pollId);
                        if (poll) setSelectedPoll(poll);
                    }
                    setSelectedOptions(targetData.selectedOptions || []);
                }
                
                if (targetData.extraAthletes) {
                    setSelectedAthletes(targetData.extraAthletes);
                }
                if (targetData.excludedAthletes) {
                    setExcludedAthletes(targetData.excludedAthletes);
                }
            }
            setIsLoading(false);
        };
        load();
    }, [eventId]);

    const handlePollSelect = async (pollId: string) => {
        const poll = polls.find(p => p.id === pollId);
        setSelectedPoll(poll || null);
        setSelectedOptions([]);
        setPollVoters([]);
        
        if (pollId) {
            const voters = await getPollVoters(pollId);
            setPollVoters(voters);
        }
    };

    const toggleOption = (optionId: string) => {
        if (selectedOptions.includes(optionId)) {
            setSelectedOptions(prev => prev.filter(id => id !== optionId));
        } else {
            setSelectedOptions(prev => [...prev, optionId]);
        }
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);
        if (!q.trim()) {
            setSearchResults([]);
            return;
        }
        const results = allUsers.filter(u => u.name.includes(q) && !selectedAthletes.some(sa => sa.id === u.id));
        setSearchResults(results);
    };

    const addAthlete = (athlete: any) => {
        setSelectedAthletes(prev => [...prev, athlete]);
        setSearchQuery("");
        setSearchResults([]);
    };

    const removeAthlete = (id: string) => {
        setSelectedAthletes(prev => prev.filter(a => a.id !== id));
    };

    const computedTargets = React.useMemo(() => {
        let list: any[] = [];
        if (mainTarget === "POLL") {
            if (!selectedPoll || selectedOptions.length === 0) return [];
            const matchedVoters = pollVoters.filter(v => selectedOptions.includes(v.optionId));
            const uniqueVoters = Array.from(new Set(matchedVoters.map(v => v.userName)));
            list = allUsers.filter(u => uniqueVoters.includes(u.name));
        } else if (mainTarget === "ALL") {
            list = allUsers.filter(u => u.role === "athlete" || u.role === "coach" || u.role === "office" || u.role === "headquarter");
        } else if (mainTarget === "조이마루점" || mainTarget === "구미점") {
            list = allUsers.filter(u => (u.role === "athlete" || u.role === "coach") && u.branch === mainTarget);
        } else if (mainTarget === "기타") {
            list = allUsers.filter(u => 
                (u.role === "athlete" || u.role === "coach" || u.role === "office" || u.role === "headquarter") 
                && u.branch !== "조이마루점" && u.branch !== "구미점"
            );
        }
        return list.filter(u => !excludedAthletes.includes(u.id));
    }, [mainTarget, allUsers, excludedAthletes]);

    const excludeTarget = (user: any) => {
        if (confirm(`"${user.name}" 님을 대상자 명단에서 제외하시겠습니까?`)) {
            setExcludedAthletes(prev => [...prev, user.id]);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) return alert("패스 이름을 입력해주세요.");
        if (!endDate) return alert("종료일을 선택해주세요.");
        
        let targetType: any = "ALL";
        let targetData: any = { 
            extraAthletes: selectedAthletes.map(a => ({ id: a.id, name: a.name })),
            excludedAthletes
        };

        if (mainTarget === "조이마루점" || mainTarget === "구미점") {
            targetType = "BRANCH";
            targetData.branch = mainTarget;
        } else if (mainTarget === "기타") {
            targetType = "OTHER_BRANCH";
        } else if (mainTarget === "POLL") {
            targetType = "POLL_PARTICIPANTS";
            if (!selectedPoll || selectedOptions.length === 0) return alert("투표와 항목을 1개 이상 선택해주세요.");
            const matchedVoters = pollVoters.filter(v => selectedOptions.includes(v.optionId));
            const uniqueVoters = Array.from(new Set(matchedVoters.map(v => v.userName)));
            targetData.pollId = selectedPoll.id;
            targetData.options = selectedOptions;
            targetData.voters = uniqueVoters;
        }

        setIsSaving(true);
        try {
            await updateQrEvent(eventId, {
                title,
                date: startDate,
                endDate: endDate,
                endTime: endTime,
                targetType,
                targetData,
                status
            });
            alert("스마트 패스가 수정되었습니다.");
            router.push(`/operations/qr-check/${eventId}`);
        } catch (e) {
            console.error(e);
            alert("수정 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-zinc-500">데이터를 불러오는 중...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-20">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <ChevronLeft size={24} className="text-zinc-700 dark:text-zinc-300" />
                </button>
                <PageTitle>스마트 패스 수정하기</PageTitle>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-zinc-100 dark:border-zinc-800 space-y-8">
                
                {/* 방 이름 */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">패스 이름 (필수)</label>
                    <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="예: 10/2 점심 식권 확인" 
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition-all"
                    />
                </div>

                {/* 상태 */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">진행 상태</label>
                    <select 
                        value={status}
                        onChange={e => setStatus(e.target.value as "ACTIVE" | "CLOSED")}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition-all"
                    >
                        <option value="ACTIVE">진행 중</option>
                        <option value="CLOSED">종료됨</option>
                    </select>
                </div>

                {/* 기간 설정 (투표와 동일한 UI) */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        이벤트 기간 설정 <span className="text-brand-red">*</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-3 w-full bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-[150px] sm:flex-none">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <DatePickerInput
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-center cursor-pointer"
                                />
                            </div>
                            <span className="text-zinc-400">~</span>
                            <div className="relative flex-1 sm:w-[150px] sm:flex-none">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <DatePickerInput
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-center cursor-pointer"
                                />
                            </div>
                        </div>
                        <CustomTimePicker
                            value={endTime}
                            onChange={setEndTime}
                        />
                    </div>
                </div>

                {/* 대상자 */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">대상자</label>
                    <div className="flex flex-nowrap overflow-x-auto pb-2 scrollbar-hide gap-2">
                        {(["ALL", "조이마루점", "구미점", "POLL"] as const).map(type => {
                            const labels = { ALL: "전체", "조이마루점": "조이마루점", "구미점": "구미점", POLL: "투표" };
                            return (
                                <button 
                                    key={type}
                                    onClick={() => setMainTarget(type)}
                                    className={`whitespace-nowrap px-6 py-3 rounded-xl border font-bold text-sm transition-colors ${mainTarget === type ? "bg-brand-navy text-white border-brand-navy" : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700"}`}
                                >
                                    {labels[type]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 선택된 대상자 명단 UI (투표 제외) */}
                {mainTarget !== "POLL" && (
                    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl animate-in fade-in">
                        <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <p className="text-xs font-bold text-zinc-500 mb-2">대상자 명단 ({computedTargets.length}명) - 클릭 시 제외</p>
                            <div className="flex flex-wrap gap-1.5">
                                {computedTargets.filter(u => u.role === "athlete").map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => excludeTarget(u)}
                                        className="text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                        title="클릭하여 제외"
                                    >
                                        {u.name}
                                    </button>
                                ))}
                            </div>
                            {computedTargets.some(u => u.role === "coach") && (
                                <>
                                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-3" />
                                    <p className="text-[10px] font-bold text-zinc-400 mb-2">코치</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {computedTargets.filter(u => u.role === "coach").map(u => (
                                            <button 
                                                key={u.id}
                                                onClick={() => excludeTarget(u)}
                                                className="text-[11px] font-bold bg-brand-navy/10 dark:bg-brand-navy/30 text-brand-navy px-2 py-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                                title="클릭하여 제외"
                                            >
                                                {u.name} 코치
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                            {computedTargets.some(u => u.role === "office" || u.role === "headquarter") && (
                                <>
                                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-3" />
                                    <p className="text-[10px] font-bold text-zinc-400 mb-2">기타 (오피스/총괄 등)</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {computedTargets.filter(u => u.role === "office" || u.role === "headquarter").map(u => (
                                            <button 
                                                key={u.id}
                                                onClick={() => excludeTarget(u)}
                                                className="text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                                title="클릭하여 제외"
                                            >
                                                {u.name} {u.role === "headquarter" ? "총괄" : u.role === "office" ? "오피스" : ""}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 투표 참가자 선택 UI */}
                {mainTarget === "POLL" && (
                    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl animate-in fade-in">
                        <div>
                            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block">연동할 투표 선택</label>
                            <select 
                                value={selectedPoll?.id || ""} 
                                onChange={e => handlePollSelect(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-4 pr-10 py-3 focus:outline-none mb-4"
                            >
                                <option value="">투표를 선택하세요</option>
                                {polls.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>

                        {selectedPoll && (
                            <div>
                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 block">투표 항목 선택 (다중 선택 가능)</label>
                                <div className="space-y-2">
                                    {selectedPoll.options?.map((opt: any) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => toggleOption(opt.id)}
                                            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors flex items-center justify-between ${
                                                selectedOptions.includes(opt.id) 
                                                ? "border-brand-navy bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-blue-300" 
                                                : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                                            }`}
                                        >
                                            <span>{opt.text}</span>
                                            <span className="text-xs text-zinc-400">({pollVoters.filter(v => v.optionId === opt.id).length}명)</span>
                                        </button>
                                    ))}
                                </div>
                                
                                {selectedOptions.length > 0 && (
                                    <div className="mt-4 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                        <p className="text-xs font-bold text-zinc-500 mb-2">투표로 선택된 대상자 명단 ({computedTargets.length}명) - 클릭 시 제외</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {computedTargets.map(u => (
                                                <button 
                                                    key={u.id}
                                                    onClick={() => excludeTarget(u)}
                                                    className="text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                                    title="클릭하여 제외"
                                                >
                                                    {u.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 예외/추가 선수 */}
                <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                    <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 block">추가 선수</label>
                    <p className="text-[11px] text-zinc-500 mb-2 -mt-2">위 선택한 대상자 외 추가 대상자를 선택해 주세요</p>
                    
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={handleSearch}
                            placeholder="선수명 검색..."
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none"
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                                {searchResults.map(a => (
                                    <button 
                                        key={a.id}
                                        onClick={() => addAthlete(a)}
                                        className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                                    >
                                        <span className="font-bold text-sm text-zinc-700 dark:text-zinc-200">{a.name}</span>
                                        <span className="text-xs text-zinc-400">{a.branch}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedAthletes.length > 0 && (
                        <div className="pt-2">
                            <p className="text-xs font-bold text-zinc-500 mb-2">추가된 선수 ({selectedAthletes.length}명)</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedAthletes.map(a => (
                                    <div key={a.id} className="flex items-center gap-1.5 bg-brand-navy text-white text-xs font-bold px-3 py-1.5 rounded-full">
                                        {a.name}
                                        <button onClick={() => removeAthlete(a.id)} className="hover:text-red-300 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full bg-brand-navy text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-brand-navy-dark transition-colors shadow-lg shadow-brand-navy/20 mt-8"
                >
                    {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
                    저장하기
                </button>
            </div>
        </div>
    );
}
