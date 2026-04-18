ALTER TABLE public.qa_itens_venda ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Inicializa sort_order com base na ordem atual (id) dentro de cada venda
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY venda_id ORDER BY id) AS rn
  FROM public.qa_itens_venda
)
UPDATE public.qa_itens_venda q
SET sort_order = r.rn
FROM ranked r
WHERE q.id = r.id AND q.sort_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_qa_itens_venda_sort ON public.qa_itens_venda(venda_id, sort_order);