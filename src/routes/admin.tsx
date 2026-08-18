import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, RefreshCw, Search } from "lucide-react";

import {
  debugRetrieval,
  getIndexStatus,
  ingestBatch,
  listEvaluationQuestions,
  runEvaluation,
} from "@/lib/rag.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — PhD Book Assistant" },
      {
        name: "description",
        content:
          "Manage book ingestion from GitHub, debug hybrid retrieval and run the grounding evaluation suite.",
      },
      { property: "og:title", content: "Admin — PhD Book Assistant" },
      {
        property: "og:description",
        content: "Ingestion, retrieval debugging and evaluation for the PhD Book Assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <Shell>
      <Tabs defaultValue="ingestion">
        <TabsList>
          <TabsTrigger value="ingestion">Ingestion</TabsTrigger>
          <TabsTrigger value="retrieval">Retrieval debug</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
        </TabsList>
        <TabsContent value="ingestion" className="mt-4">
          <IngestionPanel />
        </TabsContent>
        <TabsContent value="retrieval" className="mt-4">
          <RetrievalPanel />
        </TabsContent>
        <TabsContent value="evaluation" className="mt-4">
          <EvaluationPanel />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <BookOpen className="size-5 text-primary" />
          <h1 className="flex-1 font-serif text-lg font-semibold">Admin console</h1>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to chat</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

function IngestionPanel() {
  const ingest = useServerFn(ingestBatch);
  const status = useQuery({ queryKey: ["index-status"], queryFn: () => getIndexStatus() });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  async function run(reset: boolean) {
    setRunning(true);
    setLog([]);
    setProgress(null);
    try {
      let offset = 0;
      let runId: string | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await ingest({ data: { offset, limit: 3, reset: reset && offset === 0, runId } });
        runId = result.runId;
        offset = result.processed;
        setProgress({ processed: result.processed, total: result.totalFiles });
        setLog((prev) => [...prev, ...result.files.map((f) => `indexed ${f}`)]);
        if (result.done) break;
      }
      toast.success("Book indexed successfully.");
      await status.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ingestion failed");
    } finally {
      setRunning(false);
    }
  }

  const s = status.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Chapters", s?.documents ?? 0],
          ["Passages", s?.chunks ?? 0],
          ["Last run", s?.lastRun?.status ?? "never"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border bg-paper p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-paper p-4">
        <h2 className="font-serif text-lg font-semibold">Import from GitHub</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fetches every <code>.Rmd</code> / <code>.md</code> chapter from{" "}
          <a
            className="text-primary underline"
            href="https://github.com/johnmeasey/How-to-write-a-PhD-in-Biological-Sciences"
            target="_blank"
            rel="noreferrer"
          >
            johnmeasey/How-to-write-a-PhD-in-Biological-Sciences
          </a>
          , chunks it by structure and embeds each passage.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void run(false)} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Index / update book
          </Button>
          <Button variant="outline" onClick={() => void run(true)} disabled={running}>
            Full re-index (clears data)
          </Button>
        </div>
        {progress && (
          <div className="mt-4">
            <Progress value={(progress.processed / Math.max(progress.total, 1)) * 100} />
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.processed} / {progress.total} files
            </p>
          </div>
        )}
        {log.length > 0 && (
          <pre className="mt-3 max-h-52 overflow-auto rounded bg-muted p-3 font-mono text-xs">
            {log.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}

function RetrievalPanel() {
  const debug = useServerFn(debugRetrieval);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof debugRetrieval>> | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (query.trim().length < 2) return;
          setBusy(true);
          try {
            setData(await debug({ data: { query, matchCount: 10 } }));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Retrieval failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Test a retrieval query…"
        />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Search
        </Button>
      </form>

      {data && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Standalone query: <span className="font-mono">{data.standaloneQuery}</span>
          </p>
          {data.results.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-border bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif font-semibold">
                  {i + 1}. {r.chapter}
                  {r.heading ? ` › ${r.heading}` : ""}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  score {r.score} · vector {r.similarity} · keyword {r.keywordRank}
                </p>
              </div>
              <a
                href={r.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                {r.filename}
              </a>
              <p className="mt-2 max-h-40 overflow-auto font-serif text-sm whitespace-pre-wrap text-muted-foreground">
                {r.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvaluationPanel() {
  const evaluate = useServerFn(runEvaluation);
  const list = useQuery({ queryKey: ["evaluations"], queryFn: () => listEvaluationQuestions() });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const questions = list.data?.questions ?? [];
  const results = list.data?.results ?? [];
  const latest = (questionId: string) => results.find((r) => r.question_id === questionId);

  async function runOne(id: string) {
    setBusyId(id);
    try {
      await evaluate({ data: { questionId: id } });
      await list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Evaluation failed");
    } finally {
      setBusyId(null);
    }
  }

  const scored = questions.map((q) => latest(q.id)).filter(Boolean);
  const passRate = scored.length
    ? Math.round((scored.filter((r) => r!.passed).length / scored.length) * 100)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-paper p-4">
        <div className="flex-1">
          <h2 className="font-serif text-lg font-semibold">Grounding benchmark</h2>
          <p className="text-sm text-muted-foreground">
            {questions.length} benchmark questions ·{" "}
            {passRate === null ? "not run yet" : `${passRate}% passing`}
          </p>
        </div>
        <Button
          disabled={runningAll || questions.length === 0}
          onClick={async () => {
            setRunningAll(true);
            for (const q of questions) await runOne(q.id);
            setRunningAll(false);
          }}
        >
          {runningAll && <Loader2 className="size-4 animate-spin" />} Run all
        </Button>
      </div>

      {questions.map((q) => {
        const r = latest(q.id);
        return (
          <div key={q.id} className="rounded-lg border border-border bg-paper p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-serif font-semibold">{q.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expected sources: {q.expected_sources?.join(", ") || "—"}
                </p>
                {q.expected_answer && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expected: {q.expected_answer}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === q.id}
                onClick={() => void runOne(q.id)}
              >
                {busyId === q.id ? <Loader2 className="size-4 animate-spin" /> : "Run"}
              </Button>
            </div>
            {r && (
              <div className="mt-3 rounded-md border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-medium",
                      r.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {r.passed ? "passed" : "failed"}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    groundedness {r.groundedness_score} · citations {r.citation_score}
                  </span>
                </div>
                <p className="mt-2 font-serif text-sm whitespace-pre-wrap">{r.generated_answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
