import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const HistorySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
  .default([]);

const AskSchema = z.object({
  question: z.string().min(2),
  history: HistorySchema,
  mode: z.enum(["book", "book_plus"]).default("book"),
});

export const askQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    const { answerQuestion } = await import("./rag.server");
    const result = await answerQuestion({
      question: data.question,
      history: data.history,
      mode: data.mode,
    });

    const used = new Set(result.usedChunkIds);
    const sources = result.retrieved
      .filter((c) => used.has(c.id))
      .map((c) => ({
        id: c.id,
        chapter: c.chapter,
        heading: c.heading,
        subheading: c.subheading,
        filename: c.filename,
        sourceUrl: c.sourceUrl,
        passage: c.content,
        similarity: Number(c.similarity.toFixed(3)),
      }));

    return {
      answer: result.answer,
      evidence: result.evidence,
      additionalContext: result.additionalContext,
      standaloneQuery: result.standaloneQuery,
      sources,
      nearest: sources.length
        ? []
        : result.retrieved.slice(0, 3).map((c) => ({
            id: c.id,
            chapter: c.chapter,
            heading: c.heading,
            filename: c.filename,
            sourceUrl: c.sourceUrl,
          })),
    };
  });

export const searchBook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(2) }).parse(input))
  .handler(async ({ data }) => {
    const { retrieve } = await import("./rag.server");
    const rows = await retrieve(data.query, 15);
    return rows.map((c) => ({
      id: c.id,
      chapter: c.chapter,
      heading: c.heading,
      subheading: c.subheading,
      filename: c.filename,
      sourceUrl: c.sourceUrl,
      preview: c.content.slice(0, 420),
      similarity: Number(c.similarity.toFixed(3)),
    }));
  });

export const getIndexStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count: docs }, { count: chunks }, runs] = await Promise.all([
    supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("chunks").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("ingestion_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);
  return {
    documents: docs ?? 0,
    chunks: chunks ?? 0,
    lastRun: runs.data?.[0] ?? null,
  };
});

/* ------------------------------- admin ---------------------------------- */

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getAdminState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: mine }, { count: admins }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    ]);
    return { isAdmin: Boolean(mine), adminExists: (admins ?? 0) > 0 };
  });

