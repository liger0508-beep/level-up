import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TRANSCRIBE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
] as const;

export async function POST(request: Request) {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof Blob) || audioFile.size === 0) {
      return NextResponse.json(
        { error: "녹음된 음성 파일이 없습니다." },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = audioFile.type || "audio/webm";

    let lastError = "";

    for (const model of TRANSCRIBE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "이 한국어 음성을 들리는 그대로 자연스러운 한국어 텍스트로 받아적어 주세요. 설명이나 따옴표 없이 받아적은 텍스트만 출력하세요. 골프 레슨/분석 용어가 나올 수 있습니다.",
                  },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Audio,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        });

        clearTimeout(timer);

        if (!res.ok) {
          lastError = await res.text();
          continue;
        }

        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (text) {
          return NextResponse.json({ text });
        }
      } catch (err: any) {
        lastError = err?.message || "음성 변환 실패";
      }
    }

    return NextResponse.json(
      { error: lastError || "음성을 텍스트로 변환하지 못했습니다." },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("Transcribe API error:", error);
    return NextResponse.json(
      { error: error?.message || "음성 변환 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
