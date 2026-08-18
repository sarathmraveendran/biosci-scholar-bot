import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type Source = {
  id: string;
  chapter: string;
  heading: string | null;
  subheading?: string | null;
  filename: string;
  sourceUrl: string;
  passage?: string;
  similarity?: number;
};

function SourceRow({ source, index }: { source: Source; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border border-border bg-background/60">
      <div className="flex items-start gap-2 px-3 py-2">
        <span className="mt-0.5 font-mono text-xs text-muted-foreground">[{index + 1}]</span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-sm font-semibold leading-snug">{source.chapter}</p>
          {(source.heading || source.subheading) && (
            <p className="text-xs text-muted-foreground">
              {[source.heading, source.subheading].filter(Boolean).join(" › ")}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {source.filename}
              <ExternalLink className="size-3" />
            </a>
            {source.passage && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                {open ? "Hide passage" : "Show passage"}
                <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
              </button>
            )}
            {typeof source.similarity === "number" && (
              <span className="font-mono text-muted-foreground">
                sim {source.similarity.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
      {open && source.passage && (
        <blockquote className="mx-3 mb-3 border-l-2 border-accent bg-muted/50 px-3 py-2 font-serif text-sm leading-relaxed whitespace-pre-wrap">
          {source.passage}
        </blockquote>
      )}
    </li>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Sources ({sources.length})
      </p>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <SourceRow key={s.id} source={s} index={i} />
        ))}
      </ul>
    </div>
  );
}
