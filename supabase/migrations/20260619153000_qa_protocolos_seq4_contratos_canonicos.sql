BEGIN;

COMMENT ON COLUMN public.qa_protocolos.numero IS
  'Formato: QA{SIGLA}{ANO}{SEQ4}, sem tracos ou separadores. Exemplo: QACR20260001.';

CREATE OR REPLACE FUNCTION public.qa_gerar_protocolo(p_venda_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_id       INT;
  v_venda_legado   INT;
  v_servico_id     INT;
  v_qa_cliente_id  INT;
  v_sigla          TEXT;
  v_ano            INT;
  v_seq            INT;
  v_numero         TEXT;
  v_existing       TEXT;
BEGIN
  SELECT v.id, v.id_legado, vi.servico_id, v.cliente_id
    INTO v_venda_id, v_venda_legado, v_servico_id, v_qa_cliente_id
    FROM public.qa_vendas v
    LEFT JOIN public.qa_itens_venda vi ON vi.venda_id = v.id_legado
   WHERE v.id = p_venda_id
      OR v.id_legado = p_venda_id
   ORDER BY CASE WHEN v.id = p_venda_id THEN 0 ELSE 1 END, vi.id ASC
   LIMIT 1;

  IF v_venda_id IS NULL THEN
    RAISE EXCEPTION 'venda_id % nao encontrada', p_venda_id;
  END IF;

  SELECT numero
    INTO v_existing
    FROM public.qa_protocolos
   WHERE venda_id = v_venda_id
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    SELECT 'QA'
           || regexp_replace(upper(coalesce(sigla_protocolo, 'GERAL')), '[^A-Z0-9]+', '', 'g')
           || ano::TEXT
           || LPAD(sequencia_ano::TEXT, 4, '0')
      INTO v_numero
      FROM public.qa_protocolos
     WHERE venda_id = v_venda_id
     LIMIT 1;

    UPDATE public.qa_protocolos
       SET numero = v_numero,
           sigla_protocolo = regexp_replace(upper(coalesce(sigla_protocolo, 'GERAL')), '[^A-Z0-9]+', '', 'g'),
           updated_at = now()
     WHERE venda_id = v_venda_id
       AND numero IS DISTINCT FROM v_numero;

    RETURN v_numero;
  END IF;

  IF v_servico_id IS NULL THEN
    RAISE EXCEPTION 'venda_id % sem servico vinculado', p_venda_id;
  END IF;

  SELECT c.sigla_protocolo
    INTO v_sigla
    FROM public.qa_servicos_catalogo c
   WHERE c.servico_id = v_servico_id
   LIMIT 1;

  v_sigla := regexp_replace(upper(coalesce(v_sigla, 'GERAL')), '[^A-Z0-9]+', '', 'g');
  IF v_sigla = '' THEN v_sigla := 'GERAL'; END IF;

  v_ano := EXTRACT(YEAR FROM now())::INT;
  v_seq := public.qa_proximo_protocolo(v_sigla, v_ano);
  v_numero := 'QA' || v_sigla || v_ano || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO public.qa_protocolos (
    numero, venda_id, qa_cliente_id, servico_id,
    sigla_protocolo, sequencia_ano, ano, status
  ) VALUES (
    v_numero, v_venda_id, v_qa_cliente_id, v_servico_id,
    v_sigla, v_seq, v_ano, 'aguardando_documentos'
  );

  RETURN v_numero;
END;
$$;

COMMENT ON FUNCTION public.qa_gerar_protocolo IS
  'Gera numero de protocolo no formato QA{SIGLA}{ANO}{SEQ4}, sem tracos. Aceita qa_vendas.id ou id_legado. Idempotente.';

UPDATE public.qa_protocolos
   SET sigla_protocolo = regexp_replace(upper(coalesce(sigla_protocolo, 'GERAL')), '[^A-Z0-9]+', '', 'g'),
       numero = 'QA'
                || regexp_replace(upper(coalesce(sigla_protocolo, 'GERAL')), '[^A-Z0-9]+', '', 'g')
                || ano::TEXT
                || LPAD(sequencia_ano::TEXT, 4, '0'),
       updated_at = now()
 WHERE ano IS NOT NULL
   AND sequencia_ano IS NOT NULL;

INSERT INTO public.qa_protocolo_sequencias (sigla, ano, ultimo_numero, updated_at)
SELECT sigla_protocolo, ano, max(sequencia_ano), now()
  FROM public.qa_protocolos
 WHERE sigla_protocolo IS NOT NULL
 GROUP BY sigla_protocolo, ano
ON CONFLICT (sigla, ano)
DO UPDATE SET
  ultimo_numero = greatest(public.qa_protocolo_sequencias.ultimo_numero, excluded.ultimo_numero),
  updated_at = now();

DO $$
DECLARE
  r RECORD;
  v_numero TEXT;
BEGIN
  FOR r IN
    SELECT c.id AS contract_id, v.id AS venda_id
      FROM public.qa_contracts c
      JOIN public.qa_vendas v ON v.id_legado = c.venda_id
     WHERE c.contract_number IS NULL
        OR c.contract_number LIKE 'QA-%'
        OR c.contract_number !~ '^QA[A-Z0-9]+[0-9]{8}$'
  LOOP
    v_numero := public.qa_gerar_protocolo(r.venda_id);
    UPDATE public.qa_contracts
       SET contract_number = v_numero
     WHERE id = r.contract_id
       AND contract_number IS DISTINCT FROM v_numero;
  END LOOP;
END;
$$;

COMMIT;
