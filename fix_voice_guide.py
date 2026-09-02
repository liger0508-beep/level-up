import os
import re

file_path = 'src/app/(main)/training/voice-guide/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports and constants
content = content.replace('import { Play, Square, Mic, MicOff, CheckCircle, ChevronLeft, Lock, Unlock, Pause } from "lucide-react";', 'import { Play, Square, Mic, MicOff, CheckCircle, ChevronLeft, Lock, Unlock, Pause, Volume2 } from "lucide-react";')

content = content.replace('export type TrainingType = \'shot\' | \'tee-shot\' | \'putt\';', '''export type TrainingType = 
  | 'shot' 
  | 'tee-shot'
  | '180m-plus'
  | '150-179m'
  | '120-149m'
  | '90-119m'
  | 'pitch-shot'
  | 'bunker'
  | 'approach'
  | '9m-plus-putt'
  | '4-8m-putt'
  | '2-3m-putt'
  | '1m-putt';''')

# We need to rewrite TRAINING_CONFIG entirely.
old_config_pattern = r'const TRAINING_CONFIG: Record<TrainingType, TrainingConfig> = \{[\s\S]*?\};\n\ninterface VoiceState'
new_config = '''const TRAINING_CONFIG: Record<string, TrainingConfig> = {
  'tee-shot': {
    id: 'tee-shot',
    title: '티샷',
    uiName: '티샷',
    successPrefix: '티샷 ',
    successSuffix: '성공',
    stages: [],
    completionText: "티샷 훈련 완료"
  },
  '180m-plus': { id: '180m-plus', title: '180m 이상', uiName: '180m 이상', stages: [], completionText: "" },
  '150-179m': { id: '150-179m', title: '150~179m', uiName: '150~179m', stages: [], completionText: "" },
  '120-149m': { id: '120-149m', title: '120~149m', uiName: '120~149m', stages: [], completionText: "" },
  '90-119m': { id: '90-119m', title: '90~119m', uiName: '90~119m', stages: [], completionText: "" },
  'pitch-shot': { id: 'pitch-shot', title: '피치샷', uiName: '피치샷', stages: [], completionText: "" },
  'bunker': { id: 'bunker', title: '벙커', uiName: '벙커', stages: [], completionText: "" },
  'approach': { id: 'approach', title: '어프로치', uiName: '어프로치', stages: [], completionText: "" },
  '9m-plus-putt': { id: '9m-plus-putt', title: '9m 이상 퍼팅', uiName: '9m 이상', stages: [], completionText: "" },
  '4-8m-putt': { id: '4-8m-putt', title: '4~8m 퍼팅', uiName: '4~8m', stages: [], completionText: "" },
  '2-3m-putt': { id: '2-3m-putt', title: '2~3m 퍼팅', uiName: '2~3m', stages: [], completionText: "" },
  '1m-putt': { id: '1m-putt', title: '1m 퍼팅', uiName: '1m', stages: [], completionText: "" },
};

interface VoiceState'''
content = re.sub(old_config_pattern, new_config, content)

# 2. Setup stateRef and variables in component
content = content.replace("const [currentPrompt, setCurrentPrompt] = useState<string>('');", "const [currentPrompt, setCurrentPrompt] = useState<string>('');\n  const [currentSpokenPrompt, setCurrentSpokenPrompt] = useState<string>('');")

# 3. Add windAssignmentsRef inside component
content = content.replace("const lastTapRef = useRef(0);", "const lastTapRef = useRef(0);\n  const windAssignmentsRef = useRef<Record<number, string>>({});")

