-- =============================================================================
-- OS DOCUMENTOS DE RENDA GANHAM O PRAZO QUE JÁ ERA O DELES EM TODO LUGAR
--
-- ACHADO (19/08/2026). O catálogo tem 69 exigências sem prazo (`validade_dias`
-- nulo) em documento que claramente tem prazo. Sem prazo no catálogo não há
-- prazo no processo; sem prazo no processo não há data de validade; sem data,
-- o documento envelhece em silêncio e só aparece na mesa do protocolo. Foi
-- exatamente o caminho do cartão CNPJ do Gilson.
--
-- ── O QUE ESTA MIGRATION RESOLVE, e por que dá para resolver sozinha ─────────
-- Cinco tipos de documento de renda. Para TODOS eles o prazo usado em todo
-- serviço que já o preenche é o MESMO — 30 dias, sem uma única divergência:
--
--   renda_cartao_cnpj              renda_comprovante_beneficio
--   renda_qsa                      renda_contra_cheque_mes_atual
--                                  renda_holerite_mes_atual
--
-- Não há escolha a fazer aqui: é copiar para os serviços esquecidos o número
-- que os outros já usam. Uniformizar não muda regra de negócio nenhuma.
--
-- DETALHE QUE IMPORTA PARA OS TRÊS "DO MÊS" (benefício, contracheque,
-- holerite): a data deles NÃO vem mais de 30 dias — vem do fim do mês
-- (20260819100000). Mas `qa_preencher_validade_por_prazo_catalogo` só olha
-- documento que TENHA prazo. Preencher os 30 aqui é o que LIGA a regra do mês
-- para eles; sem isso continuariam invisíveis.
--
-- ── O QUE ESTA MIGRATION NÃO RESOLVE, de propósito ──────────────────────────
--
-- 1. CERTIDÕES DE ANTECEDENTES. Os serviços que preenchem discordam entre si:
--    a mesma certidão aparece com 30, 60 e 90 dias. Não é esquecimento, é
--    divergência — e escolher um número no escuro trocaria um problema
--    silencioso por um errado. Fica para decisão.
--
-- 2. COMPROVANTE DE RESIDÊNCIA (atual). Vários serviços o chamam de
--    "(últimos 90 dias)" no próprio nome, mas onde há prazo preenchido ele
--    está como 30. O nome e o número discordam. Mesma decisão pendente.
--
-- 3. COMPROVANTE DE RESIDÊNCIA DE ANO ANTERIOR (`comprovante_residencia_ano_1`
--    a `_ano_4`). Estes NÃO devem ter prazo e não é falha que estejam sem: são
--    prova de onde a pessoa morava em 2022, 2023, 2024, 2025. Documento
--    histórico não vence — o ano dele não muda. Nenhum serviço preenche prazo
--    para eles, e está certo assim. Ficam fora da regra para sempre.
--
-- Idempotente: só escreve onde está nulo.
-- =============================================================================

BEGIN;

WITH ajustadas AS (
  UPDATE public.qa_servicos_documentos sd
     SET validade_dias = 30,
         updated_at    = now()
   WHERE sd.ativo = true
     AND sd.validade_dias IS NULL
     AND lower(sd.tipo_documento) IN (
       'renda_cartao_cnpj',
       'renda_qsa',
       'renda_comprovante_beneficio',
       'renda_contra_cheque_mes_atual',
       'renda_holerite_mes_atual'
     )
  RETURNING sd.id
)
SELECT count(*) AS linhas_do_catalogo_com_prazo_novo FROM ajustadas;

-- Propaga na hora: catálogo → processos abertos → datas de validade.
-- Sem isto o conserto só valeria de madrugada, no ciclo diário.
DO $$
DECLARE v_r jsonb;
BEGIN
  SELECT public.qa_manutencao_validade_documentos() INTO v_r;
  RAISE NOTICE 'Propagação imediata: %', v_r;
END $$;

COMMIT;
