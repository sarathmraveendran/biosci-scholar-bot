export const REPO_OWNER = "johnmeasey";
export const REPO_NAME = "How-to-write-a-PhD-in-Biological-Sciences";
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

export type RepoFile = { path: string; size: number };

const IGNORED_EXACT = new Set([
  "README.md",
  "LICENSE.md",
  "_output.yml",
  "_bookdown.yml",
  "index.Rmd",
]);

function isBookFile(path: string): boolean {
  if (path.includes("/")) {
    // only keep book text living in the repo root or a docs/ style folder
    if (!/^(docs|chapters|book)\//i.test(path)) return false;
  }
  const lower = path.toLowerCase();
  if (!lower.endsWith(".rmd") && !lower.endsWith(".md")) return false;
  const name = path.split("/").pop() ?? path;
  if (IGNORED_EXACT.has(name)) return false;
  if (name.startsWith("_")) return false;
  return true;
}

export async function listRepoFiles(branch = "HEAD"): Promise<RepoFile[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${branch}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json", "User-Agent": "phd-book-assistant" } },
  );
  if (!res.ok) throw new Error(`GitHub listing failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
  return json.tree
    .filter((n) => n.type === "blob" && isBookFile(n.path))
    .map((n) => ({ path: n.path, size: n.size ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

export async function fetchFileContent(path: string, branch = "main"): Promise<string> {
  const res = await fetch(
    `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${path}`,
    { headers: { "User-Agent": "phd-book-assistant" } },
  );
  if (!res.ok) throw new Error(`Fetching ${path} failed [${res.status}]`);
  return res.text();
}

export function sourceUrlFor(path: string, branch = "main"): string {
  return `${REPO_URL}/blob/${branch}/${path}`;
}

export function chapterNumberFor(path: string): string | null {
  const name = path.split("/").pop() ?? path;
  const match = name.match(/^(\d+(?:\.\d+)?)[-_.]/);
  return match?.[1] ?? null;
}

/** Strip YAML front matter, R code chunks, inline R, and LaTeX/HTML noise. */
export function cleanMarkdown(raw: string): string {
  let text = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
  text = text.replace(/```\{[\s\S]*?```/g, "");
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`r [^`]*`/g, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/\{#[^}]*\}/g, "");
  text = text.replace(/\r\n/g, "\n");
  return text.trim();
}

export type ParsedChunk = {
  heading: string | null;
  subheading: string | null;
  content: string;
  chunkOrder: number;
  tokenCount: number;
};

const MAX_CHARS = 3000; // ~750 tokens
const MIN_CHARS = 350;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type Section = { heading: string | null; subheading: string | null; paragraphs: string[] };

function splitIntoSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let heading: string | null = null;
  let subheading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (!body) return;
    const paragraphs = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length) sections.push({ heading, subheading, paragraphs });
  };

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1]!.length;
      const title = h[2]!.replace(/[*_`]/g, "").trim();
      if (level <= 2) {
        heading = title;
        subheading = null;
      } else {
        subheading = title;
      }
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

/** Structure-aware chunking: split on headings, then group paragraphs with overlap. */
export function chunkDocument(cleaned: string): ParsedChunk[] {
  const sections = splitIntoSections(cleaned);
  const chunks: ParsedChunk[] = [];
  let order = 0;

  for (const section of sections) {
    let current: string[] = [];
    let currentLen = 0;

    const push = () => {
      const content = current.join("\n\n").trim();
      if (content.length >= 40) {
        chunks.push({
          heading: section.heading,
          subheading: section.subheading,
          content,
          chunkOrder: order++,
          tokenCount: estimateTokens(content),
        });
      }
      current = [];
      currentLen = 0;
    };

    for (const paragraph of section.paragraphs) {
      if (paragraph.length > MAX_CHARS) {
        if (currentLen) push();
        const sentences = paragraph.match(/[^.!?]+[.!?]*\s*/g) ?? [paragraph];
        let piece = "";
        for (const sentence of sentences) {
          if (piece.length + sentence.length > MAX_CHARS && piece.length) {
            current = [piece];
            push();
            piece = "";
          }
          piece += sentence;
        }
        if (piece.trim()) {
          current = [piece.trim()];
          push();
        }
        continue;
      }

      if (currentLen + paragraph.length > MAX_CHARS && currentLen >= MIN_CHARS) {
        const overlap = current[current.length - 1];
        push();
        if (overlap && overlap.length < 800) {
          current = [overlap];
          currentLen = overlap.length;
        }
      }
      current.push(paragraph);
      currentLen += paragraph.length + 2;
    }
    if (currentLen) push();
  }

  return chunks;
}

export function documentTitle(cleaned: string, path: string): string {
  const heading = cleaned.match(/^#{1,2}\s+(.+)$/m);
  if (heading?.[1]) return heading[1].replace(/[*_`]/g, "").trim();
  const name = (path.split("/").pop() ?? path).replace(/\.(rmd|md)$/i, "");
  return name.replace(/^[\d.]+[-_]?/, "").replace(/[-_]/g, " ").trim() || name;
}
