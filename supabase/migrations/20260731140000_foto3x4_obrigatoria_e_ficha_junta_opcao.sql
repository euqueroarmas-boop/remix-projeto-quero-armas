-- =============================================================================
-- Foto 3x4 vira exigência; Ficha da Junta vira alternativa ao Contrato Social
--
-- Decisões do usuário (31/07/2026):
--   • Foto 3x4 é universal nos requerimentos de POSSE (autorização de compra) e
--     de PORTE. Entra também nos processos JÁ ABERTOS.
--   • Ficha Cadastral da Junta é ALTERNATIVA ao Contrato Social para quem
--     declara ser empresário: entrega uma OU outra, nunca as duas.
--   • Boletim de Ocorrência NÃO vira exigência — nem todo cliente tem BO. Ele é
--     prova opcional dentro da efetiva necessidade, e entra na lógica própria
--     desse módulo.
--
-- Como o sistema modela alternativa: `condicao_profissional` diz para quem o
-- item aparece, e `obrigatorio = false` marca que é opção dentro do grupo. Foi
-- assim que Contrato Social, Cartão CNPJ e CCMEI já estavam configurados.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ═══ A) FOTO 3x4 ═════════════════════════════════════════════════════════

-- A.1 Modelo do serviço — vale para processos novos
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo,
   emissor, escopo, formato_aceito, biblioteca_id, observacoes_cliente)
SELECT s.id, 'foto_3x4', 'Foto 3x4 do requerente', 'base', true, 2, true,
       'cliente', 'processo', ARRAY['pdf','jpg','jpeg','png'],
       (SELECT id FROM public.qa_documentos_biblioteca WHERE codigo = 'foto_3x4'),
       'Baixe seu documento digital (RG Digital, CIN ou CNH) pelo site do órgão, dê um print, recorte só o rosto pela ferramenta do próprio celular e envie.'
FROM public.qa_servicos s
WHERE (s.nome_servico ILIKE '%POSSE%'
    OR s.nome_servico ILIKE '%PORTE%'
    OR s.nome_servico ILIKE '%AUTORIZA%COMPRA%')
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_documentos x
     WHERE x.servico_id = s.id AND x.tipo_documento = 'foto_3x4'
  );

-- A.2 Processos já abertos. Processo finalizado fica intacto: não se acrescenta
--     exigência a quem já teve o pedido julgado.
INSERT INTO public.qa_processo_documentos
  (processo_id, cliente_id, tipo_documento, nome_documento, etapa, status,
   obrigatorio, formato_aceito, observacoes_cliente, escopo)
SELECT p.id, p.cliente_id, 'foto_3x4', 'Foto 3x4 do requerente', 'base', 'pendente',
       true, ARRAY['pdf','jpg','jpeg','png'],
       'Baixe seu documento digital (RG Digital, CIN ou CNH) pelo site do órgão, dê um print, recorte só o rosto pela ferramenta do próprio celular e envie.',
       'processo'
FROM public.qa_processos p
JOIN public.qa_servicos s ON s.id = p.servico_id
WHERE (s.nome_servico ILIKE '%POSSE%'
    OR s.nome_servico ILIKE '%PORTE%'
    OR s.nome_servico ILIKE '%AUTORIZA%COMPRA%')
  AND COALESCE(p.status,'') NOT IN ('finalizado','deferido','indeferido','cancelado')
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_processo_documentos x
     WHERE x.processo_id = p.id AND x.tipo_documento = 'foto_3x4'
  );

-- ═══ B) FICHA DA JUNTA — alternativa ao Contrato Social ══════════════════

INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo,
   emissor, escopo, formato_aceito, condicao_profissional, biblioteca_id,
   observacoes_cliente)
SELECT sd.servico_id, 'renda_ficha_cadastral_jucesp',
       'Ficha Cadastral Completa (Junta Comercial)',
       sd.etapa, false, sd.ordem, true,
       sd.emissor, sd.escopo, ARRAY['pdf'], 'empresario',
       (SELECT id FROM public.qa_documentos_biblioteca WHERE codigo = 'renda_ficha_cadastral_jucesp'),
       'Alternativa ao Contrato Social: a Ficha Cadastral da Junta é o próprio Requerimento de Empresário. Envie uma das duas.'
FROM public.qa_servicos_documentos sd
WHERE sd.tipo_documento = 'renda_contrato_social'
  AND sd.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_servicos_documentos x
     WHERE x.servico_id = sd.servico_id
       AND x.tipo_documento = 'renda_ficha_cadastral_jucesp'
  );

-- B.2 Só entra em processo aberto de quem JÁ tem o Contrato Social no
--     checklist — ou seja, de quem declarou ser empresário. MEI não recebe:
--     a comprovação dele é o CCMEI.
INSERT INTO public.qa_processo_documentos
  (processo_id, cliente_id, tipo_documento, nome_documento, etapa, status,
   obrigatorio, formato_aceito, observacoes_cliente, escopo)
SELECT pd.processo_id, pd.cliente_id, 'renda_ficha_cadastral_jucesp',
       'Ficha Cadastral Completa (Junta Comercial)',
       pd.etapa, 'pendente', false, ARRAY['pdf'],
       'Alternativa ao Contrato Social: a Ficha Cadastral da Junta é o próprio Requerimento de Empresário. Envie uma das duas.',
       pd.escopo
FROM public.qa_processo_documentos pd
JOIN public.qa_processos p ON p.id = pd.processo_id
WHERE pd.tipo_documento = 'renda_contrato_social'
  AND COALESCE(p.status,'') NOT IN ('finalizado','deferido','indeferido','cancelado')
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_processo_documentos x
     WHERE x.processo_id = pd.processo_id
       AND x.tipo_documento = 'renda_ficha_cadastral_jucesp'
  );

SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
