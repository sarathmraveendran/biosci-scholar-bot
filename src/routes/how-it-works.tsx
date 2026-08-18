import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  FileText,
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
          "Learn how the PhD Book Assistant retrieves answers from John Measey's open-source book, ranks passages and cites every claim.",
      },
      { property: "og:title", content: "How it works — PhD Book Assistant" },
      {
        property: "og:description",
        content:
          "Retrieval-augmented Q&A with hybrid search, grounded answers and source citations from 'How to write a PhD in Biological Sciences'.",
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
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            How this assistant works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Every answer is retrieved from the open-source book{" "}
            <em>How to write a PhD in Biological Sciences</em> before it is written. The assistant
            cites the exact passages it used, so you can verify every claim.
          </p>
        </div>

        <section className="space-y-10">
          <Step
            number={1}
            icon={<FileText className="size-5" />}
            title="The book is indexed from GitHub"
          >
            <p>
              The source material comes from John Measey's public GitHub repository. The ingestion
              pipeline reads the <code>.Rmd</code> and <code>.md</code> chapter files, cleans out
              code blocks and LaTeX markup, and splits each chapter into semantic chunks of roughly
              400–800 tokens.
            </p>
            <p>
              Each chunk is stored with its metadata — chapter number, section heading, source file
              path and a link back to the original GitHub line range — so citations can point to the
              primary source.
            </p>
          </Step>

          <Step
            number={2}
            icon={<Brain className="size-5" />}
            title="Chunks are turned into searchable vectors"
          >
            <p>
              Every chunk is converted into a dense embedding vector using an OpenAI embedding
              model. These vectors live in a pgvector index in the database, which makes semantic
              search fast: questions and passages with similar meaning are ranked close together
              even when they do not share the same words.
            </p>
          </Step>

          <Step
            number={3}
            icon={<Search className="size-5" />}
            title="Hybrid retrieval combines meaning and keywords"
          >
            <p>
              When you ask a question, the assistant runs two searches in parallel:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Vector search</strong> finds passages that are semantically similar to
                your question.
              </li>
              <li>
                <strong>Full-text search</strong> finds passages that contain the exact words you
                used.
              </li>
            </ul>
            <p>
              The results are merged with Reciprocal Rank Fusion (RRF), so a passage that scores
              well in both searches rises to the top. The top 5–8 passages are passed to the
              language model.
            </p>
          </Step>

          <Step
            number={4}
            icon={<Sparkles className="size-5" />}
            title="The answer is generated from the retrieved passages"
          >
            <p>
              A Gemini model is shown only the retrieved passages and your question. It is
              instructed to answer strictly from those passages, to cite the sources it uses, and to
              say "not found in the book" when the evidence is too weak.
            </p>
            <p>
              The model returns a structured response that includes the final answer, a
              groundedness label, and the list of passages it actually relied on.
            </p>
          </Step>

          <Step
            number={5}
            icon={<CheckCircle2 className="size-5" />}
            title="Every answer is labelled and cited"
          >
            <p>Below each reply you will see:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Well supported by the book</strong> — the answer is built directly from one
                or more retrieved passages.
              </li>
              <li>
                <strong>Partially supported</strong> — some claims are grounded, but the question
                stretches beyond the retrieved text.
              </li>
              <li>
                <strong>Not found in the book</strong> — the book does not contain enough information
                to answer reliably.
              </li>
            </ul>
            <p>
              Each used passage is listed as a source with a GitHub link and an expandable quote, so
              you can read the original context.
            </p>
          </Step>
        </section>

        <section className="mt-14 rounded-xl border border-border bg-paper p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h3 className="font-serif text-xl font-semibold">Answer modes</h3>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="font-semibold">Book only</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                The default. The assistant answers using only the retrieved book passages. If the
                book is silent, it says so.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Book + explanation</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                The assistant still grounds the answer in the book, then adds clearly separated
                general academic-writing context that is not from the book.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-paper p-6 sm:p-8">
          <h3 className="font-serif text-xl font-semibold">Privacy & data</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              Your conversation is stored in your browser's <code>localStorage</code>, not on the
              server. It stays on your device.
            </li>
            <li>
              The name you enter for the greeting is also stored locally and can be changed or
              cleared at any time from the user menu.
            </li>
            <li>
              Questions are sent to the server to run retrieval and generation, but they are not
              used to train any model.
            </li>
          </ul>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-paper p-6 sm:p-8">
          <h3 className="font-serif text-xl font-semibold">Evaluation & quality</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The admin console includes a benchmark suite of known questions with expected sources.
            Running the suite checks whether the retrieval step returns the right passages and
            whether the generated answer stays grounded in the book. This helps catch drift or
            hallucinations after the book is re-indexed.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/">Try asking a question</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/admin">Open admin console</Link>
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
