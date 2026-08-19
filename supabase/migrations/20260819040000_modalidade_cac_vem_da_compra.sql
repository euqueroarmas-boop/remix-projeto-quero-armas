-- ============================================================================
-- Modalidade CAC vem da COMPRA, não de pergunta ao cliente
-- ----------------------------------------------------------------------------
-- Correção do que eu tinha feito errado na migration anterior: eu havia posto a
-- modalidade (colecionador / atirador / caçador) como a primeira pergunta do
-- checklist do CR. Não é. Quem define a modalidade é o item que o cliente
-- comprou no catálogo — ele não escolhe nada depois. Comprou "atirador
-- esportivo", é atirador esportivo.
--
-- O QUE ESTE BLOCO FAZ
--   1. cria a coluna `modalidade_cac` em `qa_servicos_catalogo` — é ali que a
--      modalidade passa a morar, uma por item de catálogo;
--   2. cria o gatilho que carimba `qa_processos.modalidade` no nascimento do
--      processo, lendo do catálogo;
--   3. desativa a pergunta da modalidade no checklist do serviço 44 e o tipo
--      correspondente no catálogo do Hub.
--
-- POR QUE O CARIMBO É GATILHO DE BANCO, E NÃO CÓDIGO NA EDGE FUNCTION
-- O processo nasce por caminhos diferentes: `qa-processo-criar`, o webhook de
-- pagamento (`qa_venda_to_processo`), a criação manual pela equipe. Carimbar em
-- um só desses caminhos deixaria os outros criando processo de CR sem
-- modalidade — e sem modalidade o checklist não pede filiação ao clube nem
-- compromisso de habitualidade nem documento do Ibama, que é justamente o que
-- diferencia uma atividade da outra. Gatilho pega todos os caminhos.
--
-- O gatilho resolve a modalidade em duas tentativas, nesta ordem:
--   1. pelo SLUG do serviço contratado (via `solicitacao_id`) — funciona mesmo
--      que vários itens do catálogo apontem para o mesmo `servico_id`, que é o
--      desenho provável quando a Concessão de CR virar três itens de vitrine;
--   2. pelo `servico_id`, e SÓ quando não houver ambiguidade — se dois itens
--      ativos daquele serviço declararem modalidades diferentes, ele deixa em
--      branco em vez de chutar. Modalidade errada é pior que modalidade
--      ausente: ela faz o checklist cobrar o documento da atividade errada.
--
-- Nada é apagado: a pergunta vira `ativo = false` e continua no banco.
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) Onde a modalidade passa a morar ──────────────────────────────────────
ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS modalidade_cac text;

COMMENT ON COLUMN public.qa_servicos_catalogo.modalidade_cac IS
  'Modalidade CAC que este item de catálogo já define na compra (código de '
  'qa_modalidades). NULL = o item não fixa modalidade. Carimbada em '
  'qa_processos.modalidade pelo gatilho qa_trg_processo_modalidade_do_catalogo.';

ALTER TABLE public.qa_servicos_catalogo
  DROP CONSTRAINT IF EXISTS qa_servicos_catalogo_modalidade_cac_fkey;
ALTER TABLE public.qa_servicos_catalogo
  ADD CONSTRAINT qa_servicos_catalogo_modalidade_cac_fkey
  FOREIGN KEY (modalidade_cac) REFERENCES public.qa_modalidades(codigo);

-- ── 2) O carimbo no nascimento do processo ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_trg_processo_modalidade_do_catalogo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_mod  text;
  v_mods text[];
BEGIN
  -- Modalidade informada explicitamente (equipe corrigindo um caso) manda.
  IF NEW.modalidade IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Pelo slug do serviço contratado.
  IF NEW.solicitacao_id IS NOT NULL THEN
    SELECT c.modalidade_cac
      INTO v_mod
      FROM public.qa_solicitacoes_servico s
      JOIN public.qa_servicos_catalogo c ON c.slug = s.service_slug
     WHERE s.id = NEW.solicitacao_id
       AND c.modalidade_cac IS NOT NULL
     LIMIT 1;
  END IF;

  -- 2) Pelo servico_id, apenas quando o catálogo é unânime.
  IF v_mod IS NULL AND NEW.servico_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT c.modalidade_cac)
      INTO v_mods
      FROM public.qa_servicos_catalogo c
     WHERE c.servico_id = NEW.servico_id
       AND c.ativo
       AND c.modalidade_cac IS NOT NULL;

    IF coalesce(array_length(v_mods, 1), 0) = 1 THEN
      v_mod := v_mods[1];
    END IF;
  END IF;

  NEW.modalidade := v_mod;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_qa_processo_modalidade_do_catalogo ON public.qa_processos;
CREATE TRIGGER trg_qa_processo_modalidade_do_catalogo
BEFORE INSERT ON public.qa_processos
FOR EACH ROW EXECUTE FUNCTION public.qa_trg_processo_modalidade_do_catalogo();

-- ── 3) A pergunta sai do checklist ──────────────────────────────────────────
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE servico_id = 44
   AND tipo_documento = 'pergunta_modalidade_cac';

UPDATE public.qa_tipos_documento_catalogo
   SET ativo = false, updated_at = now()
 WHERE tipo_documento = 'pergunta_modalidade_cac';

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O checklist do CR agora começa na identidade, sem a pergunta:
--
-- SELECT ordem, tipo_documento, nome_documento,
--        regra_validacao ->> 'grupo_checklist' AS grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--  ORDER BY ordem LIMIT 3;
--
-- Esperado: 46 linhas ao todo, a primeira sendo `rg_com_cpf` (ordem 10).
--
-- 2) Quais itens de catálogo já fixam modalidade (hoje: nenhum):
--
-- SELECT slug, nome, servico_id, modalidade_cac, ativo
--   FROM public.qa_servicos_catalogo
--  WHERE categoria = 'SINARM CAC'
--  ORDER BY servico_id;
--
-- Enquanto `modalidade_cac` estiver NULL em todos, o processo de CR nasce sem
-- modalidade e as três exigências por atividade (filiação, compromisso de
-- habitualidade, documento do Ibama) NÃO entram no checklist. É de propósito:
-- é o catálogo que precisa dizer qual atividade cada item vende.
