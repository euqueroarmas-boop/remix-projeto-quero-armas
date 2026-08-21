-- =============================================================================
-- O BOTÃO "SINCRONIZAR" PASSA A RESPEITAR AS MESMAS REGRAS DA MONTAGEM
-- -----------------------------------------------------------------------------
-- Autorizado pelo titular em 21/08/2026: "Quero, e certifique-se do conserto
-- que deu certo."
--
-- ─── O QUE É ESSE BOTÃO ──────────────────────────────────────────────────────
--
-- Na tela de configuração do serviço (admin → documentos do serviço) existe um
-- botão que atualiza DE UMA VEZ todos os processos abertos daquele serviço para
-- refletir o catálogo. Ele chama a edge `qa-sincronizar-checklist-servico`, que
-- chama esta função.
--
-- ─── OS TRÊS DEFEITOS ────────────────────────────────────────────────────────
--
-- A função de montagem individual (`qa_explodir_checklist_processo`) foi
-- corrigida três vezes ao longo do tempo. A de sincronização em lote NÃO
-- acompanhou nenhuma das três, e as duas decidem a MESMA coisa: quais
-- exigências do catálogo valem para aquele processo.
--
-- 1) CONDIÇÃO PROFISSIONAL COM VÍRGULA. A sincronização compara com igualdade
--    exata (`sd.condicao_profissional = v_proc.condicao`). Uma exigência
--    marcada "autonomo,empresario" NUNCA casa com um processo "autonomo".
--    Efeito duplo e grave: a exigência não é adicionada E, por não aparecer no
--    conjunto do catálogo, é DISPENSADA com a mensagem "Exigência removida do
--    catálogo do serviço" — dispensa indevida de documento obrigatório que
--    está no catálogo. A montagem individual já foi corrigida disso em
--    20260812203000.
--
-- 2) MODALIDADE IGNORADA. A sincronização não olha `condicao_modalidade`.
--    Rodar no serviço de CR injetaria a Habilitação de Caçador do IBAMA como
--    pendência obrigatória em processo de ATIRADOR. A montagem individual
--    filtra desde 20260731160000.
--
-- 3) ESTADO IGNORADO. A sincronização não olha `condicao_uf`, criada ontem
--    (20260821040000). Rodar hoje devolveria a certidão do Tribunal de Justiça
--    Militar para o cliente do Paraná — exatamente a exigência impossível que
--    a correção de ontem tirou do caminho. Pior: o passo de atualização
--    sobrescreve nome e link com os do catálogo, trocando "TJPR" de volta por
--    "TJSP" e devolvendo os links de São Paulo.
--
-- ─── COMO FICA ───────────────────────────────────────────────────────────────
--
-- Em vez de repetir a regra nos quatro lugares onde ela aparece (inserir,
-- atualizar, dispensar e contar preservados) — que é justamente como as duas
-- funções se desencontraram —, a regra passa a morar em UM lugar só:
-- `qa_catalogo_do_processo(processo)`. Os quatro passos consultam essa função.
--
-- ─── ALCANCE (COMPORTAMENTO COMPARTILHADO) ───────────────────────────────────
--
-- Esta função serve TODOS os serviços. Depois desta migration o botão passa a
-- entregar o mesmo resultado da montagem individual — que é o resultado certo.
-- Ninguém perde documento já enviado: os passos que dispensam continuam
-- ignorando qualquer linha com arquivo ou já resolvida.
--
-- MUDANÇA A MAIS, declarada: o laço passa a pular também processo
-- `excluido_lgpd`, que hoje ele alcança. Escrever em processo cujo titular
-- pediu exclusão é o oposto do que a LGPD manda, e a montagem individual já
-- não os toca.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) A regra, em um lugar só ──────────────────────────────────────────────
-- Devolve as exigências do catálogo que valem para ESTE processo, já com o
-- nome e o link do estado do cliente. É a mesma regra de
-- qa_explodir_checklist_processo — as duas mudam juntas.
CREATE OR REPLACE FUNCTION public.qa_catalogo_do_processo(p_processo_id uuid)
RETURNS TABLE (
  tipo_documento         text,
  nome_documento         text,
  etapa                  text,
  validade_dias          integer,
  formato_aceito         text[],
  regra_validacao        jsonb,
  link_emissao           text,
  instrucoes             text,
  observacoes_cliente    text,
  modelo_url             text,
  exemplo_url            text,
  orgao_emissor          text,
  prazo_recomendado_dias integer,
  obrigatorio            boolean,
  escopo                 text,
  ordem                  integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc       public.qa_processos%ROWTYPE;
  v_cli        public.qa_clientes%ROWTYPE;
  v_condicao   text;
  v_modalidade text;
  v_uf         text;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao   := lower(btrim(COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido')));
  v_modalidade := NULLIF(TRIM(LOWER(COALESCE(v_proc.modalidade, ''))), '');
  v_uf         := public.qa_uf_normalizar(v_cli.estado);

  RETURN QUERY
  SELECT sd.tipo_documento,
         -- Nome, órgão e link do tribunal do estado do cliente; fora das
         -- certidões territoriais as funções devolvem NULL e o catálogo
         -- prevalece. Para cliente de São Paulo nada muda.
         COALESCE(public.qa_certidao_texto_por_uf(sd.nome_documento, sd.tipo_documento, v_uf),
                  sd.nome_documento),
         sd.etapa,
         sd.validade_dias,
         sd.formato_aceito,
         sd.regra_validacao,
         COALESCE(public.qa_certidao_link_por_uf(sd.tipo_documento, v_uf), sd.link_emissao),
         sd.instrucoes,
         sd.observacoes_cliente,
         sd.modelo_url,
         sd.exemplo_url,
         COALESCE(public.qa_certidao_texto_por_uf(sd.orgao_emissor, sd.tipo_documento, v_uf),
                  sd.orgao_emissor),
         sd.prazo_recomendado_dias,
         sd.obrigatorio,
         sd.escopo,
         sd.ordem
    FROM public.qa_servicos_documentos sd
   WHERE sd.servico_id = v_proc.servico_id
     AND sd.ativo = true
     -- DEFEITO 1: condição profissional aceita lista separada por vírgula
     -- ("autonomo,empresario"). Mesma regra de qa_explodir_checklist_processo.
     AND (sd.condicao_profissional IS NULL
          OR v_condicao = ANY (
               SELECT btrim(lower(x))
                 FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
             ))
     -- DEFEITO 2: modalidade (atirador, caçador, colecionador).
     AND (sd.condicao_modalidade IS NULL
          OR v_modalidade IS NULL
          OR v_modalidade = ANY(sd.condicao_modalidade))
     -- DEFEITO 3: exigência territorial. UF desconhecida não filtra nada.
     AND (sd.condicao_uf IS NULL
          OR v_uf IS NULL
          OR v_uf = ANY(sd.condicao_uf));
END;
$function$;

COMMENT ON FUNCTION public.qa_catalogo_do_processo(uuid) IS
  'Exigências do catálogo que valem para um processo: filtra por condição '
  'profissional (aceita lista com vírgula), modalidade e UF de residência, e '
  'devolve nome/link já resolvidos pelo estado do cliente. Fonte única da '
  'regra, compartilhada com qa_sincronizar_checklist_processos_servico.';

GRANT EXECUTE ON FUNCTION public.qa_catalogo_do_processo(uuid) TO authenticated, service_role;

-- ─── 2) O botão passa a usar a regra ─────────────────────────────────────────
-- Cópia da definição vigente (20260804163338) com as quatro consultas de
-- catálogo trocadas por qa_catalogo_do_processo e o laço pulando excluido_lgpd.
-- Nenhuma outra regra da função foi tocada: os passos de dispensa continuam
-- preservando linha com arquivo ou já resolvida, e os contadores são os mesmos.
CREATE OR REPLACE FUNCTION public.qa_sincronizar_checklist_processos_servico(p_servico_id integer)
 RETURNS TABLE(processos_processados integer, exigencias_adicionadas integer, exigencias_atualizadas integer, exigencias_arquivadas integer, documentos_preservados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proc       RECORD;
  v_ins_total  int := 0;
  v_upd_total  int := 0;
  v_arq_total  int := 0;
  v_pres_total int := 0;
  v_procs_total int := 0;
  v_ins_proc   int;
  v_upd_proc   int;
  v_arq_proc   int;
  v_pres_proc  int;
  v_now_txt    text := to_char(now(),'YYYY-MM-DD HH24:MI');
BEGIN
  FOR v_proc IN
    SELECT p.id, p.cliente_id
      FROM public.qa_processos p
      JOIN public.qa_clientes cl ON cl.id = p.cliente_id
     WHERE p.servico_id = p_servico_id
       -- MUDANÇA DECLARADA: só processo que ainda está montando dossiê.
       -- A lista antiga era NOT IN ('concluido','cancelado','excluido_lgpd'):
       -- deixava passar protocolado, deferido, indeferido, notificado e em
       -- recurso — dossiê já entregue à PF era reescrito — e 'excluido_lgpd'
       -- nem sequer é status de processo (é de cliente), então era inerte.
       AND p.status IN ('aguardando_pagamento','aguardando_assinatura',
                        'aguardando_documentos','em_validacao','pendente_cliente',
                        'revisao_humana','validado','pagamento_confirmado',
                        'em_analise_interna')
       AND COALESCE(cl.status, '') <> 'excluido_lgpd'
  LOOP
    v_procs_total := v_procs_total + 1;

    WITH desejados AS (
      SELECT * FROM public.qa_catalogo_do_processo(v_proc.id)
    ),
    inserted AS (
      INSERT INTO public.qa_processo_documentos (
        processo_id, cliente_id, tipo_documento, nome_documento, etapa,
        status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
        instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor, prazo_recomendado_dias, ordem
      )
      SELECT v_proc.id, v_proc.cliente_id, d.tipo_documento, d.nome_documento, d.etapa,
             'pendente', COALESCE(d.obrigatorio, true), d.validade_dias, d.formato_aceito,
             d.regra_validacao, d.link_emissao,
             d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
             d.orgao_emissor, d.prazo_recomendado_dias, d.ordem
        FROM desejados d
       WHERE NOT EXISTS (
         SELECT 1 FROM public.qa_processo_documentos pd
          WHERE pd.processo_id = v_proc.id
            AND pd.tipo_documento = d.tipo_documento
       )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_ins_proc FROM inserted;

    WITH desejados AS (
      SELECT * FROM public.qa_catalogo_do_processo(v_proc.id)
    ),
    upd AS (
      UPDATE public.qa_processo_documentos pd
         SET nome_documento = d.nome_documento,
             etapa          = d.etapa,
             validade_dias  = d.validade_dias,
             formato_aceito = d.formato_aceito,
             regra_validacao = d.regra_validacao,
             link_emissao    = d.link_emissao,
             instrucoes      = d.instrucoes,
             observacoes_cliente = d.observacoes_cliente,
             modelo_url      = d.modelo_url,
             exemplo_url     = d.exemplo_url,
             orgao_emissor   = d.orgao_emissor,
             prazo_recomendado_dias = d.prazo_recomendado_dias,
             ordem           = d.ordem,
             obrigatorio     = COALESCE(d.obrigatorio, pd.obrigatorio),
             updated_at      = now()
        FROM desejados d
       WHERE pd.processo_id = v_proc.id
         AND pd.tipo_documento = d.tipo_documento
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_upd_proc FROM upd;

    WITH cat AS (
      SELECT d.tipo_documento FROM public.qa_catalogo_do_processo(v_proc.id) d
    ),
    arq AS (
      UPDATE public.qa_processo_documentos pd
         SET status = 'nao_aplicavel',
             observacoes = COALESCE(pd.observacoes,'') ||
                           CASE WHEN COALESCE(pd.observacoes,'')='' THEN '' ELSE E'\n' END ||
                           '[' || v_now_txt || '] Exigência removida do catálogo do serviço — dispensada automaticamente.',
             campos_complementares_json = COALESCE(pd.campos_complementares_json,'{}'::jsonb)
               || jsonb_build_object(
                    'removido_do_catalogo', true,
                    'removido_em', now(),
                    'motivo', 'Exigência removida do catálogo do serviço',
                    'status_anterior', pd.status
                  ),
             updated_at = now()
       WHERE pd.processo_id = v_proc.id
         AND NOT EXISTS (SELECT 1 FROM cat c WHERE c.tipo_documento = pd.tipo_documento)
         -- "Tem arquivo" é qualquer um dos DOIS campos: é assim que a trava do
         -- banco e a tela do Admin decidem. Olhar só storage_key deixava a
         -- linha legada, gravada em arquivo_url, virar não-aplicável — o
         -- documento entregue sumia do checklist.
         AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
         AND pd.status NOT IN ('aprovado','validado','conforme','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','nao_aplicavel','concluido','concluído','entregue','entregue_pelo_hub')
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_arq_proc FROM arq;

    SELECT COUNT(*) INTO v_pres_proc
      FROM public.qa_processo_documentos pd
     WHERE pd.processo_id = v_proc.id
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_catalogo_do_processo(v_proc.id) d
          WHERE d.tipo_documento = pd.tipo_documento
       )
       AND (pd.arquivo_storage_key IS NOT NULL
            OR pd.status IN ('aprovado','validado','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','concluido','concluído'));

    v_ins_total  := v_ins_total  + COALESCE(v_ins_proc,0);
    v_upd_total  := v_upd_total  + COALESCE(v_upd_proc,0);
    v_arq_total  := v_arq_total  + COALESCE(v_arq_proc,0);
    v_pres_total := v_pres_total + COALESCE(v_pres_proc,0);

    IF COALESCE(v_ins_proc,0) + COALESCE(v_upd_proc,0) + COALESCE(v_arq_proc,0) > 0 THEN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      VALUES (
        v_proc.id, 'checklist_sincronizado_com_catalogo',
        format('Sincronizado com catálogo do serviço %s: %s adicionadas, %s atualizadas, %s arquivadas, %s preservadas com arquivo.',
               p_servico_id, COALESCE(v_ins_proc,0), COALESCE(v_upd_proc,0),
               COALESCE(v_arq_proc,0), COALESCE(v_pres_proc,0)),
        'equipe'
      );
    END IF;
  END LOOP;

  processos_processados   := v_procs_total;
  exigencias_adicionadas  := v_ins_total;
  exigencias_atualizadas  := v_upd_total;
  exigencias_arquivadas   := v_arq_total;
  documentos_preservados  := v_pres_total;
  RETURN NEXT;
END $function$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) A função da regra única existe. Esperado: 1 linha.
--
-- SELECT p.proname
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname='public' AND p.proname='qa_catalogo_do_processo';
--
-- B) Prova sem alterar nada: para cada processo aberto, o que o catálogo manda
--    x o que o processo tem. Não escreve; só mostra.
--    Espera-se que NENHUM processo de cliente fora de SP/MG/RS apareça com o
--    TJM na coluna "sobrando_no_processo".
--
-- SELECT cl.nome_completo, cl.estado, p.servico_id, p.modalidade,
--        (SELECT count(*) FROM public.qa_catalogo_do_processo(p.id)) AS manda_o_catalogo,
--        (SELECT count(*) FROM public.qa_processo_documentos pd
--          WHERE pd.processo_id = p.id) AS tem_o_processo,
--        (SELECT string_agg(pd.tipo_documento, ', ')
--           FROM public.qa_processo_documentos pd
--          WHERE pd.processo_id = p.id
--            AND pd.status NOT IN ('nao_aplicavel','dispensado_grupo',
--                                  'dispensado_por_reaproveitamento')
--            AND NOT EXISTS (SELECT 1 FROM public.qa_catalogo_do_processo(p.id) d
--                             WHERE d.tipo_documento = pd.tipo_documento)
--        ) AS sobrando_no_processo
--   FROM public.qa_processos p
--   JOIN public.qa_clientes cl ON cl.id = p.cliente_id
--  WHERE p.status NOT IN ('concluido','cancelado','excluido_lgpd')
--    AND p.servico_id IN (44, 50, 60)
--  ORDER BY cl.estado, p.servico_id;
--
-- C) Teste seco do filtro, sem tocar em processo nenhum: o que o catálogo do
--    serviço 50 manda para um processo específico.
--    Troque o UUID pelo processo que quiser conferir.
--
-- SELECT tipo_documento, nome_documento, link_emissao
--   FROM public.qa_catalogo_do_processo('COLE-AQUI-O-UUID-DO-PROCESSO'::uuid)
--  ORDER BY ordem;
-- =============================================================================
