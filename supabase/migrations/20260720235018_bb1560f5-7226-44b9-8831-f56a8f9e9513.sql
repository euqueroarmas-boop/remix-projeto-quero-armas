
-- 1) Colunas de anexo no catálogo de serviços
ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS anexo_titulo TEXT,
  ADD COLUMN IF NOT EXISTS anexo_corpo_html TEXT,
  ADD COLUMN IF NOT EXISTS anexo_versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS anexo_atualizado_em TIMESTAMPTZ;

-- 2) Extrai cada bloco <h3>I.N. ...</h3>...</h3(seguinte)|<h2> do template vigente v10
--    e grava no serviço correspondente (match por Identificador (slug)).
DO $$
DECLARE
  tpl_body TEXT;
  miolo TEXT;
  bloco TEXT;
  parts TEXT[];
  slug_extract TEXT;
  titulo_extract TEXT;
  ini INT;
  fim INT;
BEGIN
  SELECT corpo_html INTO tpl_body
  FROM public.qa_contract_templates
  WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS' AND vigente = true
  LIMIT 1;

  IF tpl_body IS NULL THEN
    RAISE EXCEPTION 'Template CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS vigente não encontrado';
  END IF;

  ini := position('<h3' in tpl_body);
  fim := position('<h2>FIM DO INSTRUMENTO' in tpl_body);
  IF ini = 0 OR fim = 0 OR fim <= ini THEN
    RAISE EXCEPTION 'Não foi possível localizar o miolo do Anexo I no template vigente';
  END IF;

  miolo := substring(tpl_body FROM ini FOR (fim - ini));

  -- Split por lookahead em novo <h3>I.N.
  parts := regexp_split_to_array(miolo, '(?=<h3[^>]*>\s*I\.\d+\.)');

  FOR i IN 1 .. array_length(parts, 1) LOOP
    bloco := parts[i];
    IF bloco IS NULL OR bloco !~ '^<h3' THEN
      CONTINUE;
    END IF;
    slug_extract := (regexp_match(bloco, 'Identificador[^<]*\(\s*slug\s*\)\s*:?\s*([a-z0-9\-]+)', 'i'))[1];
    titulo_extract := btrim((regexp_match(bloco, '<h3[^>]*>\s*([^<]+?)\s*</h3>'))[1]);
    IF slug_extract IS NOT NULL THEN
      UPDATE public.qa_servicos_catalogo
      SET anexo_corpo_html = bloco,
          anexo_titulo = titulo_extract,
          anexo_versao = 1,
          anexo_atualizado_em = now()
      WHERE slug = slug_extract;
    END IF;
  END LOOP;
END $$;

-- 3) Anexo próprio para o pacote composto (serviço 58 — POSSE + AUTORIZAÇÃO + CRAF + GT)
UPDATE public.qa_servicos_catalogo
SET anexo_titulo = 'PACOTE: POSSE + AUTORIZAÇÃO DE COMPRA + CRAF + GT',
    anexo_corpo_html = COALESCE(
      (SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='posse-de-arma-de-fogo'), ''
    ) || COALESCE(
      (SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac'), ''
    ) || COALESCE(
      (SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='registro-e-apostilamento-de-arma-de-fogo-cac'), ''
    ) || COALESCE(
      (SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='guia-de-trafego-especial-cac'), ''
    ),
    anexo_versao = 1,
    anexo_atualizado_em = now()
WHERE servico_id = 58;

-- 4) Publica template v11 com placeholder dinâmico {{anexos_i_dinamicos}}
DO $$
DECLARE
  old_html TEXT;
  new_html TEXT;
  anexo_pos INT;
  fim_pos INT;
BEGIN
  SELECT corpo_html INTO old_html
  FROM public.qa_contract_templates
  WHERE codigo='CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS' AND versao=10
  LIMIT 1;

  IF old_html IS NULL THEN
    RAISE EXCEPTION 'Template v10 não encontrado';
  END IF;

  anexo_pos := position('<h2>ANEXO I' in old_html);
  fim_pos := position('<h2>FIM DO INSTRUMENTO' in old_html);
  IF anexo_pos = 0 OR fim_pos = 0 OR fim_pos <= anexo_pos THEN
    RAISE EXCEPTION 'Marcadores de Anexo I / FIM DO INSTRUMENTO não localizados no template v10';
  END IF;

  new_html := substring(old_html FROM 1 FOR anexo_pos - 1)
    || '<h2>ANEXO I --- DESCRIÇÃO DOS SERVIÇOS CONTRATADOS</h2>'
    || '<p>Este Anexo I integra o Contrato de Prestação de Serviços de Assessoria Técnica e Despacho Administrativo. O(s) serviço(s) efetivamente contratado(s) pela CONTRATANTE é(são) o(s) correspondente(s) ao(s) slug(s) indicado(s) no momento do aceite eletrônico, conforme detalhado nas seções abaixo.</p>'
    || '<p>Prazo de execução geral: 7 (sete) a 25 (vinte e cinco) dias úteis, contados a partir do recebimento da totalidade dos documentos válidos exigidos pelo checklist do serviço, observadas eventuais exigências adicionais do órgão público competente.</p>'
    || '{{anexos_i_dinamicos}}'
    || substring(old_html FROM fim_pos);

  -- Desativa v10 e publica v11 como vigente
  UPDATE public.qa_contract_templates
  SET vigente = false, updated_at = now()
  WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS' AND vigente = true;

  INSERT INTO public.qa_contract_templates (codigo, versao, titulo, corpo_html, vigente, data_publicacao, observacoes)
  SELECT codigo, 11, titulo, new_html, true, now(),
         'v11 — motor dinâmico de Anexo I por serviço (placeholder {{anexos_i_dinamicos}}). Migrado a partir da v10.'
  FROM public.qa_contract_templates
  WHERE codigo='CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS' AND versao=10;
END $$;
