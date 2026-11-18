import { NextResponse } from "next/server";
import { generateWithGeminiFallback } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { content, mode } = body as {
            content?: string;
            mode?: "summarize" | "expand";
        };

        if (!content || !content.trim()) {
            return NextResponse.json(
                { error: "먼저 레슨 내용을 간단히 입력해 주세요." },
                { status: 400 }
            );
        }

        const systemInstruction =
            "당신은 주니어 골프 선수들을 지도하는 코치의 레슨 노트를 다듬어주는 도우미입니다. " +
            "코치가 제자(선수)에게 직접 말하듯 자연스럽고 친근하면서도 핵심이 분명한 반말 코칭 어조('~하고 있어', '~해 보인다', '~하도록 하자', '~해보자')로 작성하세요. " +
            "'~습니다', '~합니다' 같은 딱딱한 보고서 말투는 절대 사용하지 마세요. " +
            "인사말('안녕하세요...'), 제목('[SHOT] 레슨 파트 노트' 등), 구분선('---'), 추천 연습 방법, 마무리 멘트, 마크다운 기호(#, **)는 절대 넣지 마세요.";

        let prompt = "";

        if (mode === "summarize") {
            prompt = `코치가 작성한 아래 레슨 메모의 원래 의미와 분량(길이)은 그대로 유지하면서, 코치가 선수에게 자연스럽게 말해주는 어조('~하고 있어', '~보인다', '~하도록 하자' 등)로 매끄럽게 다듬어 주세요.

[규칙]
- 새로운 내용, 조언, 연습 방법, 피드백을 임의로 덧붙이지 마세요.
- 원문의 핵심 내용을 과도하게 줄이거나 생략하지 마세요.
- '현재 상태', '교정 포인트' 같은 항목 제목이나 글머리 기호(•), 따옴표(""), 설명 멘트 없이 다듬은 본문 문장만 그대로 출력하세요.

[원본 메모]
${content.trim()}`;
        } else {
            prompt = `다음 코치 메모를 바탕으로, 인사말과 서론 없이 오직 아래 1번과 2번 항목만 코치가 선수에게 직접 말하듯 자연스러운 어조('~하고 있어', '~보인다', '~하도록 하자' 등)로 정리해 주세요.
('~습니다/~합니다' 같은 딱딱한 말투, 추천 연습 방법, 인사말, 마무리 멘트는 절대 넣지 마세요.)

1. 현재 상태 및 원인
- 메모 내용을 바탕으로 핵심 원인을 2~3줄로 자연스럽게 설명 (~하고 있어, ~해 보인다 등)

2. 핵심 교정 포인트
- 집중해야 할 핵심 동작과 감각을 2~3줄로 명확하게 정리 (~하도록 하자, ~해보자 등)

[코치 메모]
${content.trim()}`;
        }

        const { text, modelUsed } = await generateWithGeminiFallback(
            prompt,
            systemInstruction,
            { fast: true, timeoutMs: 8000 }
        );

        return NextResponse.json({ result: text, modelUsed });
    } catch (err: any) {
        console.error("AI lesson helper error:", err);
        return NextResponse.json(
            { error: err?.message || "AI 처리 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