/** The first signed-in user can claim the admin role; afterwards it is closed. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists for this app.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { isAdmin: true };
  });

const IngestSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(6).default(3),
  reset: z.boolean().default(false),
  runId: z.string().uuid().nullable().default(null),
});

export const ingestBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IngestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedTexts } = await import("./ai.server");
    const ingest = await import("./ingest.server");

    const files = await ingest.listRepoFiles();

    let runId = data.runId;
    if (data.offset === 0) {
      if (data.reset) await supabaseAdmin.from("documents").delete().neq("id", crypto.randomUUID());
      const { data: run, error } = await supabaseAdmin
        .from("ingestion_runs")
        .insert({ status: "running" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      runId = run.id;
    }

    const slice = files.slice(data.offset, data.offset + data.limit);
    let chunksIndexed = 0;

    for (const file of slice) {
      const raw = await ingest.fetchFileContent(file.path);
      const cleaned = ingest.cleanMarkdown(raw);
      if (cleaned.length < 200) continue;

      const filename = file.path.split("/").pop() ?? file.path;
      const { data: doc, error: docError } = await supabaseAdmin
        .from("documents")
        .upsert(
          {
            title: ingest.documentTitle(cleaned, file.path),
            filename,
            path: file.path,
            source_url: ingest.sourceUrlFor(file.path),
            chapter_number: ingest.chapterNumberFor(file.path),
            content: cleaned,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "filename" },
        )
        .select("id")
        .single();
      if (docError) throw new Error(docError.message);

      await supabaseAdmin.from("chunks").delete().eq("document_id", doc.id);

      const parsed = ingest.chunkDocument(cleaned);
      for (let i = 0; i < parsed.length; i += 48) {
        const batch = parsed.slice(i, i + 48);
        const vectors = await embedTexts(
          batch.map(
            (c) => `${c.heading ?? ""} ${c.subheading ?? ""}\n${c.content}`.trim().slice(0, 6000),
          ),
        );
        const rows = batch.map((c, j) => ({
          document_id: doc.id,
          heading: c.heading,
          subheading: c.subheading,
          content: c.content,
          chunk_order: c.chunkOrder,
          token_count: c.tokenCount,
          embedding: JSON.stringify(vectors[j]) as unknown as string,
        }));
        const { error: chunkError } = await supabaseAdmin.from("chunks").insert(rows);
        if (chunkError) throw new Error(chunkError.message);
        chunksIndexed += rows.length;
      }
    }

    const nextOffset = data.offset + slice.length;
    const done = nextOffset >= files.length;

    if (runId) {
      const { count } = await supabaseAdmin
        .from("chunks")
        .select("id", { count: "exact", head: true });
      await supabaseAdmin
        .from("ingestion_runs")
        .update({
          status: done ? "completed" : "running",
          files_indexed: nextOffset,
          chunks_indexed: count ?? 0,
          finished_at: done ? new Date().toISOString() : null,
        })
        .eq("id", runId);
    }

    return {
      runId,
      totalFiles: files.length,
      processed: nextOffset,
      chunksIndexed,
      done,
      files: slice.map((f) => f.path),
    };
  });

export const debugRetrieval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(2), matchCount: z.number().int().min(1).max(20).default(8) }).parse(
      input,
    ),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { retrieve, buildStandaloneQuery } = await import("./rag.server");
    const standalone = await buildStandaloneQuery(data.query, []);
    const rows = await retrieve(standalone, data.matchCount);
    return {
      standaloneQuery: standalone,
      results: rows.map((c) => ({
        id: c.id,
        chapter: c.chapter,
        heading: c.heading,
        subheading: c.subheading,
        filename: c.filename,
        sourceUrl: c.sourceUrl,
        similarity: Number(c.similarity.toFixed(4)),
        keywordRank: Number(c.keywordRank.toFixed(4)),
        score: Number(c.score.toFixed(5)),
        content: c.content,
      })),
    };
  });

export const runEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ questionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { answerQuestion } = await import("./rag.server");

    const { data: q, error } = await supabaseAdmin
      .from("evaluation_questions")
      .select("*")
      .eq("id", data.questionId)
      .single();
    if (error) throw new Error(error.message);

    const result = await answerQuestion({ question: q.question, history: [], mode: "book" });
    const used = new Set(result.usedChunkIds);
    const usedSources = result.retrieved.filter((c) => used.has(c.id));
    const retrievedFilenames = result.retrieved.map((c) => c.filename);

    const expected = q.expected_sources ?? [];
    const citationScore = expected.length
      ? expected.filter((f) => retrievedFilenames.some((r) => r.toLowerCase() === f.toLowerCase()))
          .length / expected.length
      : usedSources.length > 0
        ? 1
        : 0;
    const groundedness =
      result.evidence === "strong" ? 1 : result.evidence === "partial" ? 0.5 : 0;
    const passed = groundedness >= 0.5 && citationScore >= (expected.length ? 0.5 : 1);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("evaluation_results")
      .insert({
        question_id: q.id,
        generated_answer: result.answer,
        retrieved_sources: usedSources.map((c) => ({
          filename: c.filename,
          chapter: c.chapter,
          heading: c.heading,
          similarity: Number(c.similarity.toFixed(3)),
        })),
        groundedness_score: groundedness,
        citation_score: citationScore,
        passed,
      })
      .select("*")
      .single();
    if (insertError) throw new Error(insertError.message);
    return inserted;
  });

export const getChapters = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id,title,filename,chapter_number,source_url")
    .order("filename", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listEvaluationQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [questions, results] = await Promise.all([
      supabaseAdmin.from("evaluation_questions").select("*").order("created_at"),
      supabaseAdmin
        .from("evaluation_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return { questions: questions.data ?? [], results: results.data ?? [] };
  });
