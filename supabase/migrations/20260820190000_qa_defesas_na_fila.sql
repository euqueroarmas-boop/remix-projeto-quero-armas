-- =============================================================================
-- FILA DE DEFESAS — cálculo no banco (20/08/2026)
-- -----------------------------------------------------------------------------
-- O painel montava a fila de defesas no navegador, cruzando três consultas.
-- Com os dados reais provando 3 clientes na fila e a tela mostrando 0, o
-- cálculo desce para o banco: uma função só, conferível no SQL Editor, que o
-- painel apenas lê.
--
-- Regras (titular, 20/08/2026):
--   • Entra na fila quem FECHOU o grupo de efetiva necessidade e espera a
--     defesa. Sem itens de efetiva no checklist, vale a parte do cliente
--     fechada (ignorando GRU/gov.br/juntada, que vêm DEPOIS da defesa).
--   • Só responsabilidade da EQUIPE: a redigir, redigida sem enviar, ou
--     devolvida pelo cliente. Peça com o cliente ou aprovada fica fora.
--   • Serviço sem defesa (CAC/SIGMA e isenções) NUNCA entra.
--   • prazo_inicio = última entrega que fechou o gatilho — o relógio de
--     7 dias úteis conta a partir dela.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.qa_defesas_na_fila()
RETURNS TABLE (
  processo_id uuid,
  cliente_id integer,
  cliente_nome text,
  servico_nome text,
  estado text,          -- 'a_redigir' | 'redigida' | 'devolvida'
  prazo_inicio timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH ativos AS (
  SELECT p.id, p.cliente_id, cl.nome_completo, p.servico_nome, p.status,
         p.protocolo_numero, p.servico_id
    FROM public.qa_processos p
    JOIN public.qa_clientes cl ON cl.id = p.cliente_id
   WHERE p.status NOT IN ('deferido','indeferido','cancelado','arquivado')
     AND COALESCE(cl.status, '') <> 'excluido_lgpd'
),
docs AS (
  SELECT
    pd.processo_id,
    count(*) AS total,
    count(*) FILTER (
      WHERE lower(COALESCE(pd.status,'')) IN
              ('pendente','pendente_reenvio','invalido','reprovado','divergente',
               'rejeitado','aguardando_envio','em_correcao')
        AND lower(pd.tipo_documento) NOT IN
              ('gru','gru_boleto','gru_comprovante','gru_paga',
               'credencial_gov_br','senha_gov_br','acesso_gov_br','juntada_assinada')
    ) AS abertos_nao_final,
    count(*) FILTER (
      WHERE lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
         OR lower(pd.tipo_documento) LIKE '%efetiva_necessidade%'
    ) AS en_itens,
    count(*) FILTER (
      WHERE (lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
             OR lower(pd.tipo_documento) LIKE '%efetiva_necessidade%')
        AND lower(COALESCE(pd.status,'')) IN
              ('pendente','pendente_reenvio','invalido','reprovado','divergente',
               'rejeitado','aguardando_envio','em_correcao')
    ) AS en_abertos,
    max(COALESCE(pd.data_envio, pd.updated_at)) FILTER (
      WHERE (lower(pd.tipo_documento) IN ('declaracao_necessidade_efetiva','comprovante_efetiva_necessidade')
             OR lower(pd.tipo_documento) LIKE '%efetiva_necessidade%')
    ) AS en_fechou_em,
    max(COALESCE(pd.data_envio, pd.updated_at)) FILTER (
      WHERE lower(pd.tipo_documento) NOT IN
              ('gru','gru_boleto','gru_comprovante','gru_paga',
               'credencial_gov_br','senha_gov_br','acesso_gov_br','juntada_assinada')
        AND lower(COALESCE(pd.status,'')) NOT IN
              ('pendente','pendente_reenvio','invalido','reprovado','divergente',
               'rejeitado','aguardando_envio','em_correcao')
    ) AS docs_fechou_em
  FROM public.qa_processo_documentos pd
  GROUP BY pd.processo_id
),
-- Peça dominante por processo: peça com vínculo vale o vínculo; peça solta
-- (gerada e nunca enviada nasce sem processo_id) cai no ÚNICO processo ativo
-- do cliente — com dois ou mais, não se chuta.
pecas AS (
  SELECT a.id AS processo_id,
         max(CASE g.status_cliente
               WHEN 'aprovada' THEN 4
               WHEN 'aguardando_cliente' THEN 3
               WHEN 'devolvida' THEN 2
               WHEN 'nao_enviada' THEN 1
               ELSE 0 END) AS prio
    FROM ativos a
    JOIN public.qa_geracoes_pecas g
      ON g.processo_id = a.id
      OR (g.processo_id IS NULL
          AND g.cliente_id = a.cliente_id
          AND (SELECT count(*) FROM ativos a2 WHERE a2.cliente_id = a.cliente_id) = 1)
   GROUP BY a.id
)
SELECT
  a.id,
  a.cliente_id,
  a.nome_completo,
  a.servico_nome,
  CASE WHEN pe.prio = 2 THEN 'devolvida'
       WHEN pe.prio = 1 THEN 'redigida'
       ELSE 'a_redigir' END,
  COALESCE(d.en_fechou_em, d.docs_fechou_em)
FROM ativos a
JOIN docs d ON d.processo_id = a.id
LEFT JOIN pecas pe ON pe.processo_id = a.id
LEFT JOIN public.qa_servicos_catalogo sc ON sc.servico_id = a.servico_id
WHERE COALESCE(sc.exige_peca_defesa, false)
  AND a.protocolo_numero IS NULL
  AND a.status NOT IN ('protocolado','em_analise_orgao','em_exigencia','notificado','recurso_administrativo')
  AND COALESCE(pe.prio, 0) IN (0, 1, 2)
  AND d.total > 0
  AND CASE WHEN d.en_itens > 0 THEN d.en_abertos = 0 ELSE d.abertos_nao_final = 0 END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_defesas_na_fila() TO authenticated, service_role;
