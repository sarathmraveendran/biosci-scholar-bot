const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export function requireLovableApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const ANSWER_MODEL = "google/gemini-3.7-flash";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Embed one or more texts. Returns vectors in the same order as the inputs.
 *  Retries on rate limits / transient upstream errors with exponential backoff. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const key = requireLovableApiKey();

  const maxAttempts = 5;
  let lastError = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data: Array<{ index: number; embedding: number[] }>;
      };
      const out: number[][] = new Array(inputs.length);
      for (const row of json.data) out[row.index] = row.embedding;
      return out;
    }

    const body = await res.text();
    lastError = `Embedding request failed [${res.status}]: ${body}`;

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === maxAttempts - 1) throw new Error(lastError);

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(20000, 1500 * 2 ** attempt) + Math.random() * 500;
    await sleep(waitMs);
  }
  throw new Error(lastError);
}


export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Non-streaming chat completion against the Lovable AI Gateway. */
export async function chatCompletion(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number } = {},
): Promise<string> {
  const key = requireLovableApiKey();
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: options.model ?? ANSWER_MODEL,
      messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("The assistant is rate limited right now. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace. Please add credits to continue.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Extract a JSON object from a model response that may be fenced or prefixed. */
export function parseJsonObject<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