# 4. Update init speech logic
generate_prompt_pattern = r'const generatePrompt = \(stageIndex: number, holeNum\?: number\) => \{[\s\S]*?return \{ spoken, visual \};\n  \};'
new_generate_prompt = '''const getTargetForCategory = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes("180")) return 7;
    if (c.includes("150") || c.includes("120") || c.includes("149") || c.includes("119") || c.includes("90")) return 5;
    if (c.includes("피치샷") || c.includes("pitch")) return 5;
    if (c.includes("어프로치") || c.includes("approach")) return 5;
    if (c.includes("벙커") || c.includes("bunker")) return 5;
    if (c.includes("9m") || c.includes("퍼팅")) return 5;
    if (c.includes("티샷") || c.includes("tee")) return 14;
    return 10;
  };

  const getGoalTextForCategory = (cat: string, n: string) => {
    if (n.includes("180")) return "7미터 이내 붙이기";
    if (n.includes("150") || n.includes("120") || n.includes("149")) return "5미터 이내 붙이기";
    if (n.includes("119") || n.includes("90") || n.includes("피치샷")) return "3미터 이내 붙이기";
    if (n.includes("어프로치")) return "2미터 이내 붙이기";
    if (n.includes("벙커")) return "3미터 이내 붙이기";
    if (n.includes("9m")) return "1미터 이내 붙이기 (투펏)";
    if (n.includes("4~8m")) return "1미터 이내 붙이기 (투펏)";
    if (n.includes("2~3m")) return "1퍼터 마무리";
    if (n.includes("1m")) return "1퍼터 마무리";
    if (n.includes("티샷")) return "페어웨이 적중";
    return "성공하기";
  };

  const convertDistToKorean = (str: string) => {
      let res = str.replace(/m/gi, ' 미터 ');
      res = res.replace(/180/g, '백팔십');
      res = res.replace(/150/g, '백오십');
      res = res.replace(/179/g, '백칠십구');
      res = res.replace(/120/g, '백이십');
      res = res.replace(/149/g, '백사십구');
      res = res.replace(/90/g, '구십');
      res = res.replace(/119/g, '백십구');
      res = res.replace(/9/g, '구');
      res = res.replace(/4~8/g, '사에서 팔');
      res = res.replace(/2~3/g, '이에서 삼');
      res = res.replace(/1/g, '일');
      return res;
  };

  const generatePrompt = (stageIndex: number, holeNum?: number) => {
      const { currentConfig: config, trainingType: tType, isPrep } = stateRef.current;
      const reviewCat = searchParams.get('cat') || '';
      
      let spoken = '';
      let visual = '';
      
      if (tType === 'review_hole' || tType === 'review_category') {
          const categoryName = isPrep ? parsedHoles[stageIndex]?.holeText : reviewCat;
          const isCategory = tType === 'review_category';
          let holeText = "";
          
          if (isCategory && isPrep) {
              const ch = parsedHoles[stageIndex];
              holeText = ch?.hole || String(stageIndex + 1);
          } else if (isCategory && !isPrep) {
              holeText = parsedHoles[stageIndex]?.hole || "1";
          } else {
              holeText = reviewHole;
          }
          
          let parString = "";
          if (holeText === "1" || holeText === "2" || holeText === "5" || holeText === "7" || holeText === "11" || holeText === "14" || holeText === "16" || holeText === "18") {
              parString = "4";
          } else if (holeText === "3" || holeText === "8" || holeText === "12" || holeText === "17") {
              parString = "3";
          } else {
              parString = "5";
          }
          
          const targetStr = categoryName;
          
          if (isPrep && targetStr.includes("티샷")) {
              let wind = windAssignmentsRef.current[parseInt(holeText)];
              if (wind) {
                  spoken = ${holeText}번홀 par  티샷  입니다. 티샷 후 이어폰 버튼을 눌러주세요.;
                  visual = ${holeText}번홀 - Par  - ;
              } else {
                  spoken = ${holeText}번홀 par  티샷입니다. 티샷 후 이어폰 버튼을 눌러주세요.;
                  visual = ${holeText}번홀 - Par ;
              }
              return { spoken, visual };
          }
          
          if (targetStr.includes("180") || targetStr.includes("150") || targetStr.includes("120") || targetStr.includes("90") || targetStr.includes("피치샷")) {
              const pinArr = ["앞핀", "백핀", "좌핀", "우핀", "센터핀"];
              const windArr = ["없습니다", "맞바람", "뒷바람", "강한 맞바람", "강한 뒷바람"];
              const pin = pinArr[Math.floor(Math.random() * pinArr.length)];
              const wind = windArr[Math.floor(Math.random() * windArr.length)];
              
              let distStr = targetStr.replace(' 이상', '').replace('m', '');
              if (distStr === "피치샷") distStr = "60~80";
              const distToRead = convertDistToKorean(distStr);
              
              const goalText = getGoalTextForCategory(targetStr, targetStr);
              spoken = ${holeText}번홀 시도거리는  미터 핀위치는  바람은  입니다. 목표는  입니다. 샷 후 이어폰 버튼을 눌러주세요.;
              visual = ${holeText}번홀 - m -  - ;
              return { spoken, visual };
          }
          
          if (targetStr.includes("어프로치")) {
              const posArr = ["평지", "러프", "맨땅", "왼발 오르막 라이", "왼발 내리막 라이", "공이 발보다 높은 라이", "공이 발보다 낮은 라이"];
              const pinArr = ["앞핀", "뒷핀", "중핀", "심한 오르막", "심한 내리막"];
              const pos = posArr[Math.floor(Math.random() * posArr.length)];
              const pin = pinArr[Math.floor(Math.random() * pinArr.length)];
              const dists = ["10", "20", "30"];
              const distStr = dists[Math.floor(Math.random() * dists.length)];
              
              const goalText = getGoalTextForCategory(targetStr, targetStr);
              spoken = 시도거리는  미터 공의 위치는  핀위치는  입니다. 목표는  입니다. 샷 후 이어폰 버튼을 눌러주세요.;
              visual = ${distStr}m -  - ;
              return { spoken, visual };
          }
          
          if (targetStr.includes("벙커")) {
              const posArr = ["평평한 라이", "박힌 라이", "발자국 라이", "업힐 라이", "다운힐 라이", "사이드 업힐 라이", "사이드 다운힐 라이"];
              const pinArr = ["앞핀", "뒷핀", "중핀", "심한 오르막", "심한 내리막"];
              const pos = posArr[Math.floor(Math.random() * posArr.length)];
              const pin = pinArr[Math.floor(Math.random() * pinArr.length)];
              const dists = ["10", "20", "30"];
              const distStr = dists[Math.floor(Math.random() * dists.length)];
              
              const goalText = getGoalTextForCategory(targetStr, targetStr);
              spoken = 시도거리는  미터 공의 위치는  핀위치는  입니다. 목표는  입니다. 샷 후 이어폰 버튼을 눌러주세요.;
              visual = ${distStr}m -  - ;
              return { spoken, visual };
          }
          
          if (targetStr.includes("퍼팅") || targetStr.includes("putt")) {
              const slopeArr = ["스트레이트", "오르막", "내리막", "슬라이스", "훅", "오르막 슬라이스", "오르막 훅", "내리막 슬라이스", "내리막 훅"];
              const slope = slopeArr[Math.floor(Math.random() * slopeArr.length)];
              let distStr = targetStr.replace(' 이상 퍼팅', '').replace('m', '').replace(' 퍼팅', '');
              
              const goalText = getGoalTextForCategory(targetStr, targetStr);
              spoken = 시도 위치는  미터  경사입니다. 목표는  입니다. 샷 후 이어폰 버튼을 눌러주세요.;
              visual = ${distStr}m -  경사;
              return { spoken, visual };
          }
          
          return { spoken: "훈련을 진행해주세요.", visual: "훈련 진행 중" };
      }
      
      const st = config?.stages?.find(s => s.stageNum === (stageIndex + 1));
      if (st) {
          return { spoken: st.introPrompt, visual: st.introPrompt };
      }
      
      return { spoken: "훈련을 진행해주세요.", visual: "훈련 진행 중" };
  };'''
