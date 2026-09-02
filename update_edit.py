import sys
import re

file_path = r'd:\gla_coach\src\app\(main)\training\[id]\edit\page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update training options
opts_old = '''const trainingTypeOptions = [
    { key: "basic", label: "기본기" },
    { key: "preview", label: "예습" },
];'''
opts_new = '''const trainingTypeOptions = [
    { key: "basic", label: "기본기" },
    { key: "preview", label: "예습" },
    { key: "review", label: "복습" },
    { key: "lesson_review", label: "레슨 복기" },
];'''
content = content.replace(opts_old, opts_new)

# 2. Add states
states_old = '''    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [templateSettings, setTemplateSettings] = useState<any[]>([]);
    const [trainingComment, setTrainingComment] = useState("");'''
states_new = '''    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [templateSettings, setTemplateSettings] = useState<any[]>([]);
    const [trainingComment, setTrainingComment] = useState("");

    const [lessonComments, setLessonComments] = useState<string[]>([""]);
    const [goalType, setGoalType] = useState<"count" | "time">("count");
    const [goalCount, setGoalCount] = useState<number>(10);
    const [goalTime, setGoalTime] = useState<number>(10);
    const [trainingMethod, setTrainingMethod] = useState<"camera" | "voice">("camera");'''
content = content.replace(states_old, states_new)

# 3. Initialize state
init_old = '''                    const settings = data.template_settings || [];
                    setTemplateSettings(settings);
                    setSelectedTemplates(settings.map((s: any) => s.id));'''
init_new = '''                    const settings = data.template_settings || [];
                    const lessonReviewSetting = settings.find((s: any) => s.type === "lesson_review");
                    if (lessonReviewSetting) {
                        setLessonComments(lessonReviewSetting.comments?.length ? lessonReviewSetting.comments : [""]);
                        setGoalType(lessonReviewSetting.goalType || "count");
                        if (lessonReviewSetting.goalType === "time") {
                            setGoalTime(lessonReviewSetting.goalValue || 10);
                            setGoalCount(10);
                        } else {
                            setGoalCount(lessonReviewSetting.goalValue || 10);
                            setGoalTime(10);
                        }
                        setTrainingMethod(lessonReviewSetting.trainingMethod || "camera");
                    } else {
                        setTemplateSettings(settings);
                        setSelectedTemplates(settings.map((s: any) => s.id));
                    }'''
content = content.replace(init_old, init_new)

# 4. Handle Submit
submit_old = '''        try {
            const combinedTitle = templateSettings.map(s => s.title).join(", ") || "훈련 기록";
            
            const { error } = await updateTrainingRecord(id, {
                playerName: selectedPlayer,
                category: selectedTrainingType,
                title: combinedTitle,
                content: trainingComment,
                date: trainingDate,
                startTime: startSlot || "12:00",
                training_start: termStart,
                training_end: termEnd,
                total_count: totalCount,
                template_settings: templateSettings
            });'''
submit_new = '''        try {
            let combinedTitle = "훈련 기록";
            let finalTemplateSettings = templateSettings;
            let finalTotalCount = totalCount;

            if (selectedTrainingType === "lesson_review") {
                const typeLabel = trainingTypeOptions.find(opt => opt.key === selectedTrainingType)?.label || "";
                combinedTitle = typeLabel ? `[${typeLabel}] 훈련 기록` : "훈련 기록";
                finalTotalCount = goalType === "count" ? goalCount : goalTime;
                finalTemplateSettings = [{
                    type: "lesson_review",
                    comments: lessonComments.filter(c => c.trim() !== ""),
                    goalType: goalType,
                    goalValue: finalTotalCount,
                    trainingMethod: trainingMethod
                }];
            } else {
                combinedTitle = templateSettings.map(s => s.title).join(", ") || "훈련 기록";
            }
            
            const { error } = await updateTrainingRecord(id, {
                playerName: selectedPlayer,
                category: selectedTrainingType,
                title: combinedTitle,
                content: trainingComment,
                date: trainingDate,
                startTime: startSlot || "12:00",
                training_start: termStart,
                training_end: termEnd,
                total_count: finalTotalCount,
                template_settings: finalTemplateSettings
            });'''
content = content.replace(submit_old, submit_new)

# 5. Update UI
ui_old = '''                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 총 횟수 <span className="text-brand-red">*</span></label>
                            <div className="flex items-center gap-3">'''

