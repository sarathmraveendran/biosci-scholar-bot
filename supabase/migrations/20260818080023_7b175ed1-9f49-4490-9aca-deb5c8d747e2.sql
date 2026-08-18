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
SECURITY INVOKER
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