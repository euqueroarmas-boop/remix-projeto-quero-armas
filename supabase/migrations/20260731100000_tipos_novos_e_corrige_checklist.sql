-- =============================================================================
-- Três tipos novos + correção do checklist de Autorização de Compra/Posse
--
-- Origem: análise do processo DEFERIDO do cliente Gilberto (18 documentos)
-- comparado ao checklist do cliente Gilson, em 31/07/2026.
--
-- Tipos novos, todos presentes no processo que deu certo e ausentes do
-- catálogo:
--   • boletim_ocorrencia            — a prova que sustenta a efetiva necessidade
--   • foto_3x4                      — exigida pela PF, nunca esteve no catálogo
--   • renda_ficha_cadastral_jucesp  — como a ocupação lícita de empresário foi
--                                     provada. Mesma finalidade do Contrato
--                                     Social / Requerimento de Empresário: a
--                                     Ficha Cadastral da Junta É o Requerimento
--                                     de Empresário, com outro nome.
--
-- Três defeitos corrigidos no checklist:
--   1. `certidao_antecedentes_criminais_estadual` estava sendo COBRADO do
--      cliente. É item PAI, agrupador — não existe documento para baixar. Já
--      havia sido desativado em 22/07, mas voltou a aparecer.
--   2. A certidão da POLÍCIA CIVIL (IIRGD) não era pedida em lugar nenhum,
--      embora seja uma das quatro estaduais e conste do processo deferido.
--   3. `declaracao_necessidade_efetiva` é slug órfão: não existe no catálogo do
--      Hub, então o cliente entregaria e a exigência nunca se cumpriria.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) CHECK de qa_documentos_cliente aceita os tipos novos ─────────────
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def IS NULL THEN
    RAISE NOTICE 'Constraint qa_doc_cliente_tipo_check não encontrada — nada a alterar.';
  ELSIF v_def LIKE '%boletim_ocorrencia%' THEN
    RAISE NOTICE 'Tipos novos já presentes no CHECK.';
  ELSE
    -- Acrescenta sem reescrever a lista inteira: menos risco de perder um tipo
    -- por transcrição. O texto da constraint atual é preservado e ampliado.
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE replace(
      'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def,
      '''outro''',
      '''outro'',''boletim_ocorrencia'',''foto_3x4'',''renda_ficha_cadastral_jucesp'''
    );
  END IF;
END $$;

-- ─── 2) Biblioteca ───────────────────────────────────────────────────────
INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, link_emissao, base_legal,
   emissor_padrao, ativo)
VALUES
  (
    'boletim_ocorrencia',
    'Boletim de Ocorrência',
    'efetiva_necessidade',
    'Registro policial de fato concreto (ameaça, furto, roubo, invasão) que sustenta o pedido de efetiva necessidade.',
    'Envie o PDF do BO como saiu da Delegacia Eletrônica ou da delegacia física. Pode enviar quantos tiver — cada ocorrência conta.',
    'É a prova que transforma a sua narrativa em fato. Sem ela, a efetiva necessidade fica sendo apenas alegação.',
    NULL, ARRAY['pdf'], NULL,
    'Lei 10.826/2003, art. 4º, § 1º; Decreto 11.615/2023',
    'cliente', true
  ),
  (
    'foto_3x4',
    'Foto 3x4 do requerente',
    'identificacao',
    'Foto no padrão 3x4, recente, usada na instrução do requerimento junto à Polícia Federal.',
    'Você não precisa ir a um fotógrafo: baixe seu documento digital (RG Digital, CIN ou CNH) pelo site do órgão, dê um print na tela, use a ferramenta de recorte do próprio celular para deixar só o rosto e envie a imagem.',
    'Se o documento digital não estiver à mão, uma foto de rosto com fundo claro também serve.',
    NULL, ARRAY['pdf','jpg','jpeg','png'], NULL,
    'IN DG/PF 201',
    'cliente', true
  ),
  (
    'renda_ficha_cadastral_jucesp',
    'Ficha Cadastral Completa (Junta Comercial)',
    'renda_ocupacao',
    'Ficha Cadastral Completa emitida pela Junta Comercial do estado. Traz NIRE, CNPJ, data de constituição, objeto social e o quadro de titular/sócios.',
    'Emita no portal da Junta Comercial do seu estado (em São Paulo, JUCESP Online) e envie o PDF original.',
    'Comprova ocupação lícita de empresário. Substitui o Contrato Social / Requerimento de Empresário — é o mesmo documento, com outro nome.',
    NULL, ARRAY['pdf'], NULL,
    'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 201',
    'cliente', true
  )
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao_o_que_e = EXCLUDED.descricao_o_que_e,
      descricao_como_enviar = EXCLUDED.descricao_como_enviar,
      observacao_cliente = EXCLUDED.observacao_cliente,
      ativo = true,
      updated_at = now();

-- ─── 3) Item PAI não é exigência: sai do catálogo e dos checklists ───────
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento = 'certidao_antecedentes_criminais_estadual';

-- Remove dos processos EM ANDAMENTO. Processo já finalizado fica como está —
-- histórico não se reescreve.
DELETE FROM public.qa_processo_documentos pd
 USING public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento = 'certidao_antecedentes_criminais_estadual'
   AND pd.status <> 'aprovado'
   AND COALESCE(p.status, '') NOT IN ('finalizado', 'deferido', 'indeferido', 'cancelado');

-- ─── 4) Slug órfão da efetiva necessidade ────────────────────────────────
-- `declaracao_necessidade_efetiva` não existe no catálogo do Hub. Aponta para
-- o código real, senão o cliente entrega e a exigência nunca se cumpre.
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo)
VALUES ('declaracao_necessidade_efetiva', 'comprovante_efetiva_necessidade')
ON CONFLICT DO NOTHING;

-- ─── 5) Polícia Civil (IIRGD) volta a ser exigida ────────────────────────
-- Uma das quatro certidões estaduais, presente no processo deferido e ausente
-- do checklist. Clona a configuração da certidão estadual de distribuição já
-- existente em cada serviço, para herdar etapa, ordem e obrigatoriedade.
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, emissor, escopo, formato_aceito, validade_dias,
  instrucoes, observacoes_cliente, orgao_emissor, prazo_recomendado_dias,
  condicao_profissional, link_emissao, biblioteca_id, ativo
)
SELECT
  sd.servico_id,
  'certidao_estadual_policia_civil',
  'Certidão Estadual — Polícia Civil',
  sd.etapa, sd.ordem, sd.obrigatorio,
  sd.obrigatorio_etapa02, sd.emissor, sd.escopo, sd.formato_aceito, sd.validade_dias,
  sd.instrucoes, sd.observacoes_cliente, 'Secretaria de Segurança Pública',
  sd.prazo_recomendado_dias, sd.condicao_profissional,
  'https://www.ssp.sp.gov.br/servicos/atestado-de-antecedentes',
  (SELECT id FROM public.qa_documentos_biblioteca WHERE codigo = 'certidao_estadual_policia_civil'),
  true
FROM public.qa_servicos_documentos sd
WHERE sd.tipo_documento = 'certidao_estadual_distribuicao_acoes_criminais'
  AND sd.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_documentos x
     WHERE x.servico_id = sd.servico_id
       AND x.tipo_documento = 'certidao_estadual_policia_civil'
       AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
  );

-- ─── 6) Reavalia as exigências com o catálogo corrigido ──────────────────
SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
