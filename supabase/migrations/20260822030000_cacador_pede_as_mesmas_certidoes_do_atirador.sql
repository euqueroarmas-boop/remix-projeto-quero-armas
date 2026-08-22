-- =============================================================================
-- SERVIÇO 51 — AUTORIZAÇÃO DE COMPRA CAÇADOR PASSA A PEDIR AS MESMAS CERTIDÕES
-- DO SERVIÇO 50 — AUTORIZAÇÃO DE COMPRA ATIRADOR
-- -----------------------------------------------------------------------------
-- Decisão do titular, 22/08/2026: "O serviço 51 pede as mesmas certidões que o
-- serviço 50."
--
-- Isto fecha a pendência aberta em 20/08. Naquele dia o checklist do 50 foi
-- montado a partir de TRÊS dossiês deferidos (20260820220000) e o 51 ficou
-- intocado de propósito: os três dossiês eram todos de atirador, e montar o do
-- caçador por semelhança seria chute. O titular agora disse que é igual.
--
-- ─── O QUE ENTRA NO 51 ───────────────────────────────────────────────────────
--
-- As OITO certidões de idoneidade que o 50 exige hoje, copiadas LINHA A LINHA
-- do catálogo VIVO do 50 — não de literal escrito aqui. Copiar do banco, e não
-- do arquivo, é o que garante que o 51 nasça com tudo que o 50 ganhou depois
-- da montagem original: a certidão do TJM (20260820230000), a marcação
-- territorial `condicao_uf` que só pede TJM a quem mora em SP, MG ou RS
-- (20260821040000) e o prazo de 90 dias do STM (20260821030000).
--
--   1. antecedentes_eleitoral            Justiça Eleitoral (TSE)
--   2. antecedentes_militar              Justiça Militar da União (STM)
--   3. antecedentes_militar_estadual     Justiça Militar Estadual (TJM)
--   4. antecedentes_federal_trf3_regional
--   5. antecedentes_federal_sjsp_jef
--   6. antecedentes_estadual_distribuicao
--   7. antecedentes_estadual_execucoes
--   8. antecedentes_criminais            Polícia Civil (SSP)
--
-- ─── E MAIS UMA LINHA, QUE NÃO É CAPRICHO ────────────────────────────────────
--
-- `pergunta_residencia_5_anos` — "você morou sempre no mesmo endereço nos
-- últimos 5 anos?" — vem junto, copiada do 50.
--
-- Não é enfeite: a instrução da própria certidão estadual diz "uma certidão por
-- estado onde você morou nos últimos cinco anos". Sem a pergunta, o sistema
-- nunca descobre os estados anteriores e essa frase fica impossível de cumprir.
-- A certidão entraria pela metade.
--
-- A pergunta foi semeada para os serviços CAC pela 20260821130000, com uma
-- trava: só ia para quem JÁ exigia `antecedentes_estadual_distribuicao`. O 51
-- não exigia — por isso ficou de fora. Agora passa a exigir, mas aquele INSERT
-- já rodou e não roda de novo. Por isso ela é copiada aqui, explicitamente.
--
-- ─── E MAIS TRÊS, POR DECISÃO DO TITULAR EM 22/08 ────────────────────────────
--
-- O grupo "antecedentes" do 50 tem três linhas que não são certidões. Elas
-- foram propostas à parte e o titular mandou incluir: "são exigências básicas
-- do processo".
--
--   • pergunta_responde_inquerito_criminal — item 05 do dossiê deferido;
--   • declaracao_sem_inquerito_processo_criminal — a declaração que a resposta
--     "não" destrava. A condição `exige_quando` viaja dentro de
--     `regra_validacao`, junto na cópia: quem responde "sim" não é cobrado dela;
--   • declaracao_homonimia — não obrigatória. Sem ela, quando a certidão
--     estadual do caçador voltar apontando processo de alguém com nome igual ao
--     dele, a equipe não tem onde pendurar a declaração.
--
-- ─── ALCANCE ─────────────────────────────────────────────────────────────────
--
-- Mexe SÓ no catálogo do serviço 51. Nenhuma função compartilhada é tocada,
-- nenhum tipo de documento novo é criado (todos já existem no 50), a trava do
-- cofre não muda. O serviço 51 não tem NENHUM processo — conferido em 21/08 —
-- então nenhum cliente é cobrado de nada retroativamente. Quem abrir processo
-- de caçador daqui pra frente nasce com a lista completa.
--
-- Mesma regra que vale desde 20/08: catálogo não reexplode processo existente.
-- Se um dia algum processo antigo de 51 precisar ser completado, é caso a caso,
-- chamando `qa_explodir_checklist_processo(<id>)` para AQUELE processo.
--
-- Reexecutável.
-- =============================================================================

