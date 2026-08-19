-- ============================================================================
-- CONFERÊNCIA DA ORDEM DO CHECKLIST — versão correta
--
-- POR QUE ESTE ARQUIVO EXISTE.
-- A primeira consulta de conferência que eu mandei (20/08/2026) acusou duas
-- divergências que NÃO eram divergências. Ela comparava a ordem do processo
-- com QUALQUER linha do catálogo daquele tipo de documento — inclusive linhas
-- que não valem para aquele cliente e linhas inativas.
--
-- Os dois falso-positivos, e o que estava acontecendo de verdade:
--
--   • `renda_nf_empresa` num processo de cliente EMPRESÁRIO. O catálogo tem
--     duas linhas: ordem 270 para "autonomo" e ordem 280 para "empresario".
--     O processo estava em 280 — CERTO. A consulta acusou porque comparou
--     com a linha 270, que é de outra condição profissional.
--
--   • `renda_extrato_inss` num processo de cliente APOSENTADO. O catálogo tem
--     ordem 141 para "clt" (ativa) e ordem 200 para "aposentado" (INATIVA).
--     Como não há regra ATIVA que se aplique a ele, não existe ordem
--     autoritativa — e o realinhamento deixou quieto, como manda. A exigência,
--     aliás, já está `nao_aplicavel`: para aposentado o catálogo pede o
--     comprovante de benefício (ordem 210), não o extrato.
--
-- A conferência tem que usar EXATAMENTE o mesmo critério do conserto
-- (`qa_realinhar_ordem_checklist`): só linha ativa, só a regra que se aplica
-- à condição profissional do processo, regra específica ganhando da geral.
-- Conferência mais frouxa que o conserto gera alarme falso — e alarme falso
-- ensina a ignorar alarme.
--
-- Resultado esperado: NENHUMA linha.
-- ============================================================================

WITH esperado AS (
  SELECT DISTINCT ON (pd.id)
         pd.id            AS pd_id,
         pd.processo_id,
         pd.tipo_documento,
         pd.ordem         AS ordem_no_processo,
         sd.ordem         AS ordem_no_catalogo,
         sd.condicao_profissional AS regra_aplicada
    FROM public.qa_processo_documentos pd
    JOIN public.qa_processos p
      ON p.id = pd.processo_id
    JOIN public.qa_servicos_documentos sd
      ON sd.servico_id = p.servico_id
     AND sd.tipo_documento = pd.tipo_documento
   WHERE p.status NOT IN ('concluido', 'cancelado')
     AND sd.ativo = true
     AND sd.ordem IS NOT NULL
     AND (
       sd.condicao_profissional IS NULL
       OR COALESCE(p.condicao_profissional, 'indefinido') = ANY (
            SELECT btrim(lower(x))
              FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
          )
     )
   ORDER BY pd.id,
            (sd.condicao_profissional IS NOT NULL) DESC,
            sd.ordem
)
SELECT c.nome_completo,
       p.servico_nome,
       e.tipo_documento,
       e.ordem_no_processo,
       e.ordem_no_catalogo,
       e.regra_aplicada
  FROM esperado e
  JOIN public.qa_processos p ON p.id = e.processo_id
  JOIN public.qa_clientes  c ON c.id = p.cliente_id
 WHERE e.ordem_no_processo IS DISTINCT FROM e.ordem_no_catalogo
 ORDER BY c.nome_completo, e.ordem_no_catalogo;
