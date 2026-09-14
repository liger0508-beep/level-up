import os
import re

src_file = r"d:\gla_coach\src\app\(main)\admin\training-temp\create\page.tsx"
tgt_file = r"d:\gla_coach\src\app\(main)\training\create\page.tsx"

with open(src_file, 'r', encoding='utf-8') as f:
    src_content = f.read()

with open(tgt_file, 'r', encoding='utf-8') as f:
    tgt_content = f.read()

# 1. Update trainingTypeOptions
tgt_content = tgt_content.replace(
    '{ key: "preview", label: "예습" }',
    '{ key: "lesson_review", label: "스윙키" }'
)

# 2. Add imports
import_lucide = re.search(r'import \{[^}]+\} from "lucide-react";', tgt_content)
if import_lucide:
    lucide_str = import_lucide.group(0)
    if 'Play' not in lucide_str:
        new_lucide = lucide_str.replace('} from "lucide-react"', ', Play, Plus, Minus} from "lucide-react"')
        tgt_content = tgt_content.replace(lucide_str, new_lucide)

if "SwingKeyPreviewModal" not in tgt_content:
    lines = tgt_content.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('import { TopicPickerSheet'):
            lines.insert(i, 'import { SwingKeyPreviewModal } from "@/components/training/SwingKeyPreviewModal";')
            break
    tgt_content = '\n'.join(lines)

# 3. Add state variables
state_vars = """    const [showSwingKeyPreview, setShowSwingKeyPreview] = useState(false);
    const [previewCurrentComment, setPreviewCurrentComment] = useState("");

    // Swing Key (lesson_review) states
    const [lessonComments, setLessonComments] = useState<string[]>([""]);
    const [commentIntervals, setCommentIntervals] = useState<(number | "")[]>([]);
    const [goalTime, setGoalTime] = useState<number | "">("");
    const [swingKeyInterval, setSwingKeyInterval] = useState<number | "">(25);"""

if "lessonComments" not in tgt_content:
    tgt_content = tgt_content.replace('const [isSaving, setIsSaving] = useState(false);', 'const [isSaving, setIsSaving] = useState(false);\n' + state_vars)

# 4. Extract logic block from source for handleSubmit
# find start of selectedTrainingType === "lesson_review" in handleSubmit
# Actually it's easier to just replace the blocks directly with string replacement.

handle_submit_validation_old = """        if (selectedTemplates.length === 0) {
            alert("훈련 컨텐츠를 하나 이상 선택해주세요.");
            return;
        }"""
handle_submit_validation_new = """        if (selectedTrainingType === "basic" && selectedTemplates.length === 0) {
            alert("훈련 컨텐츠를 하나 이상 선택해주세요.");
            return;
        }

        if (selectedTrainingType === "lesson_review" && lessonComments.every(c => c.trim() === "")) {
            alert("코멘트를 최소 1개 이상 입력해주세요.");
            return;
        }"""
tgt_content = tgt_content.replace(handle_submit_validation_old, handle_submit_validation_new)


handle_submit_loop_old = """            for (const player of selectedPlayers) {
                // 1. Save to Supabase Records
                const { error } = await saveTrainingRecord({
                    playerName: player,
                    category: selectedPart,
                    title: finalTitle || "훈련 기록",
                    content: trainingComment,
                    date: trainingDate,
                    startTime: trainingTime,
                    training_start: termStart,
                    training_end: termEnd,
                    total_count: totalCount,
                    template_settings: templateSettings
                });

                if (error) throw new Error(error);
            }"""

handle_submit_loop_new = """            for (const player of selectedPlayers) {
                if (selectedTrainingType === "lesson_review") {
                    const finalTitle = typeLabel ? `[${typeLabel}] 훈련` : "훈련";
                    
                    const validComments: string[] = [];
                    const validIntervals: number[] = [];
                    for (let i = 0; i < lessonComments.length; i++) {
                        if (lessonComments[i].trim() !== "") {
                            validComments.push(lessonComments[i]);
                            if (validComments.length > 1) {
                                validIntervals.push((commentIntervals[i - 1] as number) || 3);
                            }
                        }
                    }

                    const { error } = await saveTrainingRecord({
                        playerName: player,
                        category: selectedPart, // Use selectedPart as per training page convention, unlike temp
                        title: finalTitle,
                        content: trainingComment,
                        date: trainingDate,
                        startTime: trainingTime,
                        training_start: termStart,
                        training_end: termEnd,
                        total_count: (goalTime as number) || 0,
                        template_settings: [{
                            type: "lesson_review",
                            comments: validComments,
                            goalType: "time",
                            goalValue: (goalTime as number) || 0,
                            trainingMethod: "voice",
                            swingKeyInterval: (swingKeyInterval as number) || 25,
                            commentIntervals: validIntervals
                        }]
                    });
                    if (error) throw new Error(error);
                } else {
                    const { error } = await saveTrainingRecord({
                        playerName: player,
                        category: selectedPart,
                        title: finalTitle || "훈련 기록",
                        content: trainingComment,
                        date: trainingDate,
                        startTime: trainingTime,
                        training_start: termStart,
                        training_end: termEnd,
                        total_count: totalCount,
                        template_settings: templateSettings
                    });
                    if (error) throw new Error(error);
                }
            }"""
tgt_content = tgt_content.replace(handle_submit_loop_old, handle_submit_loop_new)

# 5. UI replacement
# In source: from {selectedTrainingType === "lesson_review" ? ( to ) : selectedTrainingType === "basic" && (
src_start = '{selectedTrainingType === "lesson_review" ? ('
src_end = ') : selectedTrainingType === "basic" && ('
if src_start in src_content and src_end in src_content:
    idx1 = src_content.find(src_start)
    idx2 = src_content.find(src_end) + len(src_end)
    ui_block = src_content[idx1:idx2]
    
    # We replace from {/* Training Content Selection */} to <div className="space-y-2"> (which is Training Comment)
    tgt_start = '{/* Training Content Selection */}'
    # The end of the block in tgt is before {/* Training Comment */}
    tgt_end_marker = '{/* Training Comment */}'
    if tgt_start in tgt_content and tgt_end_marker in tgt_content:
        idx_t1 = tgt_content.find(tgt_start)
        idx_t2 = tgt_content.find(tgt_end_marker)
        
        old_ui = tgt_content[idx_t1:idx_t2]
        
        # we combine ui_block + old_ui + )}
        new_ui = ui_block + '\\n' + old_ui + '\\n                        )}\\n\\n                        '
        tgt_content = tgt_content.replace(old_ui, new_ui)

# Finally add the SwingKeyPreviewModal at the end of the file if not exists
modal_str = """            <SwingKeyPreviewModal
                isOpen={showSwingKeyPreview}
                onClose={() => setShowSwingKeyPreview(false)}
                comments={lessonComments.filter(c => c.trim() !== "")}
                intervals={commentIntervals as number[]}
                currentComment={previewCurrentComment}
                onCommentChange={setPreviewCurrentComment}
                swingKeyInterval={(swingKeyInterval as number) || 25}
            />"""
if "SwingKeyPreviewModal" not in tgt_content.split('return (')[1]:
    tgt_content = tgt_content.replace('</form>', '</form>\\n' + modal_str)


with open(tgt_file, 'w', encoding='utf-8') as f:
    f.write(tgt_content)

print("Done")
