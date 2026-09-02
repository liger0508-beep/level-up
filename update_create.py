import re

with open('d:\\gla_coach\\src\\app\\(main)\\lessons\\create\\page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'Video' not in content[:1000]:
    content = re.sub(r'import \{([^}]+)\} from "lucide-react";', r'import {\1, Video} from "lucide-react";', content)

state_addition = """
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
    const [afterFiles, setAfterFiles] = useState<File[]>([]);
    const [isGoal, setIsGoal] = useState(false);
"""
content = re.sub(r'const \[attachedFiles, setAttachedFiles\] = useState<File\[\]>\(\[\]\);', state_addition, content)

new_return = '''    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 sm:px-8 py-6">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={handleAbort} type="button" className="p-2 -ml-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        레슨 작성
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. Basic Info */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-6">
                        {/* Player Selection */}
                        <div className="space-y-4">
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

                        {/* Part Selection */}
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                파트 선택 <span className="text-brand-red">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {partOptions.map((opt) => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setSelectedPart(opt.key)}
                                        className={cn(
                                            "px-4 py-2.5 rounded-full text-sm font-medium transition-colors border",
                                            selectedPart === opt.key
                                                ? "bg-brand-navy text-white border-brand-navy"
                                                : "bg-transparent dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-brand-navy/50"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Selection */}
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                레슨 일자 <span className="text-brand-red">*</span>
                            </label>
                            <div className="relative w-full sm:w-1/2">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <DatePickerInput
                                    value={lessonDate}
                                    onChange={(e) => setLessonDate(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 2. History & Analysis (Conditional) */}
                    {selectedPlayers.length > 0 && selectedPart && (
                        <div className="space-y-6">
                            
                            {/* Lesson Goal */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-navy" />
                                    레슨 목표 <span className="text-[11px] font-normal text-zinc-400">({lastSelectedPlayer})</span>
                                </h3>
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2">
                                            <span className="text-[10px] font-bold text-brand-navy uppercase px-1.5 py-0.5 bg-brand-navy/10 rounded-md">{selectedPart}</span>
                                            <span className="text-[10px] font-bold text-red-500 uppercase px-1.5 py-0.5 bg-red-500/10 rounded-md">목표</span>
                                        </div>
                                        <span className="text-xs text-zinc-400">{lessonDate}</span>
                                    </div>
                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{lessonContent || "설정된 목표가 없습니다."}</p>
                                    <div className="flex justify-end pt-2">
                                        <button type="button" className="px-4 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-xs font-bold">평가하기</button>
                                    </div>
                                </div>
                            </section>

                            {/* Lesson History */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-navy dark:text-brand-navy-light" />
                                    레슨 히스토리 <span className="text-[11px] font-normal text-zinc-400">({lastSelectedPlayer})</span>
                                </h3>
                                <div className="flex justify-end">
                                    <button type="button" className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors">찾아보기</button>
                                </div>
                            </section>

                            {/* Recent Scorecard Summary Box */}
                            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex flex-col min-h-[200px]">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <Trophy size={18} className="text-amber-500" />
                                    최근 라운드 요약 <span className="text-[11px] font-normal text-zinc-400">({lastSelectedPlayer})</span>
                                </h3>
                                {recentScore ? (
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-[1.5rem] p-5 border border-zinc-100 dark:border-zinc-800 space-y-5 flex-1">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{recentScore.courseName}</p>
                                                <p className="text-[11px] text-zinc-400 font-medium">{recentScore.title}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5 px-2 py-0.5 w-fit rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500">
                                                    <Calendar size={10} />
                                                    {recentScore.date.replace(/-/g, ".")}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={cn(
                                                    "text-2xl font-black tracking-tighter leading-none",
                                                    recentScore.score < 72 ? "text-red-500" : recentScore.score > 72 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100"
                                                )}>
                                                    {recentScore.score}타
                                                </div>
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">Final Score</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { label: "티샷", val: recentScore.teeShotSG },
                                                { label: "세컨샷", val: recentScore.secondShotSG },
                                                { label: "그린주변", val: recentScore.aroundGreenSG },
                                                { label: "퍼팅", val: recentScore.puttingSG }
                                            ].map((item, i) => (
                                                <div key={i} className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 text-center">
                                                    <p className="text-[10px] font-bold text-zinc-400 mb-1">{item.label}</p>
                                                    <p className={cn(
                                                        "text-[13px] font-black tracking-tight",
                                                        item.val < 0 ? "text-red-500" : item.val > 0 ? "text-blue-500" : "text-zinc-600 dark:text-zinc-400"
                                                    )}>
                                                        {item.val > 0 ? `+${item.val.toFixed(2)}` : item.val.toFixed(2)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-start gap-6 pt-1">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Trophy size={14} className="text-amber-500" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Strong</span>
                                                </div>
                                                <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-[11px] font-black text-red-600 dark:text-red-400 text-center">
                                                    {recentScore.strongPoint}
                                                </div>
                                            </div>

                                            <div className="flex-[2] space-y-2">
                                                <div className="flex items-center gap-1.5">
                                                    <AlertTriangle size={14} className="text-blue-500" />
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Weak</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {recentScore.weakPoints.map((wp, idx) => (
                                                        <div key={idx} className="flex-1 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-[11px] font-black text-blue-600 dark:text-blue-400 text-center">
                                                            {wp}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-2 flex justify-end">
                                            <button 
                                                type="button"
                                                onClick={() => handleResumeNavigate(`/scores/${recentScore.id}`)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-[11px] font-bold hover:bg-brand-navy/90 transition-all shadow-md shadow-brand-navy/10 active:scale-95"
                                            >
                                                상세 분석
                                                <ChevronRight2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                 ) : (
                                     <div className="flex-1 flex items-center justify-center py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                         <p className="text-xs text-zinc-400">최근 라운드 기록이 없습니다.</p>
                                     </div>
                                 )}
                            </section>
                        </div>
                    )}

                    {/* 교정전 (Before) */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-zinc-500" />
                            교정전 (Before)
                        </h3>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer">
                                <Upload size={16} /> 파일 추가
                                <input type="file" multiple onChange={(e) => setBeforeFiles([...beforeFiles, ...Array.from(e.target.files||[])])} className="hidden" />
                            </label>
                            <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-navy/20 text-sm font-semibold text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10 transition-colors">
                                <Video size={16} /> 바로 촬영
                            </button>
                        </div>
                        {beforeFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {beforeFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                        <Paperclip size={14} className="text-zinc-400" />
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[150px] truncate">{f.name}</span>
                                        <button type="button" onClick={() => setBeforeFiles(beforeFiles.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-brand-red"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 교정후 (After) */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-brand-navy" />
                            교정후 (After)
                        </h3>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer">
                                <Upload size={16} /> 파일 추가
                                <input type="file" multiple onChange={(e) => setAfterFiles([...afterFiles, ...Array.from(e.target.files||[])])} className="hidden" />
                            </label>
                            <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-navy/20 text-sm font-semibold text-brand-navy bg-brand-navy/5 hover:bg-brand-navy/10 transition-colors">
                                <Video size={16} /> 바로 촬영
                            </button>
                        </div>
                        {afterFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {afterFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                        <Paperclip size={14} className="text-zinc-400" />
                                        <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[150px] truncate">{f.name}</span>
                                        <button type="button" onClick={() => setAfterFiles(afterFiles.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-brand-red"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 레슨 내용 */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <FileText size={18} className="text-green-500" />
                                레슨 내용
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">목표 설정</span>
                                <button 
                                    type="button" 
                                    onClick={() => setIsGoal(!isGoal)} 
                                    className={cn("w-11 h-6 rounded-full relative transition-colors", isGoal ? "bg-brand-navy" : "bg-zinc-200 dark:bg-zinc-700")}
                                >
                                    <div className={cn("absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform", isGoal ? "translate-x-5" : "")}></div>
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500">* 레슨의 목적과 교정 방향을 명확하게 작성해 주세요.</p>
                        <textarea
                            rows={6}
                            value={lessonContent}
                            onChange={(e) => setLessonContent(e.target.value)}
                            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 resize-y text-zinc-900 dark:text-zinc-100"
                        />
                    </section>

                    {/* 스윙오류 */}
                    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <ImageIcon size={18} className="text-orange-500" />
                                스윙오류
                            </h3>
                            <div className="flex justify-end">
                                <button type="button" className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors">찾아보기</button>
                            </div>
                        </div>
                    </section>

                    {/* Submit Button */}
                    <div className="pt-6 pb-20">
                        <button
                            type="submit"
                            disabled={!isFormValid || isUploading}
                            className="w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-md active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed bg-brand-navy text-white hover:bg-brand-navy/90"
                        >
                            {isUploading ? "저장 중..." : "레슨 등록하기"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}'''

start_idx = content.find('    return (\n        <div className="min-h-screen')
if start_idx != -1:
    content = content[:start_idx] + new_return

with open('d:\\gla_coach\\src\\app\\(main)\\lessons\\create\\page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
