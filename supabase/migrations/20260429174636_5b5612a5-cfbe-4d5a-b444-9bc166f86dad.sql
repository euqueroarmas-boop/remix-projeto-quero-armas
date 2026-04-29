
-- Fase 12: Instruções e modelos dos documentos
-- Adiciona campos opcionais de orientação ao catálogo e ao checklist do processo,
-- e propaga via qa_explodir_checklist_processo. Não altera regras de pagamento,
-- arsenal, RLS ampla, upload/scanner, nem dados existentes.

-- 1) Catálogo: qa_servicos_documentos
ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS instrucoes text,
  ADD COLUMN IF NOT EXISTS observacoes_cliente text,
  ADD COLUMN IF NOT EXISTS modelo_url text,
  ADD COLUMN IF NOT EXISTS exemplo_url text,
  ADD COLUMN IF NOT EXISTS orgao_emissor text,
  ADD COLUMN IF NOT EXISTS prazo_recomendado_dias integer;

-- 2) Processo: qa_processo_documentos (snapshot por processo)
ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS instrucoes text,
  ADD COLUMN IF NOT EXISTS observacoes_cliente text,
  ADD COLUMN IF NOT EXISTS modelo_url text,
  ADD COLUMN IF NOT EXISTS exemplo_url text,
  ADD COLUMN IF NOT EXISTS orgao_emissor text,
  ADD COLUMN IF NOT EXISTS prazo_recomendado_dias integer;

-- 3) Atualiza qa_explodir_checklist_processo para propagar os novos campos.
--    Mantém: SECURITY DEFINER, search_path, validações, evento, retorno.
CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(p_processo_id uuid)
 RETURNS TABLE(inseridos integer, ja_existentes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proc        public.qa_processos%ROWTYPE;
  v_condicao    text;
  v_ins         integer := 0;
  v_exi         integer := 0;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  v_condicao := COALESCE(v_proc.condicao_profissional, 'indefinido');

  WITH desejados AS (
    SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
           sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
           sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
           sd.orgao_emissor, sd.prazo_recomendado_dias
    FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = v_proc.servico_id
      AND sd.ativo = true
      AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
  ),
  ja AS (
    SELECT tipo_documento FROM public.qa_processo_documentos
    WHERE processo_id = p_processo_id
  ),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor, prazo_recomendado_dias
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento, d.nome_documento, d.etapa,
           'pendente', true, d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao,
           d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url, d.orgao_emissor, d.prazo_recomendado_dias
    FROM desejados d
    WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM inserted)::int,
    (SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento))::int
  INTO v_ins, v_exi;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (
    p_processo_id, 'checklist_explodido',
    format('Checklist liberado pos-pagamento: %s novos, %s ja existentes (servico_id=%s, condicao=%s)',
           v_ins, v_exi, v_proc.servico_id, v_condicao),
    'sistema'
  );

  inseridos := v_ins;
  ja_existentes := v_exi;
  RETURN NEXT;
END $function$;
