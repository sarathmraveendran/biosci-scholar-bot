import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatCompletion, embedTexts, parseJsonObject } from "./ai.server";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  heading: string | null;
  subheading: string | null;
  content: string;
  chapter: string;
  filename: string;
  sourceUrl: string;
  chapterNumber: string | null;
  similarity: number;
  keywordRank: number;
  score: number;
};

type MatchRow = {
  id: string;
  document_id: string;
  heading: string | null;
  subheading: string | null;
  content: string;
  chunk_order: number;
  title: string;
  filename: string;
  source_url: string;
  chapter_number: string | null;
  similarity: number;
  keyword_rank: number;
  score: number;
};

export async function retrieve(query: string, matchCount = 8): Promise<RetrievedChunk[]> {
  const [embedding] = await embedTexts([query]);
  if (!embedding) return [];

  const { data, error } = await supabaseAdmin.rpc("match_chunks", {
    query_embedding: JSON.stringify(embedding) as unknown as string,
    query_text: query,
    match_count: matchCount,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);

  return ((data ?? []) as MatchRow[]).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    heading: row.heading,
    subheading: row.subheading,
    content: row.content,
    chapter: row.title,
    filename: row.filename,
    sourceUrl: row.source_url,
    chapterNumber: row.chapter_number,
    similarity: Number(row.similarity ?? 0),
    keywordRank: Number(row.keyword_rank ?? 0),
    score: Number(row.score ?? 0),
  }));
}

/** Rewrite a conversational follow-up into a standalone retrieval query. */
export async function buildStandaloneQuery(
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  if (history.length === 0) return question;
  const transcript = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 700)}`)
    .join("\n");

  try {
    const rewritten = await chatCompletion([
      {
        role: "system",
        content:
          "Rewrite the user's latest message into a single standalone search query about the book 'How to write a PhD in Biological Sciences'. Resolve pronouns and references using the conversation. Reply with the query only, no quotes, no explanation.",
      },
      { role: "user", content: `Conversation:\n${transcript}\n\nLatest message: ${question}` },
    ]);
    const cleaned = rewritten.trim().split("\n")[0]?.trim();
    return cleaned && cleaned.length > 3 ? cleaned.slice(0, 400) : question;
  } catch {
    return question;
  }
}

export type Evidence = "strong" | "partial" | "insufficient";

export type GroundedAnswer = {
  answer: string;
  evidence: Evidence;
  usedChunkIds: string[];
  additionalContext: string | null;
  standaloneQuery: string;
  retrieved: RetrievedChunk[];
};

const SYSTEM_PROMPT = `You are the PhD Book Assistant for John Measey's "How to write a PhD in Biological Sciences".

Your primary responsibility is source fidelity.

- Answer the user's question using ONLY the provided book context when operating in Book Only mode.
- Do not use your pretrained knowledge to fill gaps.
- Every factual claim attributed to the book must be supported by the retrieved context.
- If the context contains the answer, explain it clearly and accurately.
- If the context only partially answers the question, explicitly state which part is supported and which part cannot be established from the book.
- If the context does not contain sufficient evidence, say you could not find enough information in the book.
- Never invent quotes, chapter titles, filenames, citations, or recommendations.
- Prefer paraphrasing unless the user explicitly requests a quotation. Keep quotations short and accurate.
- Always preserve distinctions made by the author; never turn nuanced statements into absolute rules.
- If the book specifies a number of items (e.g. three things), preserve all of them.
- When several retrieved passages are relevant, synthesise them while retaining their original meaning.

Return ONLY a JSON object with this exact shape:
{
  "answer": "markdown answer based strictly on the book context",
  "evidence": "strong" | "partial" | "insufficient",
  "used_passages": [1, 3],
  "additional_context": null
}

"used_passages" lists the numbers of the passages you actually used. If evidence is insufficient, say so in "answer" and leave "used_passages" empty.
"additional_context" must be null in Book Only mode. In Book + explanation mode it may contain general academic-writing context clearly separate from the book, never attributed to the author.`;

export async function answerQuestion(params: {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  mode: "book" | "book_plus";
  matchCount?: number;
}): Promise<GroundedAnswer> {
  const standaloneQuery = await buildStandaloneQuery(params.question, params.history);
  const retrieved = await retrieve(standaloneQuery, params.matchCount ?? 8);

  if (retrieved.length === 0) {
    return {
      answer:
        "I couldn't find enough information in the book to answer this reliably. The book index may still be empty — an administrator can import the book from GitHub on the admin page.",
      evidence: "insufficient",
      usedChunkIds: [],
      additionalContext: null,
      standaloneQuery,
      retrieved,
    };
  }

  const context = retrieved
    .map(
      (c, i) =>
        `[Passage ${i + 1}]\nChapter: ${c.chapter}${c.heading ? ` > ${c.heading}` : ""}${
          c.subheading ? ` > ${c.subheading}` : ""
        }\nFile: ${c.filename}\n---\n${c.content}`,
    )
    .join("\n\n");

  const modeLine =
    params.mode === "book_plus"
      ? 'Mode: Book + explanation. You may add clearly separated general context in "additional_context".'
      : 'Mode: Book only. "additional_context" must be null.';

  const historyLines = params.history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 700)}`)
    .join("\n");

  const raw = await chatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${modeLine}

${historyLines ? `Conversation so far:\n${historyLines}\n\n` : ""}Question: ${params.question}
Retrieval query used: ${standaloneQuery}

Book context:
${context}`,
    },
  ]);

  const parsed = parseJsonObject<{
    answer?: string;
    evidence?: string;
    used_passages?: number[];
    additional_context?: string | null;
  }>(raw);

  const answer = parsed?.answer?.trim() || raw.trim();
  const usedIdx = Array.isArray(parsed?.used_passages) ? parsed!.used_passages! : [];
  const usedChunkIds = usedIdx
    .map((n) => retrieved[Number(n) - 1]?.id)
    .filter((id): id is string => Boolean(id));

  let evidence: Evidence =
    parsed?.evidence === "strong" || parsed?.evidence === "partial" || parsed?.evidence === "insufficient"
      ? parsed.evidence
      : "partial";

  // Groundedness is decided primarily by retrieval quality, not model confidence.
  const best = retrieved[0]?.similarity ?? 0;
  if (usedChunkIds.length === 0 || best < 0.25) evidence = "insufficient";
  else if (evidence === "strong" && (best < 0.42 || usedChunkIds.length === 0)) evidence = "partial";

  return {
    answer,
    evidence,
    usedChunkIds,
    additionalContext:
      params.mode === "book_plus" && parsed?.additional_context ? parsed.additional_context : null,
    standaloneQuery,
    retrieved,
  };
}
