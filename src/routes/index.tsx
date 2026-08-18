import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, ExternalLink, Loader2, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { askQuestion, getChapters, getIndexStatus } from "@/lib/rag.functions";
import { SourceList, type Source } from "@/components/chat/SourceList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { useDisplayName } from "@/lib/user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhD Book Assistant — Grounded Q&A on writing a biology PhD" },
      {
        name: "description",
        content:
          "Ask questions about John Measey's 'How to write a PhD in Biological Sciences' and get answers grounded in the book, with citations to every source passage.",
      },
      { property: "og:title", content: "PhD Book Assistant — Grounded Q&A" },
      {
        property: "og:description",
        content:
          "Retrieval-augmented answers grounded in 'How to write a PhD in Biological Sciences', with citations to every source passage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type Mode = "book" | "book_plus";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: "strong" | "partial" | "insufficient";
  additionalContext?: string | null;
  sources?: Source[];
};

const STORAGE_KEY = "phd-book-assistant:conversation";

const EXAMPLES = [
  "How should I structure the introduction of a thesis chapter?",
  "What does the book say about choosing a supervisor?",
  "How do I decide the order of authors on a paper?",
  "What is the advice on responding to reviewer comments?",
  "How should I plan my writing time during a PhD?",
];

function loadConversation(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const EVIDENCE_LABEL: Record<string, { label: string; className: string }> = {
  strong: { label: "Well supported by the book", className: "bg-success/15 text-success" },
  partial: { label: "Partially supported", className: "bg-warning/20 text-warning-foreground" },
  insufficient: {
    label: "Not found in the book",
    className: "bg-destructive/15 text-destructive",
  },
};

function Home() {
  const ask = useServerFn(askQuestion);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("book");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { name: displayName } = useDisplayName();
  const chapters = useQuery({ queryKey: ["chapters"], queryFn: () => getChapters() });
  const status = useQuery({ queryKey: ["index-status"], queryFn: () => getIndexStatus() });

  useEffect(() => {
    setMessages(loadConversation());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [pending]);

  const empty = messages.length === 0;
  const indexEmpty = (status.data?.chunks ?? 0) === 0 && !status.isLoading;

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || pending) return;
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setPending(true);
      try {
        const result = await ask({ data: { question: text, history, mode } });
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.answer,
            evidence: result.evidence,
            additionalContext: result.additionalContext,
            sources: result.sources,
          },
        ]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        setInput(text);
      } finally {
        setPending(false);
      }
    },
    [ask, messages, mode, pending],
  );

  const chapterList = useMemo(() => chapters.data ?? [], [chapters.data]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <BookOpen className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg font-semibold">PhD Book Assistant</h1>
            <p className="truncate text-xs text-muted-foreground">
              Grounded Q&amp;A on <em>How to write a PhD in Biological Sciences</em> by John Measey
            </p>
          </div>
          <UserMenu />
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ShieldCheck className="size-4" /> Admin
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-4">
            <section className="rounded-lg border border-border bg-paper p-3">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Answer mode
              </h2>
              <div className="space-y-1">
                {(
                  [
                    ["book", "Book only", "Strictly from the book text"],
                    ["book_plus", "Book + explanation", "Adds clearly labelled context"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      mode === value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-paper p-3">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Chapters ({chapterList.length})
              </h2>
              <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                {chapterList.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    The book has not been indexed yet.
                  </p>
                )}
                {chapterList.map((c) => (
                  <div key={c.id} className="group rounded-md px-2 py-1.5 hover:bg-muted">
                    <button
                      type="button"
                      onClick={() => {
                        setInput(`What does the chapter "${c.title}" say about `);
                        inputRef.current?.focus();
                      }}
                      className="block w-full text-left font-serif text-sm leading-snug"
                    >
                      {c.chapter_number ? (
                        <span className="mr-1 font-mono text-xs text-muted-foreground">
                          {c.chapter_number}
                        </span>
                      ) : null}
                      {c.title}
                    </button>
                    <a
                      href={c.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      source <ExternalLink className="size-3" />
                    </a>
                  </div>
                ))}
              </div>
            </section>

            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setMessages([])}
              >
                <RotateCcw className="size-4" /> New conversation
              </Button>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {indexEmpty && (
            <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              The book index is empty. An administrator needs to import the book from GitHub on the{" "}
              <Link to="/admin" className="text-primary underline">
                admin page
              </Link>
              .
            </div>
          )}

          {empty ? (
            <div className="rounded-lg border border-border bg-paper p-6">
              <h2 className="font-serif text-2xl font-semibold">
                {displayName
                  ? `${displayName}, ask anything about writing your PhD`
                  : "Ask anything about writing your PhD"}
              </h2>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                Every answer is retrieved from the open-source book{" "}
                <em>How to write a PhD in Biological Sciences</em> before it is written, and each
                claim is cited back to the passage it came from. If the book does not cover
                something, the assistant will say so instead of guessing.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {EXAMPLES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-left font-serif text-sm transition-colors hover:border-primary hover:bg-accent/40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <article
                    key={m.id}
                    className="rounded-lg border border-border bg-paper px-4 py-4 sm:px-5"
                  >
                    {m.evidence && (
                      <span
                        className={cn(
                          "mb-3 inline-block rounded px-2 py-0.5 text-[11px] font-medium",
                          EVIDENCE_LABEL[m.evidence]?.className,
                        )}
                      >
                        {EVIDENCE_LABEL[m.evidence]?.label}
                      </span>
                    )}
                    <div className="prose-book font-serif text-[15px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                    {m.additionalContext && (
                      <div className="mt-4 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
                        <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Additional explanation (not from the book)
                        </p>
                        <div className="prose-book font-serif text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.additionalContext}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    <SourceList sources={m.sources ?? []} />
                  </article>
                ),
              )}
              {pending && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-paper px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching the book…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          <form
            className="sticky bottom-0 mt-6 border-t border-border bg-background pt-3 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                autoFocus
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask a question about the book…"
                className="max-h-40 min-h-[52px] resize-none bg-paper font-serif"
              />
              <Button type="submit" disabled={pending || input.trim().length < 2} size="lg">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="lg:hidden">
                Mode:{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setMode(mode === "book" ? "book_plus" : "book")}
                >
                  {mode === "book" ? "Book only" : "Book + explanation"}
                </button>
              </span>
              <span>
                {status.data
                  ? `${status.data.documents} chapters · ${status.data.chunks} indexed passages`
                  : "Loading index…"}
              </span>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
