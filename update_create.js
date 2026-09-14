const fs = require('fs');

const src_file = 'd:\\gla_coach\\src\\app\\(main)\\admin\\training-temp\\create\\page.tsx';
const tgt_file = 'd:\\gla_coach\\src\\app\\(main)\\training\\create\\page.tsx';

let src_content = fs.readFileSync(src_file, 'utf8');
let tgt_content = fs.readFileSync(tgt_file, 'utf8');

// 1. Update trainingTypeOptions
tgt_content = tgt_content.replace(
    '{ key: "preview", label: "예습" }',
    '{ key: "lesson_review", label: "스윙키" }'
);

// 2. Add imports
const lucideMatch = tgt_content.match(/import \{[^}]+\} from "lucide-react";/);
if (lucideMatch) {
    let lucide_str = lucideMatch[0];
    if (!lucide_str.includes('Play')) {
        let new_lucide = lucide_str.replace('} from "lucide-react"', ', Play, Plus, Minus} from "lucide-react"');
        tgt_content = tgt_content.replace(lucide_str, new_lucide);
    }
}

if (!tgt_content.includes("SwingKeyPreviewModal")) {
    const lines = tgt_content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import { TopicPickerSheet')) {
            lines.splice(i, 0, 'import { SwingKeyPreviewModal } from "@/components/training/SwingKeyPreviewModal";');
            break;
        }
    }
    tgt_content = lines.join('\n');
}

// 3. Add state variables
const state_vars = `    const [showSwingKeyPreview, setShowSwingKeyPreview] = useState(false);
    const [previewCurrentComment, setPreviewCurrentComment] = useState("");

    // Swing Key (lesson_review) states
    const [lessonComments, setLessonComments] = useState<string[]>([""]);
    const [commentIntervals, setCommentIntervals] = useState<(number | "")[]>([]);
    const [goalTime, setGoalTime] = useState<number | "">("");
    const [swingKeyInterval, setSwingKeyInterval] = useState<number | "">(25);`;

if (!tgt_content.includes("lessonComments")) {
    tgt_content = tgt_content.replace('const [isSaving, setIsSaving] = useState(false);', 'const [isSaving, setIsSaving] = useState(false);\n' + state_vars);
}

// 4. Extract logic block from source for handleSubmit
const handle_submit_validation_old = `        if (selectedTemplates.length === 0) {
            alert("훈련 컨텐츠를 하나 이상 선택해주세요.");
            return;
        }`;
const handle_submit_validation_new = `        if (selectedTrainingType === "basic" && selectedTemplates.length === 0) {
            alert("훈련 컨텐츠를 하나 이상 선택해주세요.");
            return;
        }

        if (selectedTrainingType === "lesson_review" && lessonComments.every(c => c.trim() === "")) {
            alert("코멘트를 최소 1개 이상 입력해주세요.");
            return;
        }`;
tgt_content = tgt_content.replace(handle_submit_validation_old, handle_submit_validation_new);

const handle_submit_loop_old = `            for (const player of selectedPlayers) {
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
            }`;

const handle_submit_loop_new = `            for (const player of selectedPlayers) {
                if (selectedTrainingType === "lesson_review") {
                    const finalTitle = typeLabel ? \`[\${typeLabel}] 훈련\` : "훈련";
                    
                    const validComments = [];
                    const validIntervals = [];
                    for (let i = 0; i < lessonComments.length; i++) {
                        if (lessonComments[i].trim() !== "") {
                            validComments.push(lessonComments[i]);
                            if (validComments.length > 1) {
                                validIntervals.push(commentIntervals[i - 1] || 3);
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
                        total_count: goalTime || 0,
                        template_settings: [{
                            type: "lesson_review",
                            comments: validComments,
                            goalType: "time",
                            goalValue: goalTime || 0,
                            trainingMethod: "voice",
                            swingKeyInterval: swingKeyInterval || 25,
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
            }`;
tgt_content = tgt_content.replace(handle_submit_loop_old, handle_submit_loop_new);

// 5. UI replacement
const src_start = '{selectedTrainingType === "lesson_review" ? (';
const src_end = ') : selectedTrainingType === "basic" && (';
if (src_content.includes(src_start) && src_content.includes(src_end)) {
    const idx1 = src_content.indexOf(src_start);
    const idx2 = src_content.indexOf(src_end) + src_end.length;
    const ui_block = src_content.substring(idx1, idx2);
    
    const tgt_start = '{/* Training Content Selection */}';
    const tgt_end_marker = '{/* Training Comment */}';
    if (tgt_content.includes(tgt_start) && tgt_content.includes(tgt_end_marker)) {
        const idx_t1 = tgt_content.indexOf(tgt_start);
        const idx_t2 = tgt_content.indexOf(tgt_end_marker);
        
        const old_ui = tgt_content.substring(idx_t1, idx_t2);
        const new_ui = ui_block + '\n                            <>\n                            {/* Training Content Selection */}\n' + old_ui + '\n                            </>\n                        )}\n\n                        {/* Training Comment */}';
        tgt_content = tgt_content.replace(old_ui, new_ui);
    }
}

// Finally add the SwingKeyPreviewModal at the end of the file if not exists
const modal_str = `            <SwingKeyPreviewModal
                isOpen={showSwingKeyPreview}
                onClose={() => setShowSwingKeyPreview(false)}
                comments={lessonComments.filter(c => c.trim() !== "")}
                intervals={commentIntervals}
                currentComment={previewCurrentComment}
                onCommentChange={setPreviewCurrentComment}
                swingKeyInterval={swingKeyInterval || 25}
            />`;

if (tgt_content.indexOf('</form>') > -1 && tgt_content.indexOf('SwingKeyPreviewModal') > tgt_content.indexOf('return (')) {
    // already there
} else if (tgt_content.indexOf('</form>') > -1) {
    tgt_content = tgt_content.replace('</form>', '</form>\\n' + modal_str);
}

fs.writeFileSync(tgt_file, tgt_content, 'utf8');
console.log("Done");
