-- ============================================================================
-- AUDITORIA COMPLETA — IGOR ANTONINO FERREIRA DA SILVA
-- CPF 459.305.848-18 · igorb26@outlook.com
-- ----------------------------------------------------------------------------
-- O "#0059" do painel NÃO é o id interno da tabela (id 59 não existe).
-- Esta versão acha o cliente sozinha, por CPF, e-mail ou nome (CTE "alvo"),
-- e roda a auditoria inteira em cima do(s) id(s) encontrado(s).
-- Um único SELECT, somente leitura. Cada linha sai com o nome do bloco
-- ("00_alvo", "01_cliente", "16_checklist_processo", …) e o registro em JSON.
-- Rodar tudo de uma vez e devolver o resultado COMPLETO (Export → CSV/JSON).
-- Campos de senha (senha_temporaria, senha_gov_*) ficam de fora do resultado.
-- ============================================================================

WITH alvo AS (
  SELECT c.id
    FROM public.qa_clientes c
   WHERE regexp_replace(coalesce(c.cpf,''), '\D', '', 'g') = '45930584818'
      OR lower(coalesce(c.email,'')) = 'igorb26@outlook.com'
      OR c.nome_completo ILIKE '%IGOR ANTONINO FERREIRA%'
)

SELECT '00_alvo' AS bloco,
       jsonb_build_object('cliente_id', c.id, 'id_legado', c.id_legado,
                          'nome', c.nome_completo, 'cpf', c.cpf,
                          'email', c.email, 'status', c.status,
                          'created_at', c.created_at) AS dado
  FROM public.qa_clientes c
 WHERE c.id IN (SELECT id FROM alvo)

UNION ALL
SELECT '01_cliente',
       to_jsonb(c) - 'senha_temporaria' - 'senha_temporaria_expira_em'
  FROM public.qa_clientes c
 WHERE c.id IN (SELECT id FROM alvo)

UNION ALL
SELECT '02_cadastro_publico', to_jsonb(cp) - 'consentimento_texto'
  FROM public.qa_cadastro_publico cp
 WHERE cp.cliente_id_vinculado IN (SELECT id FROM alvo)
    OR regexp_replace(coalesce(cp.cpf,''), '\D', '', 'g') = '45930584818'
    OR lower(coalesce(cp.email,'')) = 'igorb26@outlook.com'

UNION ALL
SELECT '03_cadastro_publico_recusado', to_jsonb(r)
  FROM public.qa_cadastro_publico_recusados r
 WHERE regexp_replace(coalesce(r.cpf,''), '\D', '', 'g') = '45930584818'
    OR lower(coalesce(r.email,'')) = 'igorb26@outlook.com'

UNION ALL
SELECT '04_termos_aceitos', to_jsonb(ci) - 'termo_texto'
  FROM public.qa_cliente_ciencias ci
 WHERE ci.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '05_enderecos_5_anos', to_jsonb(ea)
  FROM public.qa_cliente_enderecos_anteriores ea
 WHERE ea.qa_cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '06_declaracoes_residencia',
       to_jsonb(dr) - 'conteudo_html' - 'sessao_geracao_json' - 'sessao_envio_json'
  FROM public.qa_declaracoes_residencia dr
 WHERE dr.qa_cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '07_vendas', to_jsonb(v) - 'asaas_pix_payload' - 'checkout_token_hash'
  FROM public.qa_vendas v
 WHERE v.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '08_itens_venda',
       to_jsonb(iv) || jsonb_build_object(
         'servico_catalogo',
         coalesce(sc.servico_id::text || ' — ' || sc.nome,
                  'servico_id ' || coalesce(iv.servico_id::text, '?') || ' (sem nome no catálogo)'))
  FROM public.qa_itens_venda iv
  JOIN public.qa_vendas v ON v.id = iv.venda_id AND v.cliente_id IN (SELECT id FROM alvo)
  LEFT JOIN public.qa_servicos_catalogo sc ON sc.servico_id = iv.servico_id

UNION ALL
SELECT * FROM (
  SELECT '09_venda_eventos', to_jsonb(ve)
    FROM public.qa_venda_eventos ve
   WHERE ve.venda_id IN (SELECT id FROM public.qa_vendas WHERE cliente_id IN (SELECT id FROM alvo))
      OR ve.cliente_id IN (SELECT id FROM alvo)
      OR ve.qa_cliente_id IN (SELECT id FROM alvo)
   ORDER BY ve.created_at DESC LIMIT 500) s09

