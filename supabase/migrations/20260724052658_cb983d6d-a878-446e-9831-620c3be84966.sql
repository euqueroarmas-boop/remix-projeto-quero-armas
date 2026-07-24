CREATE OR REPLACE FUNCTION public.qa_cliente_notificacoes_ativas(p_cliente_id integer)
RETURNS TABLE (
  id text, categoria text, urgencia text, titulo text, mensagem text,
  link text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    'contrato-' || c.id::text,
    'contrato_pendente',
    'urgente',
    'Assinatura de contrato pendente',
    'Você tem um contrato aguardando assinatura. O início do atendimento pelo Arsenal Inteligente depende dessa assinatura.',
    '/area-do-cliente',
    c.created_at
  FROM public.qa_contracts c
  WHERE c.cliente_id = p_cliente_id
    AND c.status IN ('generated_pending_company_signature', 'pending_customer_signature')
    AND NOT EXISTS (
      SELECT 1 FROM public.qa_documentos_cliente d
      WHERE d.qa_cliente_id = p_cliente_id
        AND d.tipo_documento = 'contrato_assinado'
        AND COALESCE(d.status,'') <> 'excluido'
    )
  UNION ALL
  SELECT
    'procuracao-' || p.id::text,
    'procuracao_pendente',
    'urgente',
    'Procuração pendente de assinatura',
    'Você tem uma procuração aguardando assinatura no Gov.br.',
    '/area-do-cliente',
    p.created_at
  FROM public.qa_procuracoes p
  WHERE p.cliente_id = p_cliente_id
    AND p.status IN ('gerada','pendente_assinatura','pending_customer_signature')
    AND NOT EXISTS (
      SELECT 1 FROM public.qa_documentos_cliente d
      WHERE d.qa_cliente_id = p_cliente_id
        AND d.tipo_documento = 'procuracao_assinada'
        AND COALESCE(d.status,'') <> 'excluido'
    )
  UNION ALL
  SELECT
    'doc-' || d.id::text,
    'documento_vencimento',
    CASE WHEN d.data_validade < CURRENT_DATE THEN 'urgente' ELSE 'normal' END,
    CASE WHEN d.data_validade < CURRENT_DATE
         THEN 'Documento vencido no Hub Documental'
         ELSE 'Documento próximo do vencimento' END,
    'O documento "' || d.tipo_documento || '" vence em ' || to_char(d.data_validade,'DD/MM/YYYY') || '. Atualize no Hub Documental para manter o cadastro em dia.',
    '/area-do-cliente',
    d.created_at
  FROM public.qa_documentos_cliente d
  WHERE d.qa_cliente_id = p_cliente_id
    AND d.data_validade IS NOT NULL
    AND d.data_validade <= CURRENT_DATE + INTERVAL '30 days'
    AND COALESCE(d.status,'') NOT IN ('excluido','substituido','reprovado')
    AND d.id = (
      SELECT d2.id FROM public.qa_documentos_cliente d2
      WHERE d2.qa_cliente_id = d.qa_cliente_id
        AND d2.tipo_documento = d.tipo_documento
        AND COALESCE(d2.status,'') NOT IN ('excluido','substituido','reprovado')
      ORDER BY d2.data_validade DESC NULLS LAST, d2.created_at DESC
      LIMIT 1
    )
  UNION ALL
  SELECT
    'cr-' || cr.id::text,
    'cr_vencimento',
    CASE WHEN cr.validade_cr < CURRENT_DATE THEN 'urgente' ELSE 'normal' END,
    CASE WHEN cr.validade_cr < CURRENT_DATE THEN 'CR vencido' ELSE 'CR próximo do vencimento' END,
    'Seu CR ' || COALESCE(cr.numero_cr,'') || ' vence em ' || to_char(cr.validade_cr,'DD/MM/YYYY') || '. A renovação precisa começar com antecedência.',
    '/area-do-cliente',
    now()
  FROM public.qa_cadastro_cr cr
  WHERE cr.cliente_id = p_cliente_id
    AND cr.validade_cr IS NOT NULL
    AND cr.validade_cr <= CURRENT_DATE + INTERVAL '60 days'
  UNION ALL
  SELECT
    'craf-' || cr.id::text,
    'craf_vencimento',
    CASE WHEN cr.data_validade < CURRENT_DATE THEN 'urgente' ELSE 'normal' END,
    CASE WHEN cr.data_validade < CURRENT_DATE THEN 'CRAF vencido' ELSE 'CRAF próximo do vencimento' END,
    'CRAF da arma ' || COALESCE(cr.nome_arma, cr.numero_arma, cr.numero_sigma, 'registrada') || ' vence em ' || to_char(cr.data_validade,'DD/MM/YYYY') || '.',
    '/area-do-cliente',
    now()
  FROM public.qa_crafs cr
  WHERE cr.cliente_id = p_cliente_id
    AND cr.data_validade IS NOT NULL
    AND cr.data_validade <= CURRENT_DATE + INTERVAL '60 days'
  UNION ALL
  SELECT
    'gte-' || g.id::text,
    'gte_vencimento',
    CASE WHEN g.data_validade < CURRENT_DATE THEN 'urgente' ELSE 'normal' END,
    CASE WHEN g.data_validade < CURRENT_DATE THEN 'GTE vencido' ELSE 'GTE próximo do vencimento' END,
    'GTE ' || COALESCE(g.nome_gte,'') || ' vence em ' || to_char(g.data_validade,'DD/MM/YYYY') || '.',
    '/area-do-cliente',
    now()
  FROM public.qa_gtes g
  WHERE g.cliente_id = p_cliente_id
    AND g.data_validade IS NOT NULL
    AND g.data_validade <= CURRENT_DATE + INTERVAL '30 days'
  UNION ALL
  SELECT
    'filiacao-' || f.id::text,
    'filiacao_vencimento',
    CASE WHEN f.validade_filiacao < CURRENT_DATE THEN 'urgente' ELSE 'normal' END,
    CASE WHEN f.validade_filiacao < CURRENT_DATE
         THEN 'Filiação de clube vencida'
         ELSE 'Filiação de clube próxima do vencimento' END,
    'Filiação ' || COALESCE(f.nome_filiacao,'') || ' vence em ' || to_char(f.validade_filiacao,'DD/MM/YYYY') || '. CAC ativo exige filiação vigente.',
    '/area-do-cliente',
    now()
  FROM public.qa_filiacoes f
  WHERE f.cliente_id = p_cliente_id
    AND f.validade_filiacao IS NOT NULL
    AND f.validade_filiacao <= CURRENT_DATE + INTERVAL '30 days'
  UNION ALL
  SELECT
    'exame-' || e.id::text,
    'exame_vencimento',
    CASE WHEN e.data_vencimento < CURRENT_DATE THEN 'urgente' ELSE 'normal' END,
    CASE WHEN e.data_vencimento < CURRENT_DATE THEN 'Exame vencido' ELSE 'Exame próximo do vencimento' END,
    'Exame ' || COALESCE(e.tipo,'') || ' vence em ' || to_char(e.data_vencimento,'DD/MM/YYYY') || '.',
    '/area-do-cliente',
    now()
  FROM public.qa_exames_cliente e
  WHERE e.cliente_id = p_cliente_id
    AND e.data_vencimento IS NOT NULL
    AND e.data_vencimento <= CURRENT_DATE + INTERVAL '60 days'
  UNION ALL
  SELECT
    n.id::text, n.categoria, n.urgencia, n.titulo, n.mensagem, n.link, n.created_at
  FROM public.qa_notificacoes_cliente n
  WHERE n.cliente_id = p_cliente_id AND n.ativa = true
$$;

GRANT EXECUTE ON FUNCTION public.qa_cliente_notificacoes_ativas(integer) TO authenticated;