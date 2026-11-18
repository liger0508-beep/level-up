export type ConsultationMainPart = "initial" | "parent" | "regular" | "general";

export type ConsultationCategory =
    | "initial"
    | "parent_first"
    | "parent_1st"
    | "parent_2nd"
    | "regular"
    | "general";

export interface ConsultationQuestion {
    id: string;
    number?: number;
    question: string;
    placeholder?: string;
    rows?: number;
}

export interface ConsultationSection {
    id: string;
    title: string;
    subtitle?: string;
    questions: ConsultationQuestion[];
}

export interface ConsultationTemplate {
    category: ConsultationCategory;
    mainPart: ConsultationMainPart;
    title: string;
    shortLabel: string;
    description: string;
    sections: ConsultationSection[];
}

export interface ConsultationStructuredData {
    version: 1;
    category: ConsultationCategory;
    targetMonth?: string; // YYYY-MM
    answers: Record<string, string>;
    generalNote?: string;
    submittedByUserId?: string;
}

export const CONSULTATION_CATEGORY_LABELS: Record<ConsultationCategory, string> = {
    initial: "초기 상담",
    parent_first: "학부모 첫 상담",
    parent_1st: "학부모 1차",
    parent_2nd: "학부모 2차",
    regular: "정기 상담",
    general: "일반 상담",
};

export const CONSULTATION_CATEGORY_COLORS: Record<
    ConsultationCategory,
    { bg: string; text: string; border: string; accentBorder: string }
> = {
    initial: {
        bg: "bg-sky-50 dark:bg-sky-950/40",
        text: "text-sky-700 dark:text-sky-300",
        border: "border-sky-200 dark:border-sky-800",
        accentBorder: "border-l-sky-500",
    },
    parent_first: {
        bg: "bg-amber-50 dark:bg-amber-950/40",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800",
        accentBorder: "border-l-amber-500",
    },
    parent_1st: {
        bg: "bg-orange-50 dark:bg-orange-950/40",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-800",
        accentBorder: "border-l-orange-500",
    },
    parent_2nd: {
        bg: "bg-rose-50 dark:bg-rose-950/40",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-800",
        accentBorder: "border-l-rose-500",
    },
    regular: {
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-800",
        accentBorder: "border-l-emerald-500",
    },
    general: {
        bg: "bg-zinc-100 dark:bg-zinc-800",
        text: "text-zinc-700 dark:text-zinc-300",
        border: "border-zinc-200 dark:border-zinc-700",
        accentBorder: "border-l-zinc-400",
    },
};

export const CONSULTATION_TEMPLATES: Record<
    Exclude<ConsultationCategory, "general">,
    ConsultationTemplate
