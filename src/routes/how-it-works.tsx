import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  FileSearch,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — PhD Book Assistant" },
      {
        name: "description",
        content:
          "Learn how the PhD Book Assistant answers your questions using only the open-source book, with citations to every source passage.",
      },
      { property: "og:title", content: "How it works — PhD Book Assistant" },
      {
        property: "og:description",
        content:
          "Grounded Q&A on writing a biology PhD: answers come from the book, with citations to every source passage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <BookOpen className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg font-semibold">PhD Book Assistant</h1>
          </div>
          <UserMenu />
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ShieldCheck className="size-4" /> Admin
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/">Ask a question</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            How this assistant answers your questions
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            The assistant is built around one rule: answer from the book, not from memory. Every
            reply is tied to actual passages from{" "}
            <em>How to write a PhD in Biological Sciences</em>, so you can see exactly where the
            information came from.
          </p>
        </div>

        <section className="space-y-10">
          <Step number={1} icon={<BookOpen className="size-5" />} title="It knows one book well">
            <p>
              The assistant has read the open-source book <em>How to write a PhD in Biological
              Sciences</em> by John Measey. It does not browse the web or rely on general knowledge.
              Everything it tells you is drawn from that book.
            </p>
          </Step>

          <Step number={2} icon={<Search className="size-5" />} title="It finds the right pages">
            <p>
              When you ask a question, the assistant searches the book for passages that match what
              you asked. It looks for both the meaning of your question and the exact words you
              used, then picks the most relevant sections.
            </p>
          </Step>

          <Step number={3} icon={<Sparkles className="size-5" />} title="It writes an answer from those pages">
            <p>
              The assistant reads the selected passages and writes a clear answer based only on
              what it found. If the book does not cover your topic, it will say so instead of
              guessing.
            </p>
          </Step>

          <Step number={4} icon={<FileSearch className="size-5" />} title="It shows you the sources">
            <p>
              Every answer includes a "Sources" section with links back to the original book
              passages on GitHub. You can expand each source to read the exact quote and check it
              for yourself.
            </p>
          </Step>

          <Step number={5} icon={<CheckCircle2 className="size-5" />} title="It tells you how confident it is">
            <p>Each reply is labelled so you know how strongly the book supports it:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Well supported by the book</strong> — the answer is built directly from one
                or more passages.
              </li>
              <li>
                <strong>Partially supported</strong> — some parts are grounded in the book, but the
                answer also covers ground the book does not fully address.
              </li>
              <li>
                <strong>Not found in the book</strong> — the book does not contain enough information
                to answer reliably.
              </li>
            </ul>
          </Step>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-paper p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h3 className="font-serif text-xl font-semibold">Two ways to answer</h3>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="font-semibold">Book only</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                The default. The assistant sticks strictly to the book. If the book does not cover
                something, it says so.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Book + explanation</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                The assistant still answers from the book first, then adds a short general
                explanation in a separate, clearly labelled section.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-paper p-6 sm:p-8">
          <h3 className="font-serif text-xl font-semibold">What this means for you</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              <strong>You can trust the citations.</strong> Click any source link to read the
              original passage in the book.
            </li>
            <li>
              <strong>You know when the answer is thin.</strong> The confidence label stops the
              assistant from pretending to know something it does not.
            </li>
            <li>
              <strong>Your chat is private.</strong> Your conversation is saved in your browser, not
              on our servers. Only your questions are sent to the server to generate answers.
            </li>
            <li>
              <strong>It is okay to ask follow-ups.</strong> The assistant understands the context
              of your conversation, so you can keep refining your question.
            </li>
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/">Try asking a question</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="mt-2 font-mono text-xs font-medium text-muted-foreground">0{number}</span>
      </div>
      <div className="flex-1 pb-2">
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        <div className="prose-book mt-2 text-[15px] text-foreground/90">{children}</div>
      </div>
    </div>
  );
}