UNION ALL
SELECT '10_contratos',
       to_jsonb(ct) - 'conteudo_renderizado' - 'validation_details' - 'customer_upload_device'
  FROM public.qa_contracts ct
 WHERE ct.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '11_contrato_assinaturas', to_jsonb(cs) - 'validation_details'
  FROM public.qa_contract_signatures cs
 WHERE cs.contract_id IN (SELECT id FROM public.qa_contracts WHERE cliente_id IN (SELECT id FROM alvo))

UNION ALL
SELECT * FROM (
  SELECT '12_contrato_eventos', to_jsonb(ce)
    FROM public.qa_contract_events ce
   WHERE ce.contract_id IN (SELECT id FROM public.qa_contracts WHERE cliente_id IN (SELECT id FROM alvo))
   ORDER BY ce.created_at DESC LIMIT 300) s12

UNION ALL
SELECT '13_solicitacoes_servico', to_jsonb(ss)
  FROM public.qa_solicitacoes_servico ss
 WHERE ss.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT * FROM (
  SELECT '14_solicitacao_eventos', to_jsonb(se)
    FROM public.qa_solicitacao_eventos se
   WHERE se.cliente_id IN (SELECT id FROM alvo)
      OR se.solicitacao_id IN (SELECT id FROM public.qa_solicitacoes_servico
                                WHERE cliente_id IN (SELECT id FROM alvo))
   ORDER BY se.created_at DESC LIMIT 500) s14

UNION ALL
SELECT '15_processos', to_jsonb(p)
  FROM public.qa_processos p
 WHERE p.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '16_checklist_processo',
       to_jsonb(pd) - 'texto_ocr_extraido' - 'dados_extraidos_json' - 'extracao_ia_json'
         - 'regra_validacao' - 'metadados_documento_json' - 'campos_complementares_json'
         - 'assinatura_detalhes_json' - 'divergencias_json' - 'instrucoes'
         - 'exemplo_url' - 'modelo_url' - 'link_emissao'
  FROM public.qa_processo_documentos pd
 WHERE pd.cliente_id IN (SELECT id FROM alvo)
    OR pd.processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id IN (SELECT id FROM alvo))

UNION ALL
SELECT '17_painel_progresso_itens',
       jsonb_build_object('processo_id', p.id, 'servico_id', p.servico_id,
                          'servico_nome', p.servico_nome) || to_jsonb(itens)
  FROM public.qa_processos p
  CROSS JOIN LATERAL public.qa_painel_progresso_itens(p.id) itens
 WHERE p.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '18_catalogo_faltando_no_checklist',
       jsonb_build_object('processo_id', p.id, 'servico_id', p.servico_id,
                          'servico_nome', p.servico_nome,
                          'tipo_documento', cat.tipo_documento,
                          'nome_documento', cat.nome_documento,
                          'obrigatorio', cat.obrigatorio, 'etapa', cat.etapa)
  FROM public.qa_processos p
  CROSS JOIN LATERAL public.qa_catalogo_do_processo(p.id) cat
 WHERE p.cliente_id IN (SELECT id FROM alvo)
   AND NOT EXISTS (SELECT 1 FROM public.qa_processo_documentos pd
                    WHERE pd.processo_id = p.id
                      AND pd.tipo_documento = cat.tipo_documento)

UNION ALL
SELECT '19_checklist_fora_do_catalogo',
       jsonb_build_object('processo_id', p.id, 'servico_id', p.servico_id,
                          'servico_nome', p.servico_nome,
                          'tipo_documento', pd.tipo_documento,
                          'nome_documento', pd.nome_documento,
                          'status', pd.status, 'obrigatorio', pd.obrigatorio)
  FROM public.qa_processos p
  JOIN public.qa_processo_documentos pd ON pd.processo_id = p.id
 WHERE p.cliente_id IN (SELECT id FROM alvo)
   AND NOT EXISTS (SELECT 1 FROM public.qa_catalogo_do_processo(p.id) cat
                    WHERE cat.tipo_documento = pd.tipo_documento)

