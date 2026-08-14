-- =============================================================================
-- DIAGNÓSTICO — duplicidade de cadastro criada pelo login social
--
-- SOMENTE SELECT. Não altera nada. Seguro em produção.
-- Cole um bloco por vez no SQL editor (Cloud → SQL editor).
-- =============================================================================
--
-- O QUE ESTAMOS PROCURANDO
--
-- Quando o cliente entra com Google/Apple usando um e-mail DIFERENTE daquele
-- onde recebeu o contrato, nenhuma chave de vínculo casa:
--   • o trigger `qa_auto_link_auth_user` tenta e-mail e celular — o Google não
--     manda telefone e o e-mail é outro;
--   • o fallback por CPF (`qa_vincular_por_cpf`) só é oferecido na TELA de
--     login, e o fluxo de redirect do Google não passa por ela;
--   • sobra a rede final `qa_ensure_cliente_from_auth` que, sem CPF e sem
--     e-mail batendo, CRIA UM CLIENTE NOVO.
--
-- A assinatura no banco é um PAR:
--   DUPLICADO → origem='portal_cliente', tipo_cliente='cliente_app',
--               user_id preenchido, CPF vazio, ZERO venda/processo/documento.
--   ÓRFÃO     → o cadastro verdadeiro, portal provisionado, mas user_id NULL:
--               ninguém nunca vinculou uma conta de login a ele.
--
-- ORDEM DE USO
--   Bloco 1 responde em segundos se o problema existe. Se vier tudo zero,
--   pode parar. Blocos 2 e 3 mostram cada lado. O bloco 4 é o que a equipe
--   usa: entrega os pares prontos para vincular à mão.
--
-- SOBRE O CASAMENTO POR NOME
--   O duplicado nasce com o nome do perfil Google, que costuma ser mais curto
--   que o do cadastro ("Willian Massaroto" x "WILLIAN MASSAROTO DA SILVA").
--   Por isso comparamos também primeiro nome + último sobrenome e marcamos a
--   força em `match_por`. Trate `nome_parcial` como indício a conferir, nunca
--   como certeza — homônimo existe.
-- =============================================================================


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOCO 1 — RESUMO: o problema existe? Em que tamanho?
-- ═════════════════════════════════════════════════════════════════════════════
WITH base AS (
  SELECT
    c.id,
    c.user_id,
    c.origem,
    c.portal_provisionado_em,
    regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g')                              AS cpf_norm,
    (SELECT count(*) FROM public.qa_vendas            v WHERE v.cliente_id    = c.id) AS qt_vendas,
    (SELECT count(*) FROM public.qa_processos         p WHERE p.cliente_id    = c.id) AS qt_processos,
    (SELECT count(*) FROM public.qa_documentos_cliente d WHERE d.qa_cliente_id = c.id) AS qt_documentos,
    (SELECT count(*) FROM public.cliente_auth_links    l WHERE l.qa_cliente_id = c.id
                                                          AND l.status = 'active')    AS qt_vinculos
  FROM public.qa_clientes c
  WHERE coalesce(c.excluido, false) = false
    AND coalesce(c.status, '')     <> 'excluido_lgpd'
)
SELECT
  count(*)                                                                    AS total_clientes_ativos,
  count(*) FILTER (
    WHERE origem = 'portal_cliente' AND user_id IS NOT NULL
      AND qt_vendas = 0 AND qt_processos = 0 AND qt_documentos = 0
  )                                                                           AS duplicados_suspeitos,
  count(*) FILTER (
    WHERE origem = 'portal_cliente' AND user_id IS NOT NULL AND cpf_norm = ''
      AND qt_vendas = 0 AND qt_processos = 0 AND qt_documentos = 0
  )                                                                           AS duplicados_sem_cpf,
  count(*) FILTER (WHERE portal_provisionado_em IS NOT NULL AND user_id IS NULL)
                                                                              AS orfaos_provisionados,
  count(*) FILTER (
    WHERE user_id IS NULL AND qt_vinculos = 0 AND (qt_vendas > 0 OR qt_processos > 0)
  )                                                                           AS reais_sem_nenhum_login
FROM base;


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOCO 2 — DUPLICADOS: cadastros vazios criados pelo portal, e com quem colidem
-- ═════════════════════════════════════════════════════════════════════════════
WITH base AS (
  SELECT
    c.id, c.nome_completo, c.cpf, c.email, c.celular, c.user_id,
    c.origem, c.tipo_cliente, c.created_at, c.portal_provisionado_em,
    upper(btrim(regexp_replace(regexp_replace(
      translate(coalesce(c.nome_completo, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Za-z ]', '', 'g'), '\s+', ' ', 'g')))                              AS nome_norm,
    regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g')                          AS cpf_norm,
    (SELECT count(*) FROM public.qa_vendas            v WHERE v.cliente_id    = c.id) AS qt_vendas,
    (SELECT count(*) FROM public.qa_processos         p WHERE p.cliente_id    = c.id) AS qt_processos,
    (SELECT count(*) FROM public.qa_documentos_cliente d WHERE d.qa_cliente_id = c.id) AS qt_documentos
  FROM public.qa_clientes c
  WHERE coalesce(c.excluido, false) = false
    AND coalesce(c.status, '')     <> 'excluido_lgpd'
),
marcado AS (
  SELECT b.*,
    (b.qt_vendas = 0 AND b.qt_processos = 0 AND b.qt_documentos = 0)          AS vazio,
    split_part(b.nome_norm, ' ', 1)                                            AS primeiro_nome,
    reverse(split_part(reverse(b.nome_norm), ' ', 1))                          AS ultimo_nome
  FROM base b
)
SELECT
  CASE
    WHEN d.cpf_norm <> '' AND d.cpf_norm = r.cpf_norm THEN 'cpf'
    WHEN d.nome_norm = r.nome_norm                    THEN 'nome_exato'
    ELSE                                                   'nome_parcial'
  END                          AS match_por,
  d.id                         AS duplicado_id,
  d.nome_completo              AS duplicado_nome,
  d.email                      AS duplicado_email,
  d.created_at                 AS duplicado_criado_em,
  d.user_id                    AS duplicado_user_id,
  r.id                         AS cadastro_real_id,
  r.nome_completo              AS real_nome,
  r.email                      AS real_email,
  r.cpf                        AS real_cpf,
  r.celular                    AS real_celular,
  r.user_id                    AS real_user_id,
  r.portal_provisionado_em     AS real_portal_provisionado_em,
  r.qt_vendas                  AS real_vendas,
  r.qt_processos               AS real_processos,
  r.qt_documentos              AS real_documentos
FROM marcado d
JOIN marcado r
  ON  r.id <> d.id
  -- o outro lado precisa parecer cadastro de verdade
  AND (r.qt_vendas > 0 OR r.qt_processos > 0 OR r.qt_documentos > 0
       OR r.portal_provisionado_em IS NOT NULL)
  AND (
        (d.cpf_norm <> '' AND d.cpf_norm = r.cpf_norm)
     OR (d.nome_norm <> '' AND d.nome_norm = r.nome_norm)
     OR (d.primeiro_nome <> '' AND d.ultimo_nome <> ''
         AND d.primeiro_nome <> d.ultimo_nome        -- evita nome de 1 palavra
         AND d.primeiro_nome = r.primeiro_nome
         AND d.ultimo_nome   = r.ultimo_nome)
      )
WHERE d.origem      = 'portal_cliente'
  AND d.user_id IS NOT NULL
  AND d.vazio
ORDER BY
  CASE WHEN d.cpf_norm <> '' AND d.cpf_norm = r.cpf_norm THEN 1
       WHEN d.nome_norm = r.nome_norm                    THEN 2
       ELSE 3 END,
  d.created_at DESC;


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOCO 3 — ÓRFÃOS: cadastro real com portal provisionado que nunca vinculou login
-- ═════════════════════════════════════════════════════════════════════════════
WITH base AS (
  SELECT
    c.id, c.nome_completo, c.cpf, c.email, c.celular, c.user_id,
    c.portal_provisionado_em, c.portal_credenciais_enviadas_em, c.created_at,
    (SELECT count(*) FROM public.qa_vendas            v WHERE v.cliente_id    = c.id) AS qt_vendas,
    (SELECT count(*) FROM public.qa_processos         p WHERE p.cliente_id    = c.id) AS qt_processos,
    (SELECT count(*) FROM public.qa_documentos_cliente d WHERE d.qa_cliente_id = c.id) AS qt_documentos,
    (SELECT count(*) FROM public.cliente_auth_links    l WHERE l.qa_cliente_id = c.id
                                                          AND l.status = 'active')    AS qt_vinculos
  FROM public.qa_clientes c
  WHERE coalesce(c.excluido, false) = false
    AND coalesce(c.status, '')     <> 'excluido_lgpd'
)
SELECT
  id, nome_completo, cpf, email, celular,
  portal_provisionado_em, portal_credenciais_enviadas_em,
  qt_vendas, qt_processos, qt_documentos
FROM base
WHERE user_id IS NULL
  AND qt_vinculos = 0
  AND (portal_provisionado_em IS NOT NULL OR qt_vendas > 0 OR qt_processos > 0)
ORDER BY portal_provisionado_em DESC NULLS LAST, created_at DESC;


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOCO 4 — PARES ACIONÁVEIS: órfão + duplicado do mesmo titular
--
-- Esta é a lista de trabalho. Cada linha é: "este cadastro real ficou sem
-- login, e existe esta conta órfã vazia que provavelmente é a mesma pessoa".
-- CONFIRA cada par antes de vincular — principalmente os `nome_parcial`.
-- ═════════════════════════════════════════════════════════════════════════════
WITH base AS (
  SELECT
    c.id, c.nome_completo, c.cpf, c.email, c.celular, c.user_id,
    c.origem, c.created_at, c.portal_provisionado_em,
    upper(btrim(regexp_replace(regexp_replace(
      translate(coalesce(c.nome_completo, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Za-z ]', '', 'g'), '\s+', ' ', 'g')))                              AS nome_norm,
    regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g')                          AS cpf_norm,
    (SELECT count(*) FROM public.qa_vendas            v WHERE v.cliente_id    = c.id) AS qt_vendas,
    (SELECT count(*) FROM public.qa_processos         p WHERE p.cliente_id    = c.id) AS qt_processos,
    (SELECT count(*) FROM public.qa_documentos_cliente d WHERE d.qa_cliente_id = c.id) AS qt_documentos,
    (SELECT count(*) FROM public.cliente_auth_links    l WHERE l.qa_cliente_id = c.id
                                                          AND l.status = 'active')    AS qt_vinculos
  FROM public.qa_clientes c
  WHERE coalesce(c.excluido, false) = false
    AND coalesce(c.status, '')     <> 'excluido_lgpd'
),
marcado AS (
  SELECT b.*,
    (b.qt_vendas = 0 AND b.qt_processos = 0 AND b.qt_documentos = 0)          AS vazio,
    split_part(b.nome_norm, ' ', 1)                                            AS primeiro_nome,
    reverse(split_part(reverse(b.nome_norm), ' ', 1))                          AS ultimo_nome
  FROM base b
)
SELECT
  CASE
    WHEN dup.cpf_norm <> '' AND dup.cpf_norm = orf.cpf_norm THEN 'cpf'
    WHEN dup.nome_norm = orf.nome_norm                      THEN 'nome_exato'
    ELSE                                                         'nome_parcial'
  END                            AS confianca,
  orf.id                         AS cadastro_real_id,
  orf.nome_completo              AS real_nome,
  orf.cpf                        AS real_cpf,
  orf.email                      AS real_email_do_contrato,
  orf.celular                    AS real_celular,
  orf.qt_vendas                  AS real_vendas,
  orf.qt_processos               AS real_processos,
  orf.qt_documentos              AS real_documentos,
  dup.id                         AS conta_orfa_id,
  dup.email                      AS email_usado_no_login_social,
  dup.user_id                    AS auth_user_id_a_vincular,
  dup.created_at                 AS login_social_em
FROM marcado orf
JOIN marcado dup
  ON  dup.id <> orf.id
  AND dup.origem  = 'portal_cliente'
  AND dup.user_id IS NOT NULL
  AND dup.vazio
  AND (
        (dup.cpf_norm <> '' AND dup.cpf_norm = orf.cpf_norm)
     OR (dup.nome_norm <> '' AND dup.nome_norm = orf.nome_norm)
     OR (dup.primeiro_nome <> '' AND dup.ultimo_nome <> ''
         AND dup.primeiro_nome <> dup.ultimo_nome
         AND dup.primeiro_nome = orf.primeiro_nome
         AND dup.ultimo_nome   = orf.ultimo_nome)
      )
WHERE orf.user_id IS NULL
  AND orf.qt_vinculos = 0
  AND (orf.qt_vendas > 0 OR orf.qt_processos > 0 OR orf.portal_provisionado_em IS NOT NULL)
ORDER BY
  CASE WHEN dup.cpf_norm <> '' AND dup.cpf_norm = orf.cpf_norm THEN 1
       WHEN dup.nome_norm = orf.nome_norm                      THEN 2
       ELSE 3 END,
  dup.created_at DESC;


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOCO 5 — Os "reais sem nenhum login": por que essas pessoas não têm acesso?
--
-- Rode quando o bloco 1 acusar `reais_sem_nenhum_login` > 0.
-- Não é o furo do login social (aquele deixa cadastro duplicado para trás).
-- Aqui a pergunta é outra: o cliente tem venda ou processo e NUNCA teve conta.
--
-- O provisionamento do portal dispara pelo trigger
-- `qa_vendas_provisionar_portal_on_pago`, que só roda quando a venda entra em
-- status 'PAGO'. Então a coluna `veredito` separa os dois mundos:
--   • sem venda paga → esperado, o provisionamento nem devia ter rodado
--     (cadastro da equipe, importação legada, venda ainda em aberto);
--   • pagou e não foi provisionado → aí sim é falha, investigar.
-- `portal_ultimo_envio_status` / `portal_ultimo_envio_erro` mostram se houve
-- tentativa de envio das credenciais e no que ela deu.
-- ═════════════════════════════════════════════════════════════════════════════
WITH base AS (
  SELECT
    c.id, c.nome_completo, c.cpf, c.email, c.celular, c.created_at,
    c.user_id, c.origem, c.tipo_cliente, c.id_legado,
    c.portal_provisionado_em, c.portal_credenciais_enviadas_em,
    c.portal_ultimo_envio_status, c.portal_ultimo_envio_erro,
    (SELECT count(*) FROM public.qa_vendas v
      WHERE v.cliente_id = c.id)                                              AS qt_vendas,
    (SELECT count(*) FROM public.qa_vendas v
      WHERE v.cliente_id = c.id
        AND upper(coalesce(v.status, '')) = 'PAGO')                           AS qt_vendas_pagas,
    (SELECT max(v.created_at) FROM public.qa_vendas v
      WHERE v.cliente_id = c.id
        AND upper(coalesce(v.status, '')) = 'PAGO')                           AS ultima_venda_paga_em,
    (SELECT count(*) FROM public.qa_processos p
      WHERE p.cliente_id = c.id)                                              AS qt_processos,
    (SELECT count(*) FROM public.qa_documentos_cliente d
      WHERE d.qa_cliente_id = c.id)                                           AS qt_documentos,
    (SELECT count(*) FROM public.cliente_auth_links l
      WHERE l.qa_cliente_id = c.id AND l.status = 'active')                   AS qt_vinculos
  FROM public.qa_clientes c
  WHERE coalesce(c.excluido, false) = false
    AND coalesce(c.status, '')     <> 'excluido_lgpd'
)
SELECT
  CASE
    WHEN qt_vendas_pagas = 0            THEN 'ok - sem venda paga, provisionamento nao devia rodar'
    WHEN portal_provisionado_em IS NULL THEN 'FALHA - pagou e nao foi provisionado'
    ELSE                                     'FALHA - provisionado mas ficou sem vinculo'
  END                                   AS veredito,
  id, nome_completo, cpf, email, celular,
  qt_vendas, qt_vendas_pagas, ultima_venda_paga_em,
  qt_processos, qt_documentos,
  portal_provisionado_em, portal_credenciais_enviadas_em,
  portal_ultimo_envio_status, portal_ultimo_envio_erro,
  origem, tipo_cliente, id_legado, created_at
FROM base
WHERE user_id IS NULL
  AND qt_vinculos = 0
  AND (qt_vendas > 0 OR qt_processos > 0)
ORDER BY qt_vendas_pagas DESC, created_at DESC;
