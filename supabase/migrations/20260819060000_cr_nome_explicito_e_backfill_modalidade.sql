-- ============================================================================
-- CR: nome explícito na vitrine + acerto do processo que já existia
-- ----------------------------------------------------------------------------
-- 1) O item passa a dizer a atividade que vende, em vez de deixar implícito.
--    Só o NOME muda. O `slug` continua `concessao-cr` — ele é referenciado pelo
--    anexo I.6 do contrato, pela whitelist de grupos do portal, pelas páginas
--    de SEO e pelas solicitações já gravadas. Trocar slug quebraria tudo isso
--    para ganhar nada.
--
-- 2) O gatilho da modalidade só carimba processo NOVO. Existe um processo de CR
--    aberto em 15/07/2026, anterior a tudo isto, com a modalidade em branco —
--    e enquanto ela estiver em branco esse cliente não é cobrado da filiação à
--    entidade de tiro nem do compromisso de habitualidade.
--
--    O acerto é feito pela RPC `qa_processo_definir_modalidade`, que é a função
--    que já existe para isso: ela grava a modalidade, injeta as exigências da
--    atividade que faltavam e NUNCA apaga documento já entregue ou aprovado.
--    Só toca em processo EM ABERTO (`qa_processo_em_aberto`) — processo
--    protocolado, deferido ou arquivado fica como está: mexer no checklist de
--    um processo que já saiu daqui não conserta nada e bagunça o histórico.
--
-- ATENÇÃO — o que este bloco NÃO faz: ele não reexplode o checklist. O processo
-- de 15/07 nasceu com o checklist ANTIGO do CR (18 exigências, sem ocupação
-- lícita, sem requerimento, sem taxa). Ele ganha a modalidade e as exigências
-- da atividade, mas não as outras que entraram no checklist novo. Reexplodir um
-- processo em andamento é decisão de operação, não de migration — a consulta de
-- conferência no fim mostra o tamanho do buraco para vocês decidirem.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) Nome explícito ───────────────────────────────────────────────────────
-- Caixa alta para acompanhar os vizinhos da mesma categoria no catálogo
-- ("AUTORIZAÇÃO DE COMPRA DE ARMA DE FOGO ATIRADOR ESPORTIVO (CAC)").
UPDATE public.qa_servicos_catalogo
   SET nome       = 'CONCESSÃO DE CR — ATIRADOR ESPORTIVO',
       updated_at = now()
 WHERE slug = 'concessao-cr';

-- O nome operacional também: é ele que é copiado para `qa_processos.servico_nome`
-- e aparece na lista da equipe e no portal do cliente.
UPDATE public.qa_servicos
   SET nome_servico = 'CONCESSÃO DE CR — ATIRADOR ESPORTIVO'
 WHERE id = 44;

-- ── 2) Acerto dos processos de CR que nasceram antes do gatilho ─────────────
DO $$
DECLARE
  r        record;
  v_ajuste record;
  v_total  integer := 0;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.qa_processos p
     WHERE p.servico_id = 44
       AND p.modalidade IS NULL
       AND public.qa_processo_em_aberto(p.status)
  LOOP
    SELECT * INTO v_ajuste
      FROM public.qa_processo_definir_modalidade(r.id, 'atirador');
    v_total := v_total + 1;
    RAISE NOTICE 'Processo %: modalidade atirador (% exigências removidas, % adicionadas)',
      r.id, v_ajuste.removidos, v_ajuste.adicionados;
  END LOOP;
  RAISE NOTICE 'Processos de CR acertados: %', v_total;
END $$;

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O item da vitrine, com nome e atividade explícitos:
--
-- SELECT slug, nome, preco, modalidade_cac
--   FROM public.qa_servicos_catalogo WHERE slug = 'concessao-cr';
--
-- Esperado: CONCESSÃO DE CR — ATIRADOR ESPORTIVO · 1239.00 · atirador.
--
-- 2) Nenhum processo de CR aberto pode continuar sem modalidade:
--
-- SELECT id, status, modalidade, created_at
--   FROM public.qa_processos
--  WHERE servico_id = 44
--  ORDER BY created_at;
--
-- Esperado: todo processo EM ABERTO com modalidade = 'atirador'.
--
-- 3) O tamanho do buraco do processo antigo — quantas exigências ele tem hoje
--    contra as 46 do checklist novo. Se a diferença for grande, é caso de a
--    equipe decidir se reexplode o checklist dele ou toca o processo como está:
--
-- SELECT p.id, p.status, count(pd.id) AS exigencias_no_processo,
--        (SELECT count(*) FROM public.qa_servicos_documentos sd
--          WHERE sd.servico_id = 44 AND sd.ativo) AS exigencias_no_catalogo
--   FROM public.qa_processos p
--   LEFT JOIN public.qa_processo_documentos pd ON pd.processo_id = p.id
--  WHERE p.servico_id = 44
--  GROUP BY p.id, p.status
--  ORDER BY p.id;
