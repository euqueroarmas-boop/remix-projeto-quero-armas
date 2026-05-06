-- Atualiza saldo de munições para EXCLUIR movimentações com documentos em revisão.
CREATE OR REPLACE VIEW public.qa_municoes_saldos AS
SELECT
  cliente_id,
  calibre,
  COALESCE(marca, ''::text) AS marca,
  COALESCE(lote, ''::text) AS lote,
  MIN(data_fabricacao) FILTER (WHERE tipo = 'ENTRADA') AS data_fabricacao,
  MIN(data_validade)   FILTER (WHERE tipo = 'ENTRADA') AS data_validade,
  SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE -quantidade END)::int AS saldo,
  SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE 0 END)::int AS total_entradas,
  SUM(CASE tipo WHEN 'SAIDA'   THEN quantidade ELSE 0 END)::int AS total_saidas,
  MAX(data_movimentacao) AS ultima_movimentacao
FROM public.qa_municoes_movimentacoes
WHERE COALESCE(revisao_obrigatoria, false) = false
  AND COALESCE(ia_status, 'nao_processado') NOT IN (
    'revisao_obrigatoria',
    'pendente_revisao',
    'aguardando_revisao_equipe',
    'documento_divergente',
    'documento_nao_identificado'
  )
GROUP BY cliente_id, calibre, COALESCE(marca, ''::text), COALESCE(lote, ''::text);

ALTER VIEW public.qa_municoes_saldos SET (security_invoker = true);

-- Visão separada das movimentações aguardando validação documental.
CREATE OR REPLACE VIEW public.qa_municoes_em_revisao AS
SELECT
  m.id,
  m.cliente_id,
  m.tipo,
  m.calibre,
  m.marca,
  m.lote,
  m.quantidade,
  m.data_movimentacao,
  m.documento_url,
  m.documento_nome,
  m.ia_status,
  m.revisao_obrigatoria,
  m.ia_dados_extraidos,
  m.created_at
FROM public.qa_municoes_movimentacoes m
WHERE COALESCE(m.revisao_obrigatoria, false) = true
   OR COALESCE(m.ia_status, 'nao_processado') IN (
     'revisao_obrigatoria',
     'pendente_revisao',
     'aguardando_revisao_equipe',
     'documento_divergente',
     'documento_nao_identificado'
   );

ALTER VIEW public.qa_municoes_em_revisao SET (security_invoker = true);

COMMENT ON VIEW public.qa_municoes_saldos IS
  'Saldo regular de munições: exclui movimentações com NF em revisão pela Equipe Quero Armas.';
COMMENT ON VIEW public.qa_municoes_em_revisao IS
  'Movimentações de munição aguardando validação documental (não contam para saldo/KPI).';