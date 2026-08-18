CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  filename text NOT NULL UNIQUE,
  path text NOT NULL,
  source_url text NOT NULL,
  chapter_number text,
  part text,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documents TO anon, authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Book documents are public" ON public.documents FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  heading text,
  subheading text,
  content text NOT NULL,
  chunk_order integer NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  embedding vector(1536),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chunks TO anon, authenticated;
GRANT ALL ON public.chunks TO service_role;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Book chunks are public" ON public.chunks FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX chunks_embedding_idx ON public.chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX chunks_fts_idx ON public.chunks USING gin (fts);
CREATE INDEX chunks_document_idx ON public.chunks (document_id, chunk_order);

CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  files_indexed integer NOT NULL DEFAULT 0,
  chunks_indexed integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.ingestion_runs TO anon, authenticated;
GRANT ALL ON public.ingestion_runs TO service_role;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ingestion runs are public" ON public.ingestion_runs FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.evaluation_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  expected_answer text,
  expected_sources text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluation_questions TO anon, authenticated;
GRANT ALL ON public.evaluation_questions TO service_role;
ALTER TABLE public.evaluation_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Evaluation questions are public" ON public.evaluation_questions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.evaluation_questions(id) ON DELETE CASCADE,
  generated_answer text NOT NULL,
  retrieved_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  groundedness_score numeric,
  citation_score numeric,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluation_results TO anon, authenticated;
GRANT ALL ON public.evaluation_results TO service_role;
ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Evaluation results are public" ON public.evaluation_results FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(1536),
  query_text text DEFAULT '',
  match_count integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  heading text,
  subheading text,
  content text,
  chunk_order integer,
  title text,
  filename text,
  source_url text,
  chapter_number text,
  similarity double precision,
  keyword_rank double precision,
  score double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH semantic AS (
    SELECT c.id,
           1 - (c.embedding <=> query_embedding) AS similarity,
           row_number() OVER (ORDER BY c.embedding <=> query_embedding) AS rank
    FROM public.chunks c
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT greatest(match_count * 4, 30)
  ),
  keyword AS (
    SELECT c.id,
           ts_rank(c.fts, websearch_to_tsquery('english', query_text)) AS keyword_rank,
           row_number() OVER (ORDER BY ts_rank(c.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank
    FROM public.chunks c
    WHERE query_text <> '' AND c.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY keyword_rank DESC
    LIMIT greatest(match_count * 4, 30)
  ),
  merged AS (
    SELECT COALESCE(s.id, k.id) AS id,
           COALESCE(s.similarity, 0) AS similarity,
           COALESCE(k.keyword_rank, 0) AS keyword_rank,
           COALESCE(1.0 / (60 + s.rank), 0) + COALESCE(0.7 / (60 + k.rank), 0) AS score
    FROM semantic s
    FULL OUTER JOIN keyword k ON k.id = s.id
  )
  SELECT c.id, c.document_id, c.heading, c.subheading, c.content, c.chunk_order,
         d.title, d.filename, d.source_url, d.chapter_number,
         m.similarity, m.keyword_rank, m.score
  FROM merged m
  JOIN public.chunks c ON c.id = m.id
  JOIN public.documents d ON d.id = c.document_id
  ORDER BY m.score DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, text, integer) TO anon, authenticated, service_role;

INSERT INTO public.evaluation_questions (question, expected_answer, expected_sources) VALUES
('According to Measey, what can replace the word "hypothesis" in different situations?', NULL, '{}'),
('If a study proposes a new methodology rather than testing a hypothesis, what should the Introduction establish?', NULL, '{}'),
('What does the book say about HARKing?', NULL, '{}'),
('Why does the author recommend formulaic scientific writing?', NULL, '{}'),
('How does the book distinguish excellent formulaic writing from papers that successfully "break the mould"?', NULL, '{}'),
('What formatting rules does the author provide for genus and species names?', NULL, '{}'),
('Why might a PhD student need to check the accepted scientific name of their study organism again before submission?', NULL, '{}'),
('What advice does the book give for writing a Discussion?', NULL, '{}');