> = {
    initial: {
        category: "initial",
        mainPart: "initial",
        title: "초기 선수 파악 및 상담표",
        shortLabel: "초기 상담",
        description: "신규·초기 선수의 구력, 목표, 기술, 경기력, 훈련 습관 파악",
        sections: [
            {
                id: "init_sec_1",
                title: "1. 선수 기본 정보 및 성장 과정",
                questions: [
                    {
                        id: "init_q1",
                        number: 1,
                        question: "나이 / 골프 시작 나이 / 골프 구력은?",
                        placeholder: "예: 15세 / 초4(11세) 시작 / 구력 4년",
                        rows: 2,
                    },
                    {
                        id: "init_q2",
                        number: 2,
                        question: "지금까지 가장 좋은 연습라운드 및 시합 성적은? (대회명, 연도 포함)",
                        placeholder: "예: 2025년 OO배 71타(-1) / 연습라운드 베스트 68타",
                    },
                    {
                        id: "init_q3",
                        number: 3,
                        question: "지금까지 어떤 지도자에게 얼마나 지도를 받았으며, 골프 실력이 가장 많이 성장했던 시기는 언제인가?",
                    },
                ],
            },
            {
                id: "init_sec_2",
                title: "2. 목표 설정 및 동기",
                questions: [
                    {
                        id: "init_q4",
                        number: 4,
                        question: "골프선수로서 최종 목표와 1년 안에 반드시 이루고 싶은 목표는 무엇인가?",
                    },
                    {
                        id: "init_q5",
                        number: 5,
                        question: "현재 가장 이루고 싶은 성적이나 기록은 무엇이며, 목표 달성을 위해 가장 부족하다고 생각하는 부분은 무엇인가?",
                    },
                ],
            },
            {
                id: "init_sec_3",
                title: "3. 기술적인 부분 및 경기력 파악",
                questions: [
                    {
                        id: "init_q6",
                        number: 6,
                        question: "본인이 생각하는 가장 큰 기술적 장점과 현재 가장 개선하고 싶은 부분은 무엇인가?",
                    },
                    {
                        id: "init_q7",
                        number: 7,
                        question: "드라이버, 아이언, 숏게임, 퍼팅 중 가장 자신 있는 부분과 부족한 부분은 무엇인가?",
                    },
                    {
                        id: "init_q8",
                        number: 8,
                        question: "시합에서 가장 자주 발생하는 실수와 반복적으로 타수를 잃는 상황은 무엇인가?",
                    },
                ],
            },
            {
                id: "init_sec_4",
                title: "4. 경기력 및 스코어 분석",
                questions: [
                    {
                        id: "init_q9",
                        number: 9,
                        question: "좋은 스코어를 기록했을 때와 나쁜 스코어를 기록했을 때 가장 큰 차이는 무엇이라고 생각하는가?",
                    },
                    {
                        id: "init_q10",
                        number: 10,
                        question: "연습라운드와 시합에서 경기력 차이가 발생하는 가장 큰 이유는 무엇인가?",
                    },
                ],
            },
            {
                id: "init_sec_5",
                title: "5. 훈련 습관 및 자기관리",
                questions: [
                    {
                        id: "init_q11",
                        number: 11,
                        question: "현재 일주일 평균 훈련 시간과 주요 훈련 내용은 무엇이며, 훈련일지와 홀별 스코어를 기록하고 있는가?",
                    },
                ],
            },
            {
                id: "init_sec_6",
                title: "6. 코치와의 관계 및 지도 방향",
                questions: [
                    {
                        id: "init_q12",
                        number: 12,
                        question: "이전 레슨에서 가장 도움이 되었던 부분은 무엇이며, 앞으로 코치에게 가장 도움받고 싶은 부분은 무엇인가?",
                    },
                ],
            },
        ],
    },

    parent_first: {
        category: "parent_first",
        mainPart: "parent",
        title: "신규 선수 학부모 첫 상담표",
        shortLabel: "학부모 첫 상담",
        description: "신규 선수의 성장 배경, 학부모 기대 목표, 가정 환경 및 소통 방식 파악",
        sections: [
            {
                id: "pf_sec_1",
                title: "1. 선수의 성장 배경과 성격",
                questions: [
                    {
                        id: "pf_q1",
                        number: 1,
                        question: "아이가 골프를 시작하게 된 계기는 무엇인가요?",
                    },
                    {
                        id: "pf_q2",
                        number: 2,
                        question: "평소 아이의 성격은 어떤 편이며, 실패하거나 원하는 결과를 얻지 못했을 때 어떤 반응을 보이나요?",
                    },
                    {
                        id: "pf_q3",
                        number: 3,
                        question: "아이가 스스로 목표를 세우고 노력하는 편인가요? 아니면 부모님의 관리와 동기부여가 필요한 편인가요?",
                    },
                ],
            },
            {
                id: "pf_sec_2",
                title: "2. 골프에 대한 목표와 기대",
                questions: [
                    {
                        id: "pf_q4",
                        number: 4,
                        question: "부모님이 생각하는 아이의 장기적인 골프 목표는 무엇인가요?",
                    },
                    {
                        id: "pf_q5",
                        number: 5,
                        question: "현재 아이가 골프에 얼마나 흥미와 열정을 가지고 있다고 생각하시나요?",
                    },
                    {
                        id: "pf_q6",
                        number: 6,
                        question: "1년 뒤 아이가 어떤 모습으로 성장해 있기를 바라시나요?",
                    },
                ],
            },
            {
                id: "pf_sec_3",
                title: "3. 가정에서의 생활과 훈련 환경",
                questions: [
                    {
                        id: "pf_q7",
                        number: 7,
                        question: "아이의 평소 수면, 식사 및 체력 관리 습관은 어떤가요?",
                    },
                    {
                        id: "pf_q8",
                        number: 8,
                        question: "골프 외에 아이가 즐기는 취미나 활동이 있나요?",
                    },
                    {
                        id: "pf_q9",
                        number: 9,
                        question: "아이가 스스로 훈련 계획을 세우고 실천하는 편인가요? 가정에서는 훈련과 생활을 어떻게 관리하고 있나요?",
                    },
                ],
            },
            {
                id: "pf_sec_4",
                title: "4. 부모와 선수의 소통 방식",
                questions: [
                    {
                        id: "pf_q10",
                        number: 10,
                        question: "시합이 끝난 후 아이와 주로 어떤 이야기를 나누며, 성적이 좋지 않았을 때는 어떻게 대화하시나요?",
                    },
                    {
                        id: "pf_q11",
                        number: 11,
                        question: "아이가 골프에 대한 고민이나 어려움을 부모님께 자주 이야기하나요?",
                    },
                ],
            },
            {
                id: "pf_sec_5",
                title: "5. 코치에게 기대하는 부분",
                questions: [
                    {
                        id: "pf_q12",
                        number: 12,
                        question: "새로운 코치에게 가장 기대하는 부분은 무엇이며, 아이의 성장을 위해 특별히 신경 써주었으면 하는 부분은 무엇인가요?",
                    },
                ],
            },
        ],
    },

    parent_1st: {
        category: "parent_1st",
        mainPart: "parent",
        title: "학부모 1차 상담 (월 초 — 현재 상태 공유와 의견 수렴)",
        shortLabel: "학부모 1차",
        description: "월 초 진행: 최근 경기력·훈련 전달, 생활·심리 확인, 학부모 걱정·요청사항 수렴",
        sections: [
            {
                id: "p1_sec_1",
                title: "월 초 — 현재 상태 공유와 의견 수렴",
                questions: [
                    {
                        id: "p1_q1",
                        number: 1,
                        question: "최근 경기력과 훈련 진행 상황 전달",
                        placeholder: "최근 레슨/훈련 참여도, 기술적 진척, 시합/라운드 내용을 정리하세요.",
                        rows: 3,
                    },
                    {
                        id: "p1_q2",
                        number: 2,
                        question: "선수의 생활 및 심리 상태 확인",
                        placeholder: "가정에서의 컨디션, 수면/식사, 스트레스 및 골프 흥미도 확인 내용",
                        rows: 3,
                    },
                    {
                        id: "p1_q3",
                        number: 3,
                        question: "학부모의 걱정과 요청사항 수렴",
                        placeholder: "학부모님이 우려하는 점이나 코치에게 요청한 사항 (다음 2차 상담 시 자동 참조됩니다)",
                        rows: 3,
                    },
                ],
            },
        ],
    },

    parent_2nd: {
        category: "parent_2nd",
        mainPart: "parent",
        title: "학부모 2차 상담 (월 중·말 — 변화 확인과 다음 계획 공유)",
        shortLabel: "학부모 2차",
        description: "월 중·말 진행: 지난 1차 의견 반영 결과, 경기력 변화 확인, 다음 달 계획 공유",
        sections: [
            {
                id: "p2_sec_1",
                title: "월 중·말 — 변화 확인과 다음 계획 공유",
                questions: [
                    {
                        id: "p2_q1",
                        number: 1,
                        question: "지난 상담에서 나온 의견의 반영 결과 전달",
                        placeholder: "1차 상담 시 학부모 요청사항에 대한 지도 적용 및 경과를 정리하세요.",
                        rows: 3,
                    },
                    {
                        id: "p2_q2",
                        number: 2,
                        question: "선수의 경기력과 훈련 변화 확인",
                        placeholder: "한 달간 개선된 부분, 훈련 태도, 스코어/데이터 변화 확인 내용",
                        rows: 3,
                    },
                    {
                        id: "p2_q3",
                        number: 3,
                        question: "다음 달 레슨 및 훈련 방향 공유",
                        placeholder: "다음 달 중점 과제, 목표, 가정에서 협조가 필요한 부분",
                        rows: 3,
                    },
                ],
            },
        ],
    },

    regular: {
        category: "regular",
        mainPart: "regular",
        title: "지속 레슨 선수 상담표",
        shortLabel: "정기 상담",
        description: "지속 레슨 선수의 경기력 변화, 레슨 효과, 시합 운영, 훈련 실행력 점검",
        sections: [
            {
                id: "reg_sec_1",
                title: "1. 현재 경기력과 변화 확인",
                questions: [
                    {
                        id: "reg_q1",
                        number: 1,
                        question: "지난 상담 이후 본인의 경기력에서 가장 좋아졌다고 생각하는 부분은 무엇인가?",
                    },
                    {
                        id: "reg_q2",
                        number: 2,
                        question: "반대로 아직 해결되지 않았거나 반복적으로 발생하는 문제는 무엇인가?",
                    },
                    {
                        id: "reg_q3",
                        number: 3,
                        question: "최근 레슨과 훈련에서 연습한 내용이 실제 코스나 시합에서 얼마나 나타나고 있는가?",
                    },
                ],
            },
            {
                id: "reg_sec_2",
                title: "2. 기술과 레슨 효과 확인",
                questions: [
                    {
                        id: "reg_q4",
                        number: 4,
                        question: "지금까지 레슨을 통해 가장 크게 개선된 기술은 무엇이며, 아직 자신이 없거나 이해가 부족한 부분은 무엇인가?",
                    },
                    {
                        id: "reg_q5",
                        number: 5,
                        question: "연습장에서는 잘되지만 실제 시합에서는 잘되지 않는 기술이나 상황이 있는가?",
                    },
                ],
            },
            {
                id: "reg_sec_3",
                title: "3. 시합과 코스매니지먼트 분석",
                questions: [
                    {
                        id: "reg_q6",
                        number: 6,
                        question: "최근 시합이나 연습라운드에서 가장 많은 타수를 잃은 상황은 무엇이었는가?",
                    },
                    {
                        id: "reg_q7",
                        number: 7,
                        question: "티샷, 세컨드 샷, 숏게임, 퍼팅 중 가장 개선이 필요한 부분은 무엇인가?",
                    },
                    {
                        id: "reg_q8",
                        number: 8,
                        question: "시합에서 본인이 원하는 플레이와 실제 선택하는 플레이 사이에 차이가 있는가? 있다면 그 이유는 무엇인가?",
                    },
                ],
            },
            {
                id: "reg_sec_4",
                title: "4. 훈련 습관과 실행력",
                questions: [
                    {
                        id: "reg_q9",
                        number: 9,
                        question: "현재 가장 많은 시간을 투자하는 훈련은 무엇이며, 실제 훈련량은 계획한 만큼 이루어지고 있는가?",
                    },
                    {
                        id: "reg_q10",
                        number: 10,
                        question: "훈련할 때 구체적인 목표와 성공 기준을 가지고 연습하는가?",
                    },
                ],
            },
            {
                id: "reg_sec_5",
                title: "5. 심리와 경기 운영",
                questions: [
                    {
                        id: "reg_q11",
                        number: 11,
                        question: "시합 중 자신감이 떨어지거나 실수 이후 다음 샷에 영향을 받는 상황은 언제인가?",
                    },
                ],
            },
            {
                id: "reg_sec_6",
                title: "6. 앞으로의 목표와 훈련 방향",
                questions: [
                    {
                        id: "reg_q12",
                        number: 12,
                        question: "다음 시합까지 가장 집중해서 개선하고 싶은 부분과 반드시 달라지고 싶은 경기 내용은 무엇인가?",
                    },
                ],
            },
        ],
    },
};