UNION ALL
SELECT * FROM (
  SELECT '20_processo_eventos', to_jsonb(pe)
    FROM public.qa_processo_eventos pe
   WHERE pe.processo_id IN (SELECT id FROM public.qa_processos WHERE cliente_id IN (SELECT id FROM alvo))
   ORDER BY pe.created_at DESC LIMIT 800) s20

UNION ALL
SELECT * FROM (
  SELECT '21_status_eventos', to_jsonb(st)
    FROM public.qa_status_eventos st
   WHERE st.cliente_id IN (SELECT id FROM alvo)
      OR st.processo_id::text IN (SELECT id::text FROM public.qa_processos
                                   WHERE cliente_id IN (SELECT id FROM alvo))
   ORDER BY st.criado_em DESC LIMIT 500) s21

UNION ALL
SELECT '22_hub_documentos',
       to_jsonb(d) - 'ia_dados_extraidos' - 'metadados_documento_json' - 'campos_complementares_json'
  FROM public.qa_documentos_cliente d
 WHERE d.qa_cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT * FROM (
  SELECT '23_hub_eventos', to_jsonb(de)
    FROM public.qa_documentos_cliente_eventos de
   WHERE de.qa_cliente_id IN (SELECT id FROM alvo)
      OR de.documento_id IN (SELECT id FROM public.qa_documentos_cliente
                              WHERE qa_cliente_id IN (SELECT id FROM alvo))
   ORDER BY de.created_at DESC LIMIT 500) s23

UNION ALL
SELECT '24_jobs_processamento', to_jsonb(j)
  FROM public.qa_document_jobs j
 WHERE j.documento_id::text IN (SELECT id::text FROM public.qa_documentos_cliente
                                 WHERE qa_cliente_id IN (SELECT id FROM alvo))
    OR j.user_id::text IN (SELECT user_id::text FROM public.qa_clientes
                            WHERE id IN (SELECT id FROM alvo) AND user_id IS NOT NULL)

UNION ALL
SELECT '25_exames', to_jsonb(e)
  FROM public.qa_exames_cliente e
 WHERE e.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '26_cr',
       to_jsonb(cr) - 'senha_gov_encrypted' - 'senha_gov_iv' - 'senha_gov_tag'
  FROM public.qa_cadastro_cr cr
 WHERE cr.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '27_crafs', to_jsonb(cf)
  FROM public.qa_crafs cf
 WHERE cf.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '28_gtes', to_jsonb(g)
  FROM public.qa_gtes g
 WHERE g.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '29_gte_documentos',
       to_jsonb(gd) - 'dados_extraidos_json' - 'armas_json' - 'armas_vinculadas_json'
         - 'clubes_json' - 'enderecos_json' - 'matching_resumo_json'
  FROM public.qa_gte_documentos gd
 WHERE gd.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '30_notificacoes_cliente', to_jsonb(n)
  FROM public.qa_notificacoes_cliente n
 WHERE n.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '31_avisos_admin', to_jsonb(an)
  FROM public.qa_admin_notificacoes an
 WHERE an.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '32_alertas_vencimento_enviados', to_jsonb(va)
  FROM public.qa_vencimentos_alertas_enviados va
 WHERE va.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '33_alertas_prazo_processo_enviados', to_jsonb(pa)
  FROM public.qa_processos_alertas_enviados pa
 WHERE pa.cliente_id IN (SELECT id FROM alvo)
    OR pa.processo_id::text IN (SELECT id::text FROM public.qa_processos
                                 WHERE cliente_id IN (SELECT id FROM alvo))

UNION ALL
SELECT '34_cobrancas_inatividade', to_jsonb(ic)
  FROM public.qa_inatividade_cobrancas ic
 WHERE ic.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT '35_chat_sessoes', to_jsonb(cs) - 'assunto_embedding'
  FROM public.qa_chat_sessoes cs
 WHERE cs.cliente_id IN (SELECT id FROM alvo)

