"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calendar, ChevronDown } from 'lucide-react';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { AthleteSearch } from '@/components/ui/AthleteSearch';
import { formatLocalDate } from '@/lib/utils';

const TRAINING_TYPES = [
  "티샷 비거리", "티샷 정확도", "180m 이상", "150~179m", "120~149m", "90~119m", 
  "벙커", "어프로치", "9미터 이상 퍼팅", "4~8미터 퍼팅", "2~3미터 퍼팅", "1미터 퍼팅"
];

export default function CreateSwingTestPage() {
    const router = useRouter();
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    
    const [trainingDate, setTrainingDate] = useState(() => formatLocalDate());
    const [trainingContent, setTrainingContent] = useState('');
    const [termStart, setTermStart] = useState(() => formatLocalDate());
    const [termEnd, setTermEnd] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    });
    
    const [goal, setGoal] = useState('');
    const [comment, setComment] = useState('');

    const handlePlayerAdd = (p: string) => {
        if (!selectedPlayers.includes(p)) {
            setSelectedPlayers([...selectedPlayers, p]);
        }
    };

    const handlePlayerRemove = (p: string) => {
        setSelectedPlayers(selectedPlayers.filter(name => name !== p));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayers.length === 0) return alert("선수를 한 명 이상 선택해주세요.");
        if (!trainingDate) return alert("훈련일자를 선택해주세요.");
        if (!trainingContent) return alert("훈련 컨텐츠를 선택해주세요.");
        if (!termStart || !termEnd) return alert("훈련기간을 정확히 입력해주세요.");
        
        // Save logic would go here. For now just alert and redirect.
        alert("복습 훈련이 성공적으로 등록되었습니다.");
        router.push("/training/swing-test");
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        복습 훈련 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-sm space-y-8">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 선수 선택 */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                선수 선택 <span className="text-brand-red">*</span>
                            </label>
                            <AthleteSearch
                                multi={true}
                                selectedNames={selectedPlayers}
                                onSelect={handlePlayerAdd}
                                onRemove={handlePlayerRemove}
                                placeholder="선수 이름을 검색하여 추가하세요..."
                            />
                        </div>

                        {/* 훈련일자 */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련일자 <span className="text-brand-red">*</span>
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <DatePickerInput
                                    value={trainingDate}
                                    onChange={(e) => setTrainingDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-left"
                                />
                            </div>
                        </div>

                        {/* 훈련 컨텐츠 */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련 컨텐츠 (훈련 리스트) <span className="text-brand-red">*</span>
                            </label>
                            <div className="relative">
                                <select 
                                    value={trainingContent}
                                    onChange={(e) => setTrainingContent(e.target.value)}
                                    className="w-full appearance-none bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition-all text-zinc-900 dark:text-zinc-100 cursor-pointer"
                                >
                                    <option value="">훈련 컨텐츠를 선택하세요</option>
                                    {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
                            </div>
                        </div>

                        {/* 훈련기간 */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련기간 <span className="text-brand-red">*</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={termStart}
                                        onChange={(e) => setTermStart(e.target.value)}
                                        placeholder="시작일"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-left"
                                    />
                                </div>
                                <span className="text-zinc-400 font-bold">~</span>
                                <div className="flex-1 relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <DatePickerInput
                                        value={termEnd}
                                        onChange={(e) => setTermEnd(e.target.value)}
                                        placeholder="종료일"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-left"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 훈련목표 */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련목표
                            </label>
                            <input
                                type="text"
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="예) 빈스윙과 같은 스피드로 25개 치기"
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all"
                            />
                        </div>

                        {/* 훈련 코멘트 */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                훈련 코멘트
                            </label>
                            <textarea
                                rows={5}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="코치님의 코멘트를 자유롭게 입력해주세요..."
                                className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6 flex gap-3 border-t border-zinc-100 dark:border-zinc-800">
                        <button 
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
                        >
                            취소
                        </button>
                        <button 
                            type="submit"
                            className="flex-1 py-3.5 bg-brand-red text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-red/30 hover:bg-brand-red-dark transition-colors active:scale-[0.98]"
                        >
                            등록하기
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
