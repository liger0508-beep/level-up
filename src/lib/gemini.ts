const DEFAULT_FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
] as const;

const FAST_FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
] as const;

export interface GeminiResult {
    text: string;
    modelUsed: string;
}

/**
 * Call Google Gemini API with automatic 3-tier model fallback and strict timeout
 * so a slow/stalled model never hangs for over a minute.
 */
export async function generateWithGeminiFallback(
    prompt: string,
    systemInstruction?: string,
    options?: { fast?: boolean; timeoutMs?: number }
): Promise<GeminiResult> {
    const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY가 설정되어 있지 않습니다.");
    }

    const models = options?.fast ? FAST_FALLBACK_MODELS : DEFAULT_FALLBACK_MODELS;
    const timeoutMs = options?.timeoutMs ?? 6000;
    let lastError = "";

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const payload: Record<string, any> = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                },
            };

            if (systemInstruction) {
                payload.systemInstruction = {
                    parts: [{ text: systemInstruction }],
                };
            }

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store",
                signal: AbortSignal.timeout(timeoutMs),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                lastError = `[${model}] HTTP ${res.status}: ${errData?.error?.message || res.statusText}`;
                console.warn(`Gemini fallback triggered:`, lastError);
                continue;
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!text) {
                lastError = `[${model}] Empty response`;
                console.warn(`Gemini fallback triggered:`, lastError);
                continue;
            }

            return { text, modelUsed: model };
        } catch (err: any) {
            lastError = `[${model}] ${err?.message || "Timeout/Network error"}`;
            console.warn(`Gemini fallback triggered:`, lastError);
        }
    }

    throw new Error(`모든 Gemini 모델 호출에 실패했습니다. (${lastError})`);
}
