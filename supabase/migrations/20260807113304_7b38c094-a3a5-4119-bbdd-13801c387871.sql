-- 1) Preserva a resolução já dada pelo cliente na linha mais recente de cada duplicata
WITH ranked AS (
  SELECT id, processo_id, tipo_documento, status, created_at,
         ROW_NUMBER() OVER (PARTITION BY processo_id, tipo_documento ORDER BY created_at DESC, id DESC) AS rn,
         COUNT(*) OVER (PARTITION BY processo_id, tipo_documento) AS n
  FROM public.qa_processo_documentos
),
resolvido AS (
  SELECT processo_id, tipo_documento,
         MAX(status) FILTER (WHERE status IN ('nao_aplicavel','dispensado_grupo','dispensado_por_reaproveitamento','aprovado')) AS status_resolvido
  FROM ranked WHERE n > 1
  GROUP BY processo_id, tipo_documento
)
UPDATE public.qa_processo_documentos d
SET status = r.status_resolvido, updated_at = now()
FROM ranked k
JOIN resolvido r ON r.processo_id = k.processo_id AND r.tipo_documento = k.tipo_documento
WHERE d.id = k.id AND k.rn = 1 AND r.status_resolvido IS NOT NULL AND d.status <> r.status_resolvido;

-- 2) Remove as linhas antigas duplicadas
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY processo_id, tipo_documento ORDER BY created_at DESC, id DESC) AS rn
  FROM public.qa_processo_documentos
)
DELETE FROM public.qa_processo_documentos d
USING ranked k
WHERE d.id = k.id AND k.rn > 1;

-- 3) Trava estrutural contra novas duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_processo_doc_processo_tipo
  ON public.qa_processo_documentos (processo_id, tipo_documento);

-- 4) Contracheque = holerite (mesmo comprovante de ocupacao licita)
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('renda_contra_cheque_mes_atual', 'renda_holerite_mes_atual'),
  ('renda_contra_cheque_mes_atual', 'renda_holerite_funcionario_publico')
ON CONFLICT DO NOTHING;