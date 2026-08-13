-- =============================================================================
-- FIX: trilha dos exames da instituicao estava desligada com a pergunta viva
--
-- `exames_instituicao_definir` estava ATIVA nos 11 servicos, mas os dois
-- atestados da instituicao estavam `ativo = false` em TODOS eles.
--
-- Como responder "sim" dispensa os laudos de credenciado da PF (via
-- `dispensa_quando`) e os atestados da instituicao nunca sao criados no
-- processo (a explosao do checklist so insere catalogo com `ativo = true`, e
-- `qa-processo-responder-pergunta` apenas atualiza status de linhas existentes,
-- nunca insere), o cliente de seguranca publica que escolhesse a instituicao
-- ficaria SEM NENHUMA exigencia de exame: laudo psicologico e capacidade
-- tecnica sumiriam do processo. Dois documentos exigidos pela Lei 10.826/03.
--
-- A migration 20260803205006 ja havia configurado `exige_quando`, grupo, ordem
-- e ativado esses itens. Foram desativados depois, fora de migration (pelo
-- admin). Isto restaura o estado pretendido.
--
-- Verificado antes de aplicar: nenhum processo tinha
-- respostas_questionario_json ->> 'exames_instituicao' = 'sim', ou seja,
-- nenhum cliente chegou a cair no buraco. Nao ha processo a remediar.
--
-- Reexecutavel: os UPDATEs sao idempotentes e o backfill so cria linha que
-- ainda nao existe (a funcao de explosao e aditiva).
-- =============================================================================

BEGIN;

-- 1) Reativa os atestados e regrava a regra, espelhando a migration de 03/08.
--    Regravar o `exige_quando` no MESMO comando e proposital: se a regra
--    tivesse sido apagada junto com o `ativo`, ligar o item sozinho faria os
--    atestados aparecerem para TODO cliente de seguranca publica, inclusive
--    quem escolheu credenciado da PF.
WITH pivo AS (
  SELECT servico_id,
         COALESCE(regra_validacao ->> 'grupo_checklist', 'laudos')          AS grupo,
         COALESCE((regra_validacao ->> 'ordem_grupo_checklist')::int, 60)   AS ordem_grupo,
         ordem                                                             AS ordem_pivo
    FROM public.qa_servicos_documentos
   WHERE tipo_documento = 'exames_instituicao_definir'
     AND ativo = true
)
UPDATE public.qa_servicos_documentos d
   SET regra_validacao = COALESCE(d.regra_validacao, '{}'::jsonb)
         || jsonb_build_object(
              'grupo_checklist',       p.grupo,
              'ordem_grupo_checklist', p.ordem_grupo,
              'exige_quando',          jsonb_build_object('exames_instituicao', 'sim')
            ),
       condicao_profissional = 'seguranca_publica',
       ativo = true,
       ordem = p.ordem_pivo + CASE
                 WHEN d.tipo_documento = 'atestado_aptidao_psicologica_instituicao' THEN 1
                 ELSE 2 END,
       updated_at = now()
  FROM pivo p
 WHERE d.servico_id = p.servico_id
   AND d.tipo_documento IN ('atestado_aptidao_psicologica_instituicao',
                            'atestado_capacidade_tecnica_instituicao');

-- 2) Garante que os laudos de credenciado saem quando a resposta for "sim".
WITH pivo AS (
  SELECT DISTINCT servico_id
    FROM public.qa_servicos_documentos
   WHERE tipo_documento = 'exames_instituicao_definir'
     AND ativo = true
)
UPDATE public.qa_servicos_documentos d
   SET regra_validacao = COALESCE(d.regra_validacao, '{}'::jsonb)
         || jsonb_build_object('dispensa_quando',
              jsonb_build_object('exames_instituicao', 'sim')),
       updated_at = now()
  FROM pivo p
 WHERE d.servico_id = p.servico_id
   AND d.tipo_documento IN ('laudo_psicologico', 'laudo_capacidade_tecnica');

-- 3) Cria as linhas nos processos de seguranca publica que ja existem, para
--    quem ja respondeu poder TROCAR de ideia sem ficar sem exigencia.
--    A explosao cria tudo como `pendente`, e a rotina de resposta so ajusta o
--    que ja existia quando o cliente respondeu — por isso reaplicamos a
--    resposta ja registrada logo em seguida.
DO $trilha$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id,
           p.respostas_questionario_json ->> 'exames_instituicao' AS resposta
      FROM public.qa_processos p
     WHERE lower(COALESCE(p.condicao_profissional, '')) = 'seguranca_publica'
       AND COALESCE(p.status, 'ativo') NOT IN
           ('finalizado','deferido','indeferido','cancelado','arquivado')
  LOOP
    PERFORM public.qa_explodir_checklist_processo(r.id);
    IF r.resposta IS NOT NULL AND r.resposta <> 'sim' THEN
      UPDATE public.qa_processo_documentos
         SET status = 'dispensado_grupo', updated_at = now()
       WHERE processo_id = r.id
         AND tipo_documento IN ('atestado_aptidao_psicologica_instituicao',
                                'atestado_capacidade_tecnica_instituicao')
         AND status = 'pendente';
    END IF;
  END LOOP;
END
$trilha$;

COMMIT;