const DATA_MARKER_PREFIX = "<!--GLA_CONSULTATION_DATA:";
const DATA_MARKER_SUFFIX = "-->";

function toBase64Utf8(str: string): string {
    if (typeof window !== "undefined") {
        const bytes = new TextEncoder().encode(str);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    return Buffer.from(str, "utf-8").toString("base64");
}

function fromBase64Utf8(b64: string): string {
    if (typeof window !== "undefined") {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }
    return Buffer.from(b64, "base64").toString("utf-8");
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
}

/**
 * Generates readable HTML for backward-compatible search/preview and appends
 * base64-encoded structured JSON inside an HTML comment for future AI API usage.
 */
export function encodeConsultationContent(
    structured: ConsultationStructuredData,
    generalContent?: string
): string {
    let readableHtml = "";

    if (structured.category === "general") {
        readableHtml = generalContent || structured.generalNote || "";
    } else {
        const template = CONSULTATION_TEMPLATES[structured.category];
        const parts: string[] = [];

        if (template) {
            for (const sec of template.sections) {
                const answeredInSec = sec.questions.filter((q) =>
                    structured.answers[q.id]?.trim()
                );
                if (answeredInSec.length === 0) continue;

                parts.push(`<h3>${escapeHtml(sec.title)}</h3>`);
                for (const q of answeredInSec) {
                    const ans = structured.answers[q.id].trim();
                    const qLabel = q.number ? `${q.number}. ${q.question}` : q.question;
                    parts.push(
                        `<p><strong>${escapeHtml(qLabel)}</strong><br/>${escapeHtml(ans)}</p>`
                    );
                }
            }
        }

        if (structured.generalNote?.trim()) {
            parts.push(
                `<h3>추가 메모</h3><p>${escapeHtml(structured.generalNote.trim())}</p>`
            );
        }

        readableHtml = parts.join("\n") || "<p>작성된 답변이 없습니다.</p>";
    }

    const encoded = toBase64Utf8(JSON.stringify(structured));
    return `${readableHtml}\n${DATA_MARKER_PREFIX}${encoded}${DATA_MARKER_SUFFIX}`;
}

export function parseConsultationData(rawContent: string): {
    structured: ConsultationStructuredData | null;
    displayHtml: string;
} {
    if (!rawContent) {
        return { structured: null, displayHtml: "" };
    }

    const startIdx = rawContent.indexOf(DATA_MARKER_PREFIX);
    if (startIdx === -1) {
        return { structured: null, displayHtml: rawContent };
    }

    const endIdx = rawContent.indexOf(DATA_MARKER_SUFFIX, startIdx + DATA_MARKER_PREFIX.length);
    if (endIdx === -1) {
        return { structured: null, displayHtml: rawContent };
    }

    const b64 = rawContent.slice(startIdx + DATA_MARKER_PREFIX.length, endIdx).trim();
    const displayHtml = (
        rawContent.slice(0, startIdx) + rawContent.slice(endIdx + DATA_MARKER_SUFFIX.length)
    ).trim();

    try {
        const jsonStr = fromBase64Utf8(b64);
        const parsed = JSON.parse(jsonStr) as ConsultationStructuredData;
        return { structured: parsed, displayHtml };
    } catch {
        return { structured: null, displayHtml };
    }
}

export function getMainPartFromCategory(category: ConsultationCategory): ConsultationMainPart {
    if (category === "initial") return "initial";
    if (category === "regular") return "regular";
    if (category === "general") return "general";
    return "parent";
}

