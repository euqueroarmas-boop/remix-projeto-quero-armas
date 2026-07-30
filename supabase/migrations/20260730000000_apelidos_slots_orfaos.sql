-- Liga ao Hub Documental slots de processo que estavam órfãos.
--
-- Sintoma relatado: cliente enviou a Certidão de Crimes Eleitorais, o Hub
-- confirmou o reaproveitamento ("a exigência foi marcada como cumprida"), e o
-- checklist continuou listando a mesma certidão como pendente.
--
-- Causa: o catálogo de serviços (qa_servicos_documentos) usa nomes próprios
-- para as exigências, diferentes dos slugs do Hub. A ponte
-- qa_tipo_documento_aliases cobria apenas parte deles. Sem apelido, nem a
-- trigger nem qa_processo_rever_exigencias conseguem casar documento e
-- exigência — o slot fica pendente para sempre e o cliente é cobrado de novo
-- por algo que já entregou.
--
-- Uma varredura encontrou 22 slots sem correspondência. Esta migration liga os
-- que são o MESMO documento com outro nome — correspondência literal, sem
-- interpretação. Os demais (justiça militar estadual, segundo grau, carteira
-- funcional e declarações de acervo) ficam de fora de propósito: exigem
-- decisão de negócio sobre qual documento os satisfaz, e mapear errado faria
-- um documento cumprir a exigência de outro — justamente o que leva a
-- indeferimento na PF.

BEGIN;

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  -- Certidões: mesmo documento, nomenclatura antiga do catálogo de serviços.
  ('certidao_antecedentes_criminais_eleitoral', 'antecedentes_eleitoral'),
  ('certidao_antecedentes_criminais_estadual',  'antecedentes_estadual'),
  ('certidao_antecedentes_criminais_federal',   'antecedentes_federal'),
  ('certidao_antecedentes_criminais_militar',   'antecedentes_militar'),

  -- Comprovante de residência por ano: o casamento por ano_competencia já é
  -- feito pela trigger e por qa_processo_rever_exigencias, então um
  -- comprovante só fecha o ano da própria emissão.
  ('comprovante_residencia_ano_1', 'comprovante_residencia'),
  ('comprovante_residencia_ano_2', 'comprovante_residencia'),
  ('comprovante_residencia_ano_3', 'comprovante_residencia'),
  ('comprovante_residencia_ano_4', 'comprovante_residencia'),
  ('comprovante_em_nome_titular',  'comprovante_residencia'),

  -- Declaração do responsável pelo imóvel: mesma declaração, dois momentos.
  ('declaracao_responsavel_imovel_atual',   'declaracao_responsavel_imovel'),
  ('declaracao_responsavel_imovel_passado', 'declaracao_responsavel_imovel')
ON CONFLICT DO NOTHING;

-- Reavalia todas as exigências pendentes com os apelidos novos. Fecha de
-- imediato o que o cliente já entregou — inclusive a certidão do caso relatado.
SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
