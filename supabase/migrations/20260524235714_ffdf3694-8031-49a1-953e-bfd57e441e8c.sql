
-- Adicionar campos de arquivamento em qa_cadastro_publico
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento text NULL;

CREATE INDEX IF NOT EXISTS idx_qa_cadastro_publico_arquivado
  ON public.qa_cadastro_publico (arquivado);

-- Adicionar campos de arquivamento em qa_solicitacoes_servico
ALTER TABLE public.qa_solicitacoes_servico
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS motivo_arquivamento text NULL;

CREATE INDEX IF NOT EXISTS idx_qa_solicitacoes_servico_arquivado
  ON public.qa_solicitacoes_servico (arquivado);

-- Substituir qa_cliente_arquivar para propagar arquivamento aos cadastros públicos
-- e solicitações de serviço vinculadas (por cliente_id_vinculado, cpf, email e telefone).
CREATE OR REPLACE FUNCTION public.qa_cliente_arquivar(
  p_cliente_id integer,
  p_motivo text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_motivo text := COALESCE(NULLIF(trim(p_motivo), ''), 'Arquivamento por vínculos críticos (vendas/processos).');
  v_cpf text;
  v_email text;
  v_tel text;
  v_cad_count integer := 0;
  v_sol_count integer := 0;
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para arquivar cliente';
  END IF;

  UPDATE public.qa_clientes
     SET arquivado = true,
         arquivado_em = now(),
         arquivado_por = v_uid,
         motivo_arquivamento = v_motivo
   WHERE id = p_cliente_id
  RETURNING NULLIF(trim(cpf), ''), NULLIF(trim(email), ''), NULLIF(trim(celular), '')
   INTO v_cpf, v_email, v_tel;

  -- Arquiva cadastros públicos vinculados (cliente_id_vinculado OU mesmo cpf/email/telefone)
  WITH upd AS (
    UPDATE public.qa_cadastro_publico
       SET arquivado = true,
           arquivado_em = now(),
           arquivado_por = v_uid,
           motivo_arquivamento = v_motivo
     WHERE COALESCE(arquivado, false) = false
       AND (
            cliente_id_vinculado = p_cliente_id
         OR (v_cpf IS NOT NULL AND NULLIF(trim(cpf), '') = v_cpf)
         OR (v_email IS NOT NULL AND lower(NULLIF(trim(email), '')) = lower(v_email))
         OR (v_tel IS NOT NULL AND NULLIF(trim(telefone_principal), '') = v_tel)
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_cad_count FROM upd;

  -- Arquiva solicitações de serviço vinculadas ao cliente OU aos cadastros arquivados
  WITH upd AS (
    UPDATE public.qa_solicitacoes_servico s
       SET arquivado = true,
           arquivado_em = now(),
           arquivado_por = v_uid,
           motivo_arquivamento = v_motivo
     WHERE COALESCE(s.arquivado, false) = false
       AND (
            s.cliente_id = p_cliente_id
         OR s.cadastro_publico_id IN (
              SELECT id FROM public.qa_cadastro_publico
               WHERE COALESCE(arquivado, false) = true
                 AND (
                      cliente_id_vinculado = p_cliente_id
                   OR (v_cpf IS NOT NULL AND NULLIF(trim(cpf), '') = v_cpf)
                   OR (v_email IS NOT NULL AND lower(NULLIF(trim(email), '')) = lower(v_email))
                   OR (v_tel IS NOT NULL AND NULLIF(trim(telefone_principal), '') = v_tel)
                 )
            )
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_sol_count FROM upd;

  RETURN jsonb_build_object(
    'ok', true,
    'cliente_id', p_cliente_id,
    'cadastros_arquivados', v_cad_count,
    'solicitacoes_arquivadas', v_sol_count
  );
END;
$function$;

-- Substituir qa_cliente_restaurar para reverter o arquivamento propagado
CREATE OR REPLACE FUNCTION public.qa_cliente_restaurar(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cpf text;
  v_email text;
  v_tel text;
  v_cad_count integer := 0;
  v_sol_count integer := 0;
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar cliente';
  END IF;

  UPDATE public.qa_clientes
     SET arquivado = false,
         arquivado_em = NULL,
         arquivado_por = NULL,
         motivo_arquivamento = NULL
   WHERE id = p_cliente_id
  RETURNING NULLIF(trim(cpf), ''), NULLIF(trim(email), ''), NULLIF(trim(celular), '')
   INTO v_cpf, v_email, v_tel;

  WITH upd AS (
    UPDATE public.qa_cadastro_publico
       SET arquivado = false,
           arquivado_em = NULL,
           arquivado_por = NULL,
           motivo_arquivamento = NULL
     WHERE COALESCE(arquivado, false) = true
       AND (
            cliente_id_vinculado = p_cliente_id
         OR (v_cpf IS NOT NULL AND NULLIF(trim(cpf), '') = v_cpf)
         OR (v_email IS NOT NULL AND lower(NULLIF(trim(email), '')) = lower(v_email))
         OR (v_tel IS NOT NULL AND NULLIF(trim(telefone_principal), '') = v_tel)
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_cad_count FROM upd;

  WITH upd AS (
    UPDATE public.qa_solicitacoes_servico s
       SET arquivado = false,
           arquivado_em = NULL,
           arquivado_por = NULL,
           motivo_arquivamento = NULL
     WHERE COALESCE(s.arquivado, false) = true
       AND (
            s.cliente_id = p_cliente_id
         OR s.cadastro_publico_id IN (
              SELECT id FROM public.qa_cadastro_publico
               WHERE cliente_id_vinculado = p_cliente_id
                  OR (v_cpf IS NOT NULL AND NULLIF(trim(cpf), '') = v_cpf)
                  OR (v_email IS NOT NULL AND lower(NULLIF(trim(email), '')) = lower(v_email))
                  OR (v_tel IS NOT NULL AND NULLIF(trim(telefone_principal), '') = v_tel)
            )
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_sol_count FROM upd;

  RETURN jsonb_build_object(
    'ok', true,
    'cliente_id', p_cliente_id,
    'cadastros_restaurados', v_cad_count,
    'solicitacoes_restauradas', v_sol_count
  );
END;
$function$;
