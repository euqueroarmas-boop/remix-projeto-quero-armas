-- =============================================================================
-- Modalidade como DIMENSÃO do processo, não como serviço separado
--
-- Problema: "Autorização de compra" e "CRAF/GT" são o que o cliente contrata;
-- "defesa pessoal", "tiro esportivo", "caçador" e "militar aposentado" são sob
-- qual fundamento. São eixos independentes — e a base legal confirma: a
-- IN DG/PF 201 rege a defesa pessoal, a IN DG/PF 311 rege os CACs, enquanto a
-- Lei 10.826/2003 e os decretos valem para todos. Militar aposentado tem
-- portarias próprias e fica de fora por ora (usuário, 31/07/2026).
--
-- Duplicar serviço por modalidade daria 8 serviços e ~144 linhas de catálogo,
-- a maioria repetida (RG, endereço, as 7 certidões, laudos são iguais em todas
-- as modalidades). Cada correção passaria a ser 8 comandos em vez de 1 — e
-- esquecer um é como um cliente vai a protocolo faltando documento.
--
-- A solução é a mesma que o sistema JÁ usa para condição profissional: uma
-- coluna de condição no catálogo, e um filtro na explosão do checklist.
--
-- NADA MUDA DE COMPORTAMENTO AO RODAR ESTA MIGRATION: todas as exigências
-- nascem com condicao_modalidade NULL, que significa "vale para todas". A
-- classificação por modalidade é decisão do usuário e vem depois.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) A modalidade do processo ─────────────────────────────────────────
ALTER TABLE public.qa_processos
  ADD COLUMN IF NOT EXISTS modalidade text;

COMMENT ON COLUMN public.qa_processos.modalidade IS
  'Fundamento do pedido: defesa_pessoal | atirador | cacador | colecionador | militar_aposentado. NULL = não definida (checklist sai completo).';

-- ─── 2) A quem cada exigência se aplica ──────────────────────────────────
ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS condicao_modalidade text[];

COMMENT ON COLUMN public.qa_servicos_documentos.condicao_modalidade IS
  'Modalidades que recebem esta exigência. NULL = todas. Usado por qa_explodir_checklist_processo.';

-- ─── 3) Registro das modalidades e da base legal de cada uma ─────────────
CREATE TABLE IF NOT EXISTS public.qa_modalidades (
  codigo      text PRIMARY KEY,
  nome        text NOT NULL,
  base_legal  text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.qa_modalidades (codigo, nome, base_legal) VALUES
  ('defesa_pessoal',     'Defesa pessoal',
   'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 201'),
  ('atirador',           'Atirador desportivo (tiro esportivo)',
   'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 311'),
  ('cacador',            'Caçador',
   'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 311'),
  ('colecionador',       'Colecionador',
   'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 311'),
  -- Militar/agente aposentado NÃO segue a IN 201: tem portarias próprias, que
  -- ainda não foram mapeadas. Fica cadastrado e INATIVO — existe no vocabulário
  -- para não ser esquecido, mas não é oferecido até a base legal ser definida.
  ('militar_aposentado', 'Militar / agente aposentado',
   'Portarias próprias — a mapear. NÃO se aplica a IN DG/PF 201.')
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, base_legal = EXCLUDED.base_legal;

UPDATE public.qa_modalidades SET ativo = false WHERE codigo = 'militar_aposentado';
UPDATE public.qa_modalidades SET ativo = true  WHERE codigo <> 'militar_aposentado';

ALTER TABLE public.qa_modalidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa_modalidades_leitura ON public.qa_modalidades;
CREATE POLICY qa_modalidades_leitura ON public.qa_modalidades
  FOR SELECT TO authenticated USING (true);

-- ─── 4) A explosão do checklist passa a respeitar a modalidade ───────────
-- Reescreve qa_explodir_checklist_processo acrescentando UM filtro. O resto é
-- idêntico à versão de 18/07 (20260718025818).

CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(p_processo_id uuid)
RETURNS TABLE(inseridos integer, ja_existentes integer, reaproveitados_cofre integer, pre_validados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc                public.qa_processos%ROWTYPE;
  v_cli                 public.qa_clientes%ROWTYPE;
  v_condicao            text;
  v_profissao_upper     text;
  v_modalidade          text;
  v_ins                 integer := 0;
  v_exi                 integer := 0;
  v_dup                 integer := 0;
  v_invalid             integer := 0;
  v_prevalid            integer := 0;
  v_endereco_seed       integer := 0;
  v_endereco_aproveit   integer := 0;
  v_inserted_tipos      text[] := ARRAY[]::text[];
  v_existing_tipos      text[] := ARRAY[]::text[];
  v_duplicate_tipos     text[] := ARRAY[]::text[];
  v_invalid_items       jsonb := '[]'::jsonb;
  v_reuso               record;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao := COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido');
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');
  -- Modalidade do processo (defesa pessoal, atirador, cacador...). NULL
  -- significa "ainda nao definida": nesse caso NENHUM filtro de modalidade
  -- e aplicado e o checklist sai completo, como antes. Melhor pedir demais
  -- do que deixar de pedir por falta de um dado que ninguem preencheu.
  v_modalidade := NULLIF(TRIM(LOWER(COALESCE(v_proc.modalidade, ''))), '');

  WITH catalogo_bruto AS (
    SELECT sd.*,
           CASE
             WHEN sd.etapa IN ('base','complementar','tecnico','final') THEN sd.etapa
             WHEN sd.etapa = 'antecedentes' THEN 'base'
             WHEN sd.etapa = 'declaracoes' THEN 'complementar'
             WHEN sd.etapa = 'renda' THEN 'complementar'
             ELSE 'base'
           END AS etapa_segura,
           (sd.etapa IS NULL OR sd.etapa NOT IN ('base','complementar','tecnico','final')) AS etapa_invalida,
           row_number() OVER (
             PARTITION BY sd.tipo_documento
             ORDER BY
               CASE WHEN sd.condicao_profissional IS NULL THEN 0 ELSE 1 END,
               COALESCE(sd.ordem, 999),
               sd.created_at,
               sd.id
           ) AS rn
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = v_proc.servico_id
       AND sd.ativo = true
       AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
       -- Exigencia por modalidade: linha com condicao_modalidade so entra
       -- para processos daquela modalidade. Ex.: habitualidade e clube so
       -- para CAC; efetiva necessidade so para defesa pessoal.
       AND (sd.condicao_modalidade IS NULL
            OR v_modalidade IS NULL
            OR v_modalidade = ANY(sd.condicao_modalidade))
  ),
  desejados AS (SELECT * FROM catalogo_bruto WHERE rn = 1),
  duplicados AS (SELECT * FROM catalogo_bruto WHERE rn > 1),
  ja AS (SELECT DISTINCT tipo_documento FROM public.qa_processo_documentos WHERE processo_id = p_processo_id),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor,
      prazo_recomendado_dias, escopo
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento,
           CASE WHEN v_profissao_upper IS NOT NULL
                 AND (d.tipo_documento ILIKE 'renda_%' OR d.tipo_documento ILIKE '%atividade%')
                THEN d.nome_documento || ' — ' || v_profissao_upper
                ELSE d.nome_documento END,
           d.etapa_segura, 'pendente', COALESCE(d.obrigatorio, true),
           d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao,
           d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
           d.orgao_emissor, d.prazo_recomendado_dias,
           COALESCE(d.escopo, 'processo')
      FROM desejados d
     WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING tipo_documento
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM inserted), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), 0)::int,
    COALESCE((SELECT COUNT(*) FROM duplicados), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE d.etapa_invalida), 0)::int,
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM inserted), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(d.tipo_documento ORDER BY d.tipo_documento) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM duplicados), ARRAY[]::text[]),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo_documento', d.tipo_documento, 'etapa_original', d.etapa, 'etapa_usada', d.etapa_segura) ORDER BY d.tipo_documento) FROM desejados d WHERE d.etapa_invalida), '[]'::jsonb)
  INTO v_ins, v_exi, v_dup, v_invalid, v_inserted_tipos, v_existing_tipos, v_duplicate_tipos, v_invalid_items;

  IF v_invalid > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_etapa_invalida_normalizada',
      format('Catálogo com %s etapa(s) inválida(s).', v_invalid),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'itens', v_invalid_items),
      'sistema');
  END IF;

  IF v_dup > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_duplicados_ignorados',
      format('Checklist ignorou %s item(ns) duplicado(s).', v_dup),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'tipos_documento', v_duplicate_tipos),
      'sistema');
  END IF;

  IF v_cli.cep IS NOT NULL AND v_cli.endereco IS NOT NULL
     AND v_cli.cidade IS NOT NULL AND v_cli.estado IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Endereço pré-preenchido do cadastro: ' ||
             v_cli.endereco || ', ' || COALESCE(v_cli.numero, 's/n') || ' - ' ||
             v_cli.cidade || '/' || v_cli.estado || ' - CEP ' || v_cli.cep,
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND tipo_documento ILIKE '%comprovante_residencia%'
       AND status = 'pendente';
    GET DIAGNOSTICS v_prevalid = ROW_COUNT;
  END IF;

  IF v_proc.servico_id IN (31, 44, 50, 51) THEN
    BEGIN
      v_endereco_seed     := public.qa_seed_endereco_5_anos(p_processo_id);
      v_endereco_aproveit := public.qa_aproveitar_endereco_cadastro_publico(p_processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_seed_endereco_5_anos / aproveitar falhou: %', SQLERRM;
    END;
  END IF;

  SELECT * INTO v_reuso
    FROM public.qa_reaproveitar_documentos_hub_processo(p_processo_id, 'checklist_explodido_pos_seed');

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (p_processo_id, 'checklist_explodido',
    format('Checklist explodido: %s ins, %s exist, %s dup, %s inv, %s cofre, %s slots end5anos, %s end aproveitados (svc=%s, cond=%s).',
           v_ins, v_exi, v_dup, v_invalid, COALESCE(v_reuso.reaproveitados, 0), v_endereco_seed, v_endereco_aproveit, v_proc.servico_id, v_condicao),
    jsonb_build_object(
      'servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao,
      'documentos_inseridos', v_inserted_tipos,
      'documentos_ja_existentes', v_existing_tipos,
      'documentos_ignorados_por_duplicidade', v_duplicate_tipos,
      'documentos_com_etapa_invalida_normalizada', v_invalid_items,
      'reaproveitados_cofre', COALESCE(v_reuso.reaproveitados, 0),
      'pre_validados', v_prevalid,
      'endereco_5_anos_slots_criados', v_endereco_seed,
      'endereco_cadastro_publico_aproveitado', v_endereco_aproveit
    ), 'sistema');

  inseridos := v_ins;
  ja_existentes := v_exi;
  reaproveitados_cofre := COALESCE(v_reuso.reaproveitados, 0);
  pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_explodir_checklist_processo(uuid) TO authenticated, service_role;

COMMIT;
