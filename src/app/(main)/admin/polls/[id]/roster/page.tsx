"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPollById, getPollVoters, Vote, updateFinalRoster } from "@/lib/vote-sync";
import { ChevronLeft, ClipboardCopy, List, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PollRosterPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [poll, setPoll] = useState<Vote | null>(null);
    const [voters, setVoters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"by-option" | "by-voter">("by-voter");
    const [isSelectMode, setIsSelectMode] = useState(true);
    const [selectedVoters, setSelectedVoters] = useState<Set<string>>(new Set());
    const [categories, setCategories] = useState<Record<string, string>>({});
    const [hasInitialized, setHasInitialized] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            try {
                const pollData = await getPollById(id);
                if (!pollData) {
                    alert("투표 정보를 찾을 수 없습니다.");
                    router.push("/admin/polls");
                    return;
                }
                setPoll(pollData);

                const votersData = await getPollVoters(id);
                setVoters(votersData);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, router]);

    const formattedData = useMemo(() => {
        if (!poll) return { byOption: [], byVoter: [] };

        // 1. By Option (항목별)
        const byOption = poll.options.map(opt => {
            const usersForOption = voters.filter(v => v.optionId === opt.id).map(v => v.userName);
            return {
                optionText: opt.text,
                users: usersForOption
            };
        });

        // 2. By Voter (명단별 - 시간순)
        const userGroups: Record<string, any> = {};
        voters.forEach(v => {
            const opt = poll.options.find(o => o.id === v.optionId);
            const optText = opt?.text || "알 수 없음";
            
            if (!userGroups[v.userName]) {
                userGroups[v.userName] = {
                    userName: v.userName,
                    phone: v.phone || "",
                    optionTexts: [optText],
                    createdAt: v.createdAt
                };
            } else {
                if (!userGroups[v.userName].optionTexts.includes(optText)) {
                    userGroups[v.userName].optionTexts.push(optText);
                }
            }
        });

        const byVoter = Object.values(userGroups).sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
        }).map((v, index) => ({
            originalIndex: index,
            userName: v.userName,
            voteCount: v.optionTexts.length,
            phone: v.phone,
            optionTexts: v.optionTexts,
            createdAt: v.createdAt
        }));

        return { byOption, byVoter };
    }, [poll, voters]);


    const groupedSelected = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        formattedData.byVoter.forEach(item => {
            item.optionTexts.forEach((optText: string) => {
                const selectionKey = `${item.originalIndex}_${optText}`;
                if (selectedVoters.has(selectionKey)) {
                    if (!grouped[optText]) grouped[optText] = [];
                    grouped[optText].push(item);
                }
            });
        });
        return grouped;
    }, [formattedData.byVoter, selectedVoters]);

    useEffect(() => {
        if (!hasInitialized && poll && poll.finalRoster && formattedData.byVoter.length > 0) {
            const newSelected = new Set<string>();
            const newCategories: Record<string, string> = {};
            
            const savedSelections: string[] = poll.finalRoster.selections || [];
            const savedCategories: Record<string, string> = poll.finalRoster.categories || {};
            
            formattedData.byVoter.forEach((v) => {
                v.optionTexts.forEach((optText: string) => {
                    const key = `${v.userName}_${optText}`;
                    const selectionKey = `${v.originalIndex}_${optText}`;
                    if (savedSelections.includes(key)) {
                        newSelected.add(selectionKey);
                        if (savedCategories[key]) {
                            newCategories[selectionKey] = savedCategories[key];
                        }
                    }
                });
            });
            
            if (newSelected.size > 0) {
                setSelectedVoters(newSelected);
                setCategories(newCategories);
                setIsSelectMode(true);
            }
            setHasInitialized(true);
        }
    }, [poll, formattedData.byVoter, hasInitialized]);

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">로딩 중...</div>;
    }

    if (!poll) return null;

    const toggleSelection = (key: string) => {
        setSelectedVoters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else newSet.add(key);
            return newSet;
        });
    };

    const handleCategoryChange = (key: string, val: string) => {
        setCategories(prev => ({...prev, [key]: val}));
    };

    const getCategory = (key: string) => categories[key] || "성인";



    const handleSaveRoster = async () => {
        if (!poll) return;
        setIsSaving(true);
        try {
            const selections: string[] = [];
            const cats: Record<string, string> = {};
            const grouped: Record<string, any[]> = {};

            formattedData.byVoter.forEach(item => {
                item.optionTexts.forEach((optText: string) => {
                    const selectionKey = `${item.originalIndex}_${optText}`;
                    if (selectedVoters.has(selectionKey)) {
                        const key = `${item.userName}_${optText}`;
                        selections.push(key);
                        cats[key] = categories[selectionKey] || "성인";
                        
                        if (!grouped[optText]) grouped[optText] = [];
                        grouped[optText].push({
                            no: grouped[optText].length + 1,
                            category: categories[selectionKey] || "성인",
                            userName: item.userName,
                            phone: item.phone
                        });
                    }
                });
            });

            const finalRosterData = {
                selections,
                categories: cats,
                groupedData: grouped
            };

            await updateFinalRoster(id, finalRosterData);
            alert("최종 명단이 성공적으로 등록되었습니다!");
            router.push(`/admin/polls/${id}`);
        } catch (error) {
            console.error(error);
            alert("저장에 실패했습니다. 다시 시도해 주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyTable = (optionText: string, tableId: string) => {
        const el = document.getElementById(tableId);
        if (!el) return;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        try {
            document.execCommand('copy');
            alert(`${optionText} 명단이 복사되었습니다.`);
        } catch (err) {
            alert("복사에 실패했습니다.");
        }
        selection?.removeAllRanges();
    };

    return (
        <div className="max-w-2xl mx-auto pb-24 w-full px-4 sm:px-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-zinc-400 hover:text-brand-navy hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 flex-1 text-center truncate px-4">
                    명단 정리하기
                </h1>
                <div className="w-10"></div> {/* Spacer for centering */}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6 mb-6">
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2 -ml-2">
                        <button 
                            onClick={() => router.push(`/admin/polls/${id}`)}
                            className="p-2 text-zinc-400 hover:text-brand-navy hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{poll.title}</h2>
                    </div>
                    <p className="text-sm text-zinc-500">총 {voters.length}명 참여</p>
                </div>

                {/* Tabs */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
                    <div className="flex w-full sm:w-auto bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1 flex-1">
                        <button
                            onClick={() => setActiveTab("by-option")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all",
                                activeTab === "by-option" ? "bg-white dark:bg-zinc-700 text-brand-navy shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <List size={16} /> 항목별 보기
                        </button>
                        <button
                            onClick={() => setActiveTab("by-voter")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all",
                                activeTab === "by-voter" ? "bg-white dark:bg-zinc-700 text-brand-navy shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            <Users size={16} /> 명단별 보기
                        </button>
                    </div>
                    {activeTab === "by-voter" && (
                        <button
                            onClick={() => {
                                setIsSelectMode(!isSelectMode);
                                if (isSelectMode) setSelectedVoters(new Set());
                            }}
                            className={cn(
                                "w-full sm:w-auto px-6 py-2 rounded-xl text-sm font-bold transition-all border shrink-0 shadow-sm",
                                isSelectMode 
                                    ? "bg-zinc-800 text-white border-zinc-800 hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900" 
                                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                            )}
                        >
                            {isSelectMode ? "선택 취소" : "명단 선택"}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-4 sm:p-5 border border-zinc-100 dark:border-zinc-800">
                    {activeTab === "by-option" ? (
                        <div className="space-y-6">
                            {formattedData.byOption.map((item, idx) => (
                                <div key={idx} className="space-y-2">
                                    <h3 className="text-sm font-bold text-brand-navy flex items-center justify-between">
                                        <span>■ {item.optionText}</span>
                                        <span className="bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full text-xs">{item.users.length}명</span>
                                    </h3>
                                    {item.users.length > 0 ? (
                                        <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed pl-4">
                                            {item.users.join(", ")}
                                        </p>
                                    ) : (
                                        <p className="text-[13px] text-zinc-400 pl-4">참여자 없음</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
                            <div className="border border-zinc-200/50 dark:border-zinc-800 rounded-xl overflow-x-auto bg-white dark:bg-zinc-900">
                                <div className="min-w-[400px] flex flex-col">
                                    {formattedData.byVoter.length > 0 ? (
                                        formattedData.byVoter.map((item, idx) => {
                                            let timeStr = "";
                                            if (item.createdAt) {
                                                const d = new Date(item.createdAt);
                                                timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                                            }
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={cn(
                                                        "flex items-center py-2.5 border-b border-zinc-200/50 dark:border-zinc-700/50 last:border-0 group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                                                        item.optionTexts.some((optText: string) => selectedVoters.has(`${item.originalIndex}_${optText}`)) && "bg-brand-navy/5 dark:bg-brand-navy/10"
                                                    )}
                                                >
                                                    {/* Sticky Name Column */}
                                                    <div 
                                                        className="sticky left-0 z-10 flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 sm:px-4 py-1 border-r border-zinc-100 dark:border-zinc-800 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] shrink-0"
                                                        style={{ width: '140px' }}
                                                    >
                                                        {/* Solid background overlay for hover/selected states */}
                                                        <div className={cn(
                                                            "absolute inset-0 transition-colors pointer-events-none",
                                                            item.optionTexts.some((optText: string) => selectedVoters.has(`${item.originalIndex}_${optText}`)) 
                                                                ? "bg-brand-navy/5 dark:bg-brand-navy/10 group-hover:bg-brand-navy/5 dark:group-hover:bg-brand-navy/10" 
                                                                : "group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/50"
                                                        )} />
                                                        <span className="text-xs font-bold text-zinc-400 text-right w-4 shrink-0 relative z-10">{idx + 1}.</span>
                                                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate relative z-10">
                                                            {item.userName} <span className="text-zinc-400 font-normal">({item.voteCount})</span>
                                                        </span>
                                                    </div>
                                                    {/* Scrollable Data */}
                                                    <div className="flex-1 flex items-center justify-between px-4 gap-4 min-w-[220px]">
                                                        <div className="flex items-center gap-2 flex-nowrap">
                                                            {item.optionTexts.map((optText: string, oIdx: number) => {
                                                                const selectionKey = `${item.originalIndex}_${optText}`;
                                                                const isSelected = selectedVoters.has(selectionKey);
                                                                return (
                                                                <button 
                                                                    key={oIdx}
                                                                    onClick={(e) => {
                                                                        if (isSelectMode) {
                                                                            e.stopPropagation();
                                                                            toggleSelection(selectionKey);
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        "text-xs px-2.5 py-1.5 rounded-lg font-medium text-center min-w-[80px] sm:min-w-[100px] truncate max-w-[200px] transition-all duration-200 shrink-0",
                                                                        isSelectMode ? "cursor-pointer hover:scale-[1.02] active:scale-95" : "cursor-default",
                                                                        isSelected 
                                                                            ? "bg-brand-navy text-white shadow-md ring-2 ring-brand-navy/30" 
                                                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                                                    )}
                                                                >
                                                                    {optText}
                                                                </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {timeStr && (
                                                            <span className="text-[11px] text-zinc-400 whitespace-nowrap shrink-0">{timeStr}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-[13px] text-zinc-400 text-center py-4 bg-zinc-50 dark:bg-zinc-800/30">투표 참여자가 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Selected Voters Table */}
                {isSelectMode && selectedVoters.size > 0 && activeTab === "by-voter" && (
                    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        {Object.entries(groupedSelected).map(([optionText, items]) => (
                            <div key={optionText} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{optionText} 명단 ({items.length}명)</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table id={`table-${optionText.replace(/\s+/g, '-')}`} className="w-full text-sm text-center min-w-[400px] border-collapse">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-700">
                                            <tr>
                                                <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-16">NO</th>
                                                <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-32">구분</th>
                                                <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-32">선수명</th>
                                                <th className="py-2.5 px-2 border border-zinc-200 dark:border-zinc-700 w-48">연락처</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-zinc-800 dark:text-zinc-200 font-medium">
                                            {items.map((item, rowIdx) => {
                                                const selectionKey = `${item.originalIndex}_${optionText}`;
                                                return (
                                                <tr key={item.originalIndex}>
                                                    <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700 bg-orange-50/30 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 font-bold">{rowIdx + 1}</td>
                                                    <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700">
                                                        <select 
                                                            className="w-full bg-transparent text-center outline-none cursor-pointer"
                                                            value={getCategory(selectionKey)}
                                                            onChange={(e) => handleCategoryChange(selectionKey, e.target.value)}
                                                        >
                                                            <option value="성인">성인</option>
                                                            <option value="미성년">미성년</option>
                                                        </select>
                                                    </td>
                                                    <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700">{item.userName}</td>
                                                    <td className="py-2 px-2 border border-zinc-200 dark:border-zinc-700">{item.phone}</td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                        
                        {/* Save Button */}
                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleSaveRoster}
                                disabled={isSaving}
                                className="px-8 py-3 bg-brand-navy hover:bg-brand-navy-light text-white font-bold rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                            >
                                {isSaving ? "등록 중..." : "등록"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