UNION ALL
SELECT * FROM (
  SELECT '36_chat_mensagens',
         jsonb_build_object('sessao_id', cm.sessao_id, 'role', cm.role,
                            'created_at', cm.created_at,
                            'content', left(cm.content, 400),
                            'servico_sugerido_slug', cm.servico_sugerido_slug,
                            'feedback_cliente', cm.feedback_cliente,
                            'motivo_rejeicao', cm.motivo_rejeicao)
    FROM public.qa_chat_mensagens cm
   WHERE cm.cliente_id IN (SELECT id FROM alvo)
   ORDER BY cm.created_at DESC LIMIT 300) s36

UNION ALL
SELECT * FROM (
  SELECT '37_login_eventos', to_jsonb(le)
    FROM public.qa_cliente_login_eventos le
   WHERE le.qa_cliente_id::text IN (SELECT id::text FROM alvo)
      OR le.user_id::text IN (SELECT user_id::text FROM public.qa_clientes
                               WHERE id IN (SELECT id FROM alvo) AND user_id IS NOT NULL)
   ORDER BY le.created_at DESC LIMIT 200) s37

UNION ALL
SELECT * FROM (
  SELECT '38_acessos_documentos', to_jsonb(da)
    FROM public.qa_documento_acessos da
   WHERE da.cliente_id IN (SELECT id FROM alvo)
   ORDER BY da.created_at DESC LIMIT 300) s38

UNION ALL
SELECT * FROM (
  SELECT '39_downloads_documentos', to_jsonb(dd)
    FROM public.qa_documento_downloads dd
   WHERE dd.cliente_id IN (SELECT id FROM alvo)
   ORDER BY dd.baixado_em DESC LIMIT 300) s39

UNION ALL
SELECT * FROM (
  SELECT '40_telemetria_cadastro', to_jsonb(t)
    FROM public.qa_cadastro_telemetria t
   WHERE t.payload::text ILIKE '%45930584818%'
      OR t.payload::text ILIKE '%459.305.848-18%'
      OR t.payload::text ILIKE '%igorb26@outlook.com%'
   ORDER BY t.created_at DESC LIMIT 200) s40

UNION ALL
SELECT '41_validades_resumo',
       jsonb_build_object('fonte', vr.fonte, 'item', vr.item, 'status', vr.status,
                          'data_validade', vr.data_validade,
                          'dias_restantes', (vr.data_validade - CURRENT_DATE))
  FROM (
    SELECT 'HUB' AS fonte,
           d.tipo_documento || ' — ' || coalesce(d.nome_documento, d.arquivo_nome, '') AS item,
           d.status, d.data_validade::date AS data_validade
      FROM public.qa_documentos_cliente d
     WHERE d.qa_cliente_id IN (SELECT id FROM alvo)
       AND d.data_validade IS NOT NULL AND d.status <> 'excluido'
    UNION ALL
    SELECT 'CHECKLIST', pd.tipo_documento || ' — ' || pd.nome_documento,
           pd.status, pd.data_validade_efetiva::date
      FROM public.qa_processo_documentos pd
     WHERE (pd.cliente_id IN (SELECT id FROM alvo)
            OR pd.processo_id IN (SELECT id FROM public.qa_processos
                                   WHERE cliente_id IN (SELECT id FROM alvo)))
       AND pd.data_validade_efetiva IS NOT NULL
    UNION ALL
    SELECT 'EXAME', e.tipo, 'registrado', e.data_vencimento::date
      FROM public.qa_exames_cliente e
     WHERE e.cliente_id IN (SELECT id FROM alvo)
    UNION ALL
    SELECT 'CR', coalesce(cr.numero_cr, 'CR'), 'registrado', cr.validade_cr::date
      FROM public.qa_cadastro_cr cr
     WHERE cr.cliente_id IN (SELECT id FROM alvo) AND cr.validade_cr IS NOT NULL
    UNION ALL
    SELECT 'CRAF', coalesce(cf.nome_craf, 'CRAF'), 'registrado', cf.data_validade::date
      FROM public.qa_crafs cf
     WHERE cf.cliente_id IN (SELECT id FROM alvo) AND cf.data_validade IS NOT NULL
    UNION ALL
    SELECT 'GTE', coalesce(g.nome_gte, 'GTE'), 'registrado', g.data_validade::date
      FROM public.qa_gtes g
     WHERE g.cliente_id IN (SELECT id FROM alvo) AND g.data_validade IS NOT NULL
  ) vr

ORDER BY 1;