ui_new = '''                        {selectedTrainingType === "lesson_review" ? (
                            <div className="space-y-8 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                {/* Lesson Comments */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                            코멘트 설정 (최대 5개) <span className="text-brand-red">*</span>
                                        </label>
                                        {lessonComments.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={() => setLessonComments([...lessonComments, ""])}
                                                className="flex items-center gap-1 text-xs font-bold text-brand-navy hover:text-brand-navy/80 transition-colors"
                                            >
                                                <Plus size={14} /> 코멘트 추가
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {lessonComments.map((comment, index) => (
                                            <div key={index} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <textarea
                                                        rows={2}
                                                        value={comment}
                                                        onChange={(e) => {
                                                            const newComments = [...lessonComments];
                                                            newComments[index] = e.target.value;
                                                            setLessonComments(newComments);
                                                        }}
                                                        placeholder={`코멘트 ${index + 1} 입력...`}
                                                        className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y"
                                                    />
                                                </div>
                                                {lessonComments.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newComments = lessonComments.filter((_, i) => i !== index);
                                                            setLessonComments(newComments);
                                                        }}
                                                        className="p-2.5 text-zinc-400 hover:text-brand-red transition-colors bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 mt-1"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-zinc-400">
                                        * 입력된 코멘트는 훈련 시 순차적으로 반복 재생됩니다.
                                    </p>
                                </div>

                                {/* Goal Setting */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        훈련 목표 설정 <span className="text-brand-red">*</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                            <button
                                                type="button"
                                                onClick={() => setGoalType("count")}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${goalType === "count" ? "bg-brand-navy text-white" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                                            >
                                                횟수 지정
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setGoalType("time")}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${goalType === "time" ? "bg-brand-navy text-white" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                                            >
                                                시간 지정
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {goalType === "count" ? (
                                                <>
                                                    <input 
                                                        type="number"
                                                        value={goalCount}
                                                        onChange={(e) => setGoalCount(parseInt(e.target.value) || 0)}
                                                        className="w-24 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-bold"
                                                    />
                                                    <span className="text-sm text-zinc-500">회</span>
                                                </>
                                            ) : (
                                                <>
                                                    <input 
                                                        type="number"
                                                        value={goalTime}
                                                        onChange={(e) => setGoalTime(parseInt(e.target.value) || 0)}
                                                        className="w-24 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all font-bold"
                                                    />
                                                    <span className="text-sm text-zinc-500">분</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Training Duration (Reused) */}
                                <div className="space-y-4">
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
                                            <DatePickerInput
                                                value={termStart}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTermStart(newVal);
                                                    setTotalCount(calculateDays(newVal, termEnd));
                                                }}
                                                placeholder="시작일"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                            />
                                        </div>
                                        <span className="text-zinc-400 text-sm">~</span>
                                        <div className="flex-1 relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                            <DatePickerInput
                                                value={termEnd}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setTermEnd(newVal);
                                                    setTotalCount(calculateDays(termStart, newVal));
                                                }}
                                                placeholder="종료일"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all text-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Training Method */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        훈련 방법 <span className="text-brand-red">*</span>
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setTrainingMethod("camera")}
                                            className={`px-5 py-3 rounded-xl border text-sm font-bold flex flex-col gap-1 items-start transition-all w-48 ${trainingMethod === "camera" ? "border-brand-navy bg-brand-navy/5 text-brand-navy" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}
                                        >
                                            <span>카메라 모드</span>
                                            <span className="text-[11px] font-normal opacity-80">모션 인식 및 코멘트 재생</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTrainingMethod("voice")}
                                            className={`px-5 py-3 rounded-xl border text-sm font-bold flex flex-col gap-1 items-start transition-all w-48 ${trainingMethod === "voice" ? "border-brand-navy bg-brand-navy/5 text-brand-navy" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}
                                        >
                                            <span>음성 모드</span>
                                            <span className="text-[11px] font-normal opacity-80">25초 간격 자동 코멘트</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 총 횟수 <span className="text-brand-red">*</span></label>
                            <div className="flex items-center gap-3">'''
content = content.replace(ui_old, ui_new)

ui_end_old = '''                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 코멘트</label>
                            <textarea rows={4} value={trainingComment} onChange={(e) => setTrainingComment(e.target.value)} placeholder="코치님의 코멘트를 입력해주세요..." className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y" />
                        </div>
                    </section>'''
ui_end_new = '''                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">훈련 코멘트</label>
                            <textarea rows={4} value={trainingComment} onChange={(e) => setTrainingComment(e.target.value)} placeholder="코치님의 코멘트를 입력해주세요..." className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-all resize-y" />
                        </div>
                        </>
                        )}
                    </section>'''
content = content.replace(ui_end_old, ui_end_new)

# 6. Add Plus to lucide-react imports if it's missing
import_old = '''import { ChevronLeft, Calendar, FileText, Upload, X, ChevronDown, ChevronUp, Layers, Search, Image as ImageIcon } from "lucide-react";'''
import_new = '''import { ChevronLeft, Calendar, FileText, Upload, X, ChevronDown, ChevronUp, Layers, Search, Image as ImageIcon, Plus } from "lucide-react";'''
content = content.replace(import_old, import_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Edit Done!')