content = re.sub(generate_prompt_pattern, new_generate_prompt, content)

# 5. Fix speakAndWait and playSpeech to use both
content = content.replace("const speakAndWait = (text: string, callback?: () => void) => {", "const speakAndWait = (text: string, visualTextOrCallback?: string | (() => void), callback?: () => void) => {")
speak_body_old = '''    if (callback) {
        cb = callback;
    }
    setCurrentPrompt(text);'''
speak_body_new = '''    let visual = text;
    if (typeof visualTextOrCallback === 'function') {
        cb = visualTextOrCallback;
    } else if (typeof visualTextOrCallback === 'string') {
        visual = visualTextOrCallback;
    }
    setCurrentPrompt(visual);
    setCurrentSpokenPrompt(text);'''
content = content.replace(speak_body_old, speak_body_new)

# 6. Fix startTraining to randomly assign winds and use { spoken, visual }
start_training_old = '''      if (trainingType === 'review_hole' || trainingType === 'review_category') {
          const firstPrompt = generatePrompt(0);
          speakAndWait(firstPrompt, () => {'''
start_training_new = '''      // Initialize winds for Prep Tee-shots
      const windTypes = ["맞바람", "뒷바람", "강한 맞바람", "강한 뒷바람"];
      let availableHoles = [];
      for (let i = 2; i <= 18; i++) availableHoles.push(i);
      availableHoles.sort(() => Math.random() - 0.5);
      const selectedHoles = availableHoles.slice(0, 4);
      const winds: Record<number, string> = {};
      selectedHoles.forEach(h => {
          winds[h] = windTypes[Math.floor(Math.random() * windTypes.length)];
      });
      windAssignmentsRef.current = winds;

      if (trainingType === 'review_hole' || trainingType === 'review_category') {
          const { spoken, visual } = generatePrompt(0);
          speakAndWait(spoken, visual, () => {'''
