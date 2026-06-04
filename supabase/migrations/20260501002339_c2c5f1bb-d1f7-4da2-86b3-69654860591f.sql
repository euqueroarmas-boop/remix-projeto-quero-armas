-- Permitir os novos status preservando todos os já existentes na base.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'qa_processo_documentos'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.qa_processo_documentos DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.qa_processo_documentos
  ADD CONSTRAINT chk_qa_processo_documentos_status CHECK (status = ANY (ARRAY[
    'pendente',
    'enviado',
    'em_analise',
    'aprovado',
    'rejeitado',
    'expirado',
    'invalido',
    'divergente',
    'dispensado_grupo',
    'descartado_por_troca_servico',
    'pendente_reenvio'
  ]));

CREATE OR REPLACE FUNCTION public.qa_processo_trocar_servico(
  p_processo_id    uuid,
  p_novo_servico_id integer,
  p_dry_run        boolean DEFAULT false,
  p_motivo         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_proc record;
  v_servico_novo record;
  v_condicao text;
  v_novos_tipos text[];
  v_atuais_tipos text[];
  v_reaproveitados_processo int := 0;
  v_reaproveitados_cofre    int := 0;
  v_descartados             int := 0;
  v_marcados_reenvio        int := 0;
  v_inseridos_novos         int := 0;
  v_tipos_reaproveitados text[];
  v_tipos_descartados    text[];
  v_tipos_reenvio        text[];
  v_tipos_inseridos      text[];
  v_servico_antigo_id   integer;
  v_servico_antigo_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'forbidden: only active staff can change servico of a processo';
  END IF;
  IF p_processo_id IS NULL THEN RAISE EXCEPTION 'p_processo_id é obrigatório'; END IF;
  IF p_novo_servico_id IS NULL THEN RAISE EXCEPTION 'p_novo_servico_id é obrigatório'; END IF;

  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'processo % não encontrado', p_processo_id; END IF;

  v_servico_antigo_id   := v_proc.servico_id;
  v_servico_antigo_nome := v_proc.servico_nome;

  IF v_servico_antigo_id = p_novo_servico_id THEN
    RETURN jsonb_build_object('noop', true, 'mensagem', 'Serviço já é esse.',
      'processo_id', p_processo_id, 'servico_id', v_servico_antigo_id);
  END IF;

  SELECT id, nome_servico INTO v_servico_novo FROM public.qa_servicos WHERE id = p_novo_servico_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'servico % não encontrado', p_novo_servico_id; END IF;

  v_condicao := COALESCE(v_proc.condicao_profissional, 'indefinido');

  SELECT array_agg(DISTINCT sd.tipo_documento) INTO v_novos_tipos
    FROM public.qa_servicos_documentos sd
   WHERE sd.servico_id = p_novo_servico_id AND sd.ativo = true
     AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao);
  v_novos_tipos := COALESCE(v_novos_tipos, ARRAY[]::text[]);

  SELECT array_agg(DISTINCT tipo_documento) INTO v_atuais_tipos
    FROM public.qa_processo_documentos WHERE processo_id = p_processo_id;
  v_atuais_tipos := COALESCE(v_atuais_tipos, ARRAY[]::text[]);

  SELECT COUNT(*), array_agg(tipo_documento) INTO v_descartados, v_tipos_descartados
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id AND tipo_documento <> ALL (v_novos_tipos);

  SELECT COUNT(*), array_agg(tipo_documento) INTO v_reaproveitados_processo, v_tipos_reaproveitados
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = p_processo_id AND pd.tipo_documento = ANY (v_novos_tipos)
     AND pd.status = 'aprovado'
     AND (pd.validade_dias IS NULL OR pd.data_validacao IS NULL
          OR pd.data_validacao + (pd.validade_dias || ' days')::interval > now());

  SELECT COUNT(*), array_agg(tipo_documento) INTO v_marcados_reenvio, v_tipos_reenvio
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = p_processo_id AND pd.tipo_documento = ANY (v_novos_tipos)
     AND pd.status = 'aprovado' AND pd.validade_dias IS NOT NULL
     AND pd.data_validacao IS NOT NULL
     AND pd.data_validacao + (pd.validade_dias || ' days')::interval <= now();

  SELECT COUNT(*), array_agg(t) INTO v_inseridos_novos, v_tipos_inseridos
    FROM unnest(v_novos_tipos) AS t WHERE t <> ALL (v_atuais_tipos);

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'processo_id', p_processo_id,
      'servico_antigo', jsonb_build_object('id', v_servico_antigo_id, 'nome', v_servico_antigo_nome),
      'servico_novo', jsonb_build_object('id', v_servico_novo.id, 'nome', v_servico_novo.nome_servico),
      'reaproveitados', COALESCE(v_reaproveitados_processo, 0),
      'descartados', COALESCE(v_descartados, 0),
      'pendentes_reenvio', COALESCE(v_marcados_reenvio, 0),
      'novos_inseridos', COALESCE(v_inseridos_novos, 0),
      'tipos_reaproveitados', COALESCE(v_tipos_reaproveitados, ARRAY[]::text[]),
      'tipos_descartados', COALESCE(v_tipos_descartados, ARRAY[]::text[]),
      'tipos_reenvio', COALESCE(v_tipos_reenvio, ARRAY[]::text[]),
      'tipos_inseridos', COALESCE(v_tipos_inseridos, ARRAY[]::text[])
    );
  END IF;

  UPDATE public.qa_processos
     SET servico_id = v_servico_novo.id, servico_nome = v_servico_novo.nome_servico, updated_at = now()
   WHERE id = p_processo_id;

  UPDATE public.qa_processo_documentos
     SET status = 'descartado_por_troca_servico',
         observacoes = COALESCE(observacoes, '') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Descartado por troca de serviço (' ||
           COALESCE(v_servico_antigo_nome,'?') || ' → ' || v_servico_novo.nome_servico || ')',
         updated_at = now()
   WHERE processo_id = p_processo_id AND tipo_documento <> ALL (v_novos_tipos);

  UPDATE public.qa_processo_documentos pd
     SET status = 'pendente_reenvio',
         observacoes = COALESCE(observacoes, '') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Reenvio solicitado: documento expirado na troca de serviço',
         updated_at = now()
   WHERE pd.processo_id = p_processo_id AND pd.tipo_documento = ANY (v_novos_tipos)
     AND pd.status = 'aprovado' AND pd.validade_dias IS NOT NULL
     AND pd.data_validacao IS NOT NULL
     AND pd.data_validacao + (pd.validade_dias || ' days')::interval <= now();

  WITH desejados AS (
    SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
           sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
           sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
           sd.orgao_emissor, sd.prazo_recomendado_dias
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = p_novo_servico_id AND sd.ativo = true
       AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
  ),
  ja AS (SELECT tipo_documento FROM public.qa_processo_documentos WHERE processo_id = p_processo_id)
  INSERT INTO public.qa_processo_documentos (
    processo_id, cliente_id, tipo_documento, nome_documento, etapa,
    status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
    instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor, prazo_recomendado_dias
  )
  SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento, d.nome_documento, d.etapa,
         'pendente', true, d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao,
         d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url, d.orgao_emissor, d.prazo_recomendado_dias
    FROM desejados d
   WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento);

  WITH cofre_validos AS (
    SELECT DISTINCT ON (dc.tipo_documento)
           dc.tipo_documento, dc.arquivo_storage_path, dc.arquivo_nome, dc.id
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND dc.validado_admin = true
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
     ORDER BY dc.tipo_documento, dc.created_at DESC
  ),
  reaproveitados_cofre AS (
    UPDATE public.qa_processo_documentos pd
       SET arquivo_storage_key = cv.arquivo_storage_path,
           arquivo_url = cv.arquivo_storage_path,
           status = 'em_analise',
           data_envio = now(),
           observacoes = COALESCE(pd.observacoes, '') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Reaproveitado do cofre do cliente (doc #' || cv.id::text || ')',
           updated_at = now()
      FROM cofre_validos cv
     WHERE pd.processo_id = p_processo_id
       AND pd.tipo_documento = cv.tipo_documento
       AND pd.status = 'pendente'
       AND pd.arquivo_storage_key IS NULL
    RETURNING pd.tipo_documento
  )
  SELECT COUNT(*) INTO v_reaproveitados_cofre FROM reaproveitados_cofre;

  UPDATE public.qa_processos
     SET status = CASE
       WHEN status IN ('validado','bloqueado','cancelado') THEN status
       WHEN EXISTS (
         SELECT 1 FROM public.qa_processo_documentos
          WHERE processo_id = p_processo_id
            AND status IN ('pendente','pendente_reenvio') AND obrigatorio = true
       ) THEN 'aguardando_documentos'
       ELSE 'em_validacao'
     END
   WHERE id = p_processo_id;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (p_processo_id, 'troca_servico',
    format('Serviço alterado: %s → %s. Reaproveitados: %s, descartados: %s, reenvio: %s, novos: %s. Motivo: %s',
      COALESCE(v_servico_antigo_nome,'?'), v_servico_novo.nome_servico,
      v_reaproveitados_processo, v_descartados, v_marcados_reenvio, v_inseridos_novos,
      COALESCE(p_motivo,'—')),
    'equipe_operacional');

  IF v_reaproveitados_cofre > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
    VALUES (p_processo_id, 'documentos_reaproveitados',
      format('Reaproveitados %s documento(s) do cofre do cliente após troca de serviço.', v_reaproveitados_cofre),
      'sistema');
  END IF;

  RETURN jsonb_build_object(
    'dry_run', false, 'processo_id', p_processo_id,
    'servico_antigo', jsonb_build_object('id', v_servico_antigo_id, 'nome', v_servico_antigo_nome),
    'servico_novo', jsonb_build_object('id', v_servico_novo.id, 'nome', v_servico_novo.nome_servico),
    'reaproveitados', COALESCE(v_reaproveitados_processo, 0),
    'reaproveitados_cofre', COALESCE(v_reaproveitados_cofre, 0),
    'descartados', COALESCE(v_descartados, 0),
    'pendentes_reenvio', COALESCE(v_marcados_reenvio, 0),
    'novos_inseridos', COALESCE(v_inseridos_novos, 0),
    'tipos_reaproveitados', COALESCE(v_tipos_reaproveitados, ARRAY[]::text[]),
    'tipos_descartados', COALESCE(v_tipos_descartados, ARRAY[]::text[]),
    'tipos_reenvio', COALESCE(v_tipos_reenvio, ARRAY[]::text[]),
    'tipos_inseridos', COALESCE(v_tipos_inseridos, ARRAY[]::text[]),
    'motivo', p_motivo
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.qa_processo_trocar_servico(uuid, integer, boolean, text) TO authenticated, service_role;