BEGIN;

DO $copia$
DECLARE
  v_cols       text;   -- para o INSERT (...): nomes secos
  v_cols_sd    text;   -- para o SELECT: prefixados com sd.
  v_certidoes  integer;
  v_criadas    integer := 0;
  v_pergunta   integer := 0;
  v_item05     integer := 0;
BEGIN
  -- ── Trava 1: o destino existe e é CAC ──────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_catalogo c
     WHERE c.servico_id = 51 AND c.ativo
       AND upper(btrim(coalesce(c.categoria,''))) = 'SINARM CAC'
  ) THEN
    RAISE EXCEPTION 'ABORTADO: servico 51 nao existe, esta inativo, ou nao e SINARM CAC no catalogo. Confira antes: SELECT servico_id, nome, categoria, ativo FROM public.qa_servicos_catalogo WHERE servico_id IN (50, 51);';
  END IF;

  -- ── Trava 2: a fonte está inteira ─────────────────────────────────────────
  -- São OITO certidões. Copiar de uma origem quebrada espalharia o defeito.
  SELECT count(*) INTO v_certidoes
    FROM public.qa_servicos_documentos sd
   WHERE sd.servico_id = 50 AND sd.ativo
     AND sd.tipo_documento LIKE 'antecedentes%';

  IF v_certidoes < 8 THEN
    RAISE EXCEPTION 'ABORTADO: o servico 50 tem % certidao(oes) ativa(s), esperado ao menos 8. Confira antes: SELECT tipo_documento, nome_documento, ativo FROM public.qa_servicos_documentos WHERE servico_id = 50 AND tipo_documento LIKE ''antecedentes%%'' ORDER BY ordem;', v_certidoes;
  END IF;

  -- ── A lista de colunas, lida do banco ─────────────────────────────────────
  -- Descoberta dinâmica de propósito: esta tabela ganhou coluna sete vezes
  -- desde julho (escopo, condicao_uf, condicao_modalidade, instrucoes,
  -- observacoes_cliente, modelo_url, obrigatorio_etapa02...). Lista escrita à
  -- mão envelhece e copia o 51 pela metade sem avisar.
  --
  -- Fora da cópia:
  --   id, created_at, updated_at → nascem sozinhos;
  --   servico_id                 → é o que muda (50 → 51);
  --   grupo_id                   → é FK e pode apontar para um grupo que
  --                                pertence AO SERVIÇO 50; tratado à parte.
  -- Duas listas da MESMA consulta: a do INSERT vai seca, a do SELECT vai
  -- prefixada com `sd.`. Sem o prefixo o SELECT fica ambíguo — `ordem`, `nome`
  -- e `ativo` existem tanto em qa_servicos_documentos quanto em
  -- qa_checklist_grupos, que entra no LEFT JOIN para resolver o grupo.
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position),
         string_agg('sd.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO v_cols, v_cols_sd
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name   = 'qa_servicos_documentos'
     AND c.column_name NOT IN ('id','servico_id','grupo_id','created_at','updated_at')
     AND c.is_generated = 'NEVER'
     AND c.identity_generation IS NULL;

  IF v_cols IS NULL OR v_cols_sd IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: nao consegui ler as colunas de qa_servicos_documentos';
  END IF;

  -- ── 1) As oito certidões ──────────────────────────────────────────────────
  EXECUTE format($sql$
    INSERT INTO public.qa_servicos_documentos (servico_id, grupo_id, %1$s)
    SELECT 51,
           -- Grupo global (servico_id NULL) segue igual. Grupo que é do
           -- serviço 50 vira o grupo de mesmo slug do 51, se existir; se não
           -- existir, fica NULL — o agrupamento na tela do cliente vem de
           -- regra_validacao->>'grupo_checklist', que é texto e foi copiado.
           CASE
             WHEN sd.grupo_id IS NULL THEN NULL
             WHEN g.servico_id IS NULL THEN sd.grupo_id
             ELSE (SELECT g2.id FROM public.qa_checklist_grupos g2
                    WHERE g2.slug = g.slug AND g2.servico_id = 51 LIMIT 1)
           END,
           %2$s
      FROM public.qa_servicos_documentos sd
      LEFT JOIN public.qa_checklist_grupos g ON g.id = sd.grupo_id
     WHERE sd.servico_id = 50
       AND sd.ativo
       AND sd.tipo_documento LIKE 'antecedentes%%'
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_servicos_documentos alvo
          WHERE alvo.servico_id = 51
            AND alvo.tipo_documento = sd.tipo_documento
            AND alvo.condicao_profissional IS NOT DISTINCT FROM sd.condicao_profissional
       )
  $sql$, v_cols, v_cols_sd);
  GET DIAGNOSTICS v_criadas = ROW_COUNT;

  -- ── 2) A pergunta dos 5 anos, que faz a certidão estadual valer ───────────
  EXECUTE format($sql$
    INSERT INTO public.qa_servicos_documentos (servico_id, grupo_id, %1$s)
    SELECT 51,
           CASE
             WHEN sd.grupo_id IS NULL THEN NULL
             WHEN g.servico_id IS NULL THEN sd.grupo_id
             ELSE (SELECT g2.id FROM public.qa_checklist_grupos g2
                    WHERE g2.slug = g.slug AND g2.servico_id = 51 LIMIT 1)
           END,
           %2$s
      FROM public.qa_servicos_documentos sd
      LEFT JOIN public.qa_checklist_grupos g ON g.id = sd.grupo_id
     WHERE sd.servico_id = 50
       AND sd.ativo
       AND sd.tipo_documento = 'pergunta_residencia_5_anos'
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_servicos_documentos alvo
          WHERE alvo.servico_id = 51
            AND alvo.tipo_documento = sd.tipo_documento
            AND alvo.condicao_profissional IS NOT DISTINCT FROM sd.condicao_profissional
       )
  $sql$, v_cols, v_cols_sd);
  GET DIAGNOSTICS v_pergunta = ROW_COUNT;

  -- ── 3) As três do item 05 e a homonímia ───────────────────────────────────
  -- Não são certidões; entram por decisão do titular em 22/08. A condição da
  -- declaração ("só quem respondeu NÃO") mora em regra_validacao->exige_quando
  -- e vem junto na cópia — não precisa ser reescrita aqui.
  EXECUTE format($sql$
    INSERT INTO public.qa_servicos_documentos (servico_id, grupo_id, %1$s)
    SELECT 51,
           CASE
             WHEN sd.grupo_id IS NULL THEN NULL
             WHEN g.servico_id IS NULL THEN sd.grupo_id
             ELSE (SELECT g2.id FROM public.qa_checklist_grupos g2
                    WHERE g2.slug = g.slug AND g2.servico_id = 51 LIMIT 1)
           END,
           %2$s
      FROM public.qa_servicos_documentos sd
      LEFT JOIN public.qa_checklist_grupos g ON g.id = sd.grupo_id
     WHERE sd.servico_id = 50
       AND sd.ativo
       AND sd.tipo_documento IN ('pergunta_responde_inquerito_criminal',
                                 'declaracao_sem_inquerito_processo_criminal',
                                 'declaracao_homonimia')
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_servicos_documentos alvo
          WHERE alvo.servico_id = 51
            AND alvo.tipo_documento = sd.tipo_documento
            AND alvo.condicao_profissional IS NOT DISTINCT FROM sd.condicao_profissional
       )
  $sql$, v_cols, v_cols_sd);
  GET DIAGNOSTICS v_item05 = ROW_COUNT;

  RAISE NOTICE 'Servico 51: % certidao(oes), % pergunta(s) de residencia e % linha(s) do item 05/homonimia. (Tudo 0 na segunda vez — ja estava la.)',
    v_criadas, v_pergunta, v_item05;
END
$copia$;

-- ── Trava 3: o resultado tem de bater ────────────────────────────────────────
-- Sai da transação se, depois da cópia, o 51 não tiver as mesmas certidões
-- ativas que o 50. Melhor não aplicar nada do que aplicar pela metade.
DO $confere$
DECLARE v_faltando text;
BEGIN
  SELECT string_agg(sd.tipo_documento, ', ' ORDER BY sd.tipo_documento)
    INTO v_faltando
    FROM public.qa_servicos_documentos sd
   WHERE sd.servico_id = 50 AND sd.ativo
     AND (sd.tipo_documento LIKE 'antecedentes%'
          OR sd.tipo_documento IN ('pergunta_responde_inquerito_criminal',
                                   'declaracao_sem_inquerito_processo_criminal',
                                   'declaracao_homonimia'))
     AND NOT EXISTS (
       SELECT 1 FROM public.qa_servicos_documentos alvo
        WHERE alvo.servico_id = 51 AND alvo.ativo
          AND alvo.tipo_documento = sd.tipo_documento
     );
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: o 51 ficou sem estas exigencias do 50: %', v_faltando;
  END IF;
END
$confere$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) Lado a lado: o que o 50 pede de certidão e o que o 51 passou a pedir.
--    Esperado: oito linhas, todas com `no_50` e `no_51` = true.
--
-- SELECT COALESCE(a.tipo_documento, b.tipo_documento) AS certidao,
--        (a.tipo_documento IS NOT NULL) AS no_50,
--        (b.tipo_documento IS NOT NULL) AS no_51,
--        a.nome_documento
--   FROM (SELECT tipo_documento, nome_documento FROM public.qa_servicos_documentos
--          WHERE servico_id = 50 AND ativo AND tipo_documento LIKE 'antecedentes%') a
--   FULL JOIN (SELECT tipo_documento FROM public.qa_servicos_documentos
--               WHERE servico_id = 51 AND ativo AND tipo_documento LIKE 'antecedentes%') b
--     ON b.tipo_documento = a.tipo_documento
--  ORDER BY 1;
--
-- B) O catálogo inteiro do 51, na ordem em que o cliente vai ver.
--
-- SELECT ordem, tipo_documento, nome_documento, obrigatorio,
--        condicao_uf, validade_dias,
--        regra_validacao->>'grupo_checklist' AS grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 51 AND ativo
--  ORDER BY ordem;
--
-- C) A marcação territorial veio junto? Esperado: TJM com {SP,MG,RS} nos DOIS
--    serviços, e as demais certidões sem marcação.
--
-- SELECT servico_id, tipo_documento, condicao_uf
--   FROM public.qa_servicos_documentos
--  WHERE servico_id IN (50, 51) AND ativo AND tipo_documento LIKE 'antecedentes%'
--  ORDER BY tipo_documento, servico_id;
--
-- D) A pergunta dos 5 anos chegou ao 51. Esperado: 50 e 51, os dois com chave
--    `residencia_5_anos`.
--
-- SELECT servico_id, tipo_documento, regra_validacao->>'chave' AS chave, ativo
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento = 'pergunta_residencia_5_anos'
--  ORDER BY servico_id;
--
-- E) As três do item 05 e a homonímia chegaram, com a condição intacta.
--    Esperado: 3 linhas; a declaração com exige_quando
--    {"responde_inquerito_criminal": "nao"} e a pergunta com as duas opções.
--
-- SELECT tipo_documento, obrigatorio,
--        regra_validacao->'exige_quando'  AS exige_quando,
--        regra_validacao->>'chave'        AS chave,
--        jsonb_array_length(regra_validacao->'opcoes') AS opcoes
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 51 AND ativo
--    AND tipo_documento IN ('pergunta_responde_inquerito_criminal',
--                           'declaracao_sem_inquerito_processo_criminal',
--                           'declaracao_homonimia')
--  ORDER BY tipo_documento;
--
-- F) Nenhum processo foi tocado. Esperado: nenhuma linha (o 51 não tem
--    processo).
--
-- SELECT p.id, p.status, count(pd.id) AS exigencias
--   FROM public.qa_processos p
--   LEFT JOIN public.qa_processo_documentos pd ON pd.processo_id = p.id
--  WHERE p.servico_id = 51
--  GROUP BY p.id, p.status;
-- =============================================================================