content = content.replace(start_training_old, start_training_new)

# 7. Fix handleShotSuccess logic for targetForReview
handle_shot_old = "const targetForReview = isPrep ? 1 : (reviewCat.includes('비거리') || reviewCat.includes('정확도') ? 7 : 5);"
handle_shot_new = "const targetForReview = isPrep ? 1 : getTargetForCategory(reviewCat);"
content = content.replace(handle_shot_old, handle_shot_new)

# 8. Fix handleShotSuccess next prompt
next_prompt_old = '''              if (isCategory) {
                  const np = generatePrompt(newProgress);
                  speakAndWait(np, () => {
                      setIsActive(true);
                  });
              }'''
next_prompt_new = '''              if (isCategory) {
                  const { spoken, visual } = generatePrompt(currentIndex + 1);
                  speakAndWait(spoken, visual, () => {
                      setIsActive(true);
                  });
              }'''
content = content.replace(next_prompt_old, next_prompt_new)

# 9. Change remaining count display
ui_remaining_old = '''                    <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        남은 횟수 {trainingType === 'review_category' ? Math.max(0, parsedHoles.length - stageIndex) : Math.max(0, target - progress)}회
                    </span>
                    <span className="text-sm sm:text-base font-bold text-zinc-400">
                        ({trainingType === 'review_category' ? stageIndex : progress}/{trainingType === 'review_category' ? parsedHoles.length : target})
                    </span>'''
ui_remaining_new = '''                    <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        남은 횟수 {(isPrep && trainingType === 'review_category') ? Math.max(0, parsedHoles.length - stageIndex) : Math.max(0, target - progress)}회
                    </span>
                    <span className="text-sm sm:text-base font-bold text-zinc-400">
                        ({(isPrep && trainingType === 'review_category') ? stageIndex : progress}/{(isPrep && trainingType === 'review_category') ? parsedHoles.length : target})
                    </span>'''
content = content.replace(ui_remaining_old, ui_remaining_new)

# 10. Replace Pause with Replay Voice
pause_btn_old = '''               {/* Pause / Resume Button */}
               <button
                   onClick={(e) => { e.stopPropagation(); togglePause(); }}
                   className={py-4  hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border}
               >
                   {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6 text-zinc-400" />} 
                   {isPaused ? '훈련 재개' : '일시 정지'}
               </button>'''
pause_btn_new = '''               {/* Pause / Resume Button or Replay Voice Button */}
               {(trainingType === 'review_hole' || trainingType === 'review_category') ? (
                   <button
                       onClick={(e) => { 
                           e.stopPropagation(); 
                           if (currentSpokenPrompt) {
                               speakAndWait(currentSpokenPrompt, currentPrompt);
                           }
                       }}
                       className="py-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border border-zinc-200 dark:border-zinc-800"
                   >
                       <Volume2 className="w-6 h-6 text-zinc-400" /> 다시 듣기
                   </button>
               ) : (
                   <button
                       onClick={(e) => { e.stopPropagation(); togglePause(); }}
                       className={py-4  hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl font-bold text-sm shadow-sm flex flex-col items-center justify-center gap-2 transition-all border}
                   >
                       {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6 text-zinc-400" />} 
                       {isPaused ? '훈련 재개' : '일시 정지'}
                   </button>
               )}'''
content = content.replace(pause_btn_old, pause_btn_new)

# 11. Add proper target calculation
target_calc_old = "const target = (reviewType === 'review_category' || reviewType === 'review_hole') ? targetForReview : (currentStage ? currentStage.target : 10);"
target_calc_new = "const target = (trainingType === 'review_category' || trainingType === 'review_hole') ? targetForReview : (currentStage ? currentStage.target : 10);"
content = content.replace(target_calc_old, target_calc_new)

# 12. Fix stageIndex increment in handleShotSuccess
shot_progress_old = '''                  if (isCategory) {
                      setStageIndex(currentIndex + 1);
                      stateRef.current.stageIndex = currentIndex + 1;
                  }'''
shot_progress_new = '''                  if (isCategory) {
                      setStageIndex(currentIndex + 1);
                      stateRef.current.stageIndex = currentIndex + 1;
                      setProgress(0);
                      stateRef.current.progress = 0;
                  }'''
content = content.replace(shot_progress_old, shot_progress_new)

# Fix trainingType declaration bug in effect
content = content.replace("trainingType: trainingType,", "trainingType: trainingType || '',")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Rewrite complete')
