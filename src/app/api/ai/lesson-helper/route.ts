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
            "당신은 골프 아카데미 레슨 기록 도우미입니다. " +
            "인사말('안녕하세요...'), 제목('[SHOT] 레슨 파트 노트' 등), 구분선('---'), 추천 연습 방법, 코치 피드백, 마무리 멘트는 절대 작성하지 마세요. " +
            "마크다운 기호(#, **)도 사용하지 말고, 오직 요청된 핵심 항목만 깔끔하고 간결한 한국어로 작성하세요.";

        let prompt = "";

        if (mode === "summarize") {
            prompt = `다음 레슨 내용을 핵심만 2~3줄로 아주 간결하게 요약해 주세요. (인사말, 제목, 마무리 멘트 금지)

[작성 형식]
• 현재 상태: (1줄 요약)
• 교정 포인트: (1~2줄 요약)

[원본 내용]
${content.trim()}`;
        } else {
            prompt = `다음 코치 메모를 바탕으로, 인사말과 서론 없이 오직 아래 1번과 2번 항목만 간결하고 전문적으로 정리해 주세요.
(추천 연습 방법, 코치 피드백, 인사말, 마무리 멘트는 절대 넣지 마세요.)

1. 현재 상태 및 원인
- 메모 내용을 바탕으로 핵심 원인을 2~3줄로 간추려 설명

2. 핵심 교정 포인트
- 집중해야 할 핵심 동작과 감각을 2~3줄로 명확하게 정리

[코치 메모]
${content.trim()}`;
        }

        const { text, modelUsed } = await generateWithGeminiFallback(
            prompt,
            systemInstruction,
            { fast: true, timeoutMs: 5000 }
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
