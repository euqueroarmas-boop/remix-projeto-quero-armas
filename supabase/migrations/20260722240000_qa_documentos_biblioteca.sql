-- Biblioteca central de documentos (mestre alfabético).
-- Ideia: cada exigência que aparece em checklist de serviço é uma linha aqui,
-- com o passo a passo que o cliente vê. O checklist do serviço apenas
-- APONTA para o item da biblioteca — o texto fica em um lugar só e edições
-- se propagam. Adição incremental: a coluna biblioteca_id em
-- qa_servicos_documentos é OPCIONAL — checklists antigos continuam
-- funcionando sem apontar para a biblioteca.

-- ─── 1. Tabela mestre ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_documentos_biblioteca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Chave amigável e única — usada como slug técnico e para busca.
  codigo text NOT NULL UNIQUE,
  -- Nome que aparece na biblioteca e default para o cliente.
  nome text NOT NULL,
  -- Categoria de agrupamento (identificacao, residencia, ocupacao_licita,
  -- certidoes, laudos, arma_acervo, declaracoes, outros).
  categoria text NOT NULL DEFAULT 'outros',
  -- Passo a passo — o texto que o cliente vê no card do documento.
  descricao_o_que_e text,          -- "O que é este documento"
  descricao_como_enviar text,      -- "Como enviar" (instruções passo a passo)
  observacao_cliente text,         -- Aviso curto exibido junto do card
  -- Configuração operacional (defaults; podem ser sobrescritos por serviço).
  validade_dias integer,           -- null = sem validade
  formato_aceito text[] NOT NULL DEFAULT ARRAY['pdf','jpg','jpeg','png'],
  link_emissao text,               -- URL do órgão emissor
  link_modelo text,                -- URL de modelo/exemplo baixável
  base_legal text,                 -- ex.: "IN DG/PF 201 art. 3º"
  emissor_padrao text NOT NULL DEFAULT 'cliente',
  -- Estado
  ativo boolean NOT NULL DEFAULT true,
  arquivado_em timestamptz,
  arquivado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_qa_bib_categoria CHECK (categoria IN (
    'identificacao','residencia','ocupacao_licita','certidoes',
    'laudos','arma_acervo','declaracoes','outros'
  ))
);

CREATE INDEX IF NOT EXISTS idx_qa_bib_categoria_nome ON public.qa_documentos_biblioteca(categoria, nome);
CREATE INDEX IF NOT EXISTS idx_qa_bib_ativo ON public.qa_documentos_biblioteca(ativo) WHERE ativo;

-- RLS: admin escreve, staff lê, público não acessa
ALTER TABLE public.qa_documentos_biblioteca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_bib_admin_all ON public.qa_documentos_biblioteca;
CREATE POLICY qa_bib_admin_all ON public.qa_documentos_biblioteca
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil = 'administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil = 'administrador')
  );

DROP POLICY IF EXISTS qa_bib_staff_read ON public.qa_documentos_biblioteca;
CREATE POLICY qa_bib_staff_read ON public.qa_documentos_biblioteca
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil IN ('administrador','operador'))
  );

-- updated_at automático
DROP TRIGGER IF EXISTS trg_qa_bib_touch ON public.qa_documentos_biblioteca;
CREATE TRIGGER trg_qa_bib_touch
BEFORE UPDATE ON public.qa_documentos_biblioteca
FOR EACH ROW EXECUTE FUNCTION public.qa_touch_updated_at();

-- ─── 2. Link opcional: qa_servicos_documentos aponta para a biblioteca ──────
-- Adição não destrutiva. Linhas antigas ficam com biblioteca_id = NULL e
-- continuam funcionando como sempre (texto local, sem herança).
ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS biblioteca_id uuid REFERENCES public.qa_documentos_biblioteca(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qa_servicos_doc_biblioteca ON public.qa_servicos_documentos(biblioteca_id) WHERE biblioteca_id IS NOT NULL;

-- ─── 3. Snapshots de checklist (safety net) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_servicos_documentos_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id integer NOT NULL REFERENCES public.qa_servicos(id) ON DELETE CASCADE,
  motivo text,
  payload jsonb NOT NULL,           -- array de qa_servicos_documentos serializado
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid
);
CREATE INDEX IF NOT EXISTS idx_qa_snap_servico ON public.qa_servicos_documentos_snapshots(servico_id, criado_em DESC);

ALTER TABLE public.qa_servicos_documentos_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa_snap_admin ON public.qa_servicos_documentos_snapshots;
CREATE POLICY qa_snap_admin ON public.qa_servicos_documentos_snapshots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil = 'administrador')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = auth.uid() AND perfil = 'administrador')
  );

-- ─── 4. Seeds iniciais (biblioteca começa populada com o essencial) ─────────
-- Fonte: documentosHubCatalogo.ts (frontend). Insere apenas se ainda não existe.
INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   validade_dias, link_emissao, base_legal)
VALUES
  -- Identificação
  ('cin',                     'CIN — Carteira de Identidade Nacional', 'identificacao',
    'Documento oficial de identidade emitido pelos institutos de identificação estaduais, padronizado nacionalmente.',
    'Envie foto legível da CIN, frente e verso, sem cortes.', NULL, 'https://www.gov.br/pt-br/servicos/emitir-carteira-de-identidade-nacional', 'Lei nº 14.534/2023'),
  ('rg_com_cpf',              'RG (com CPF)', 'identificacao',
    'Registro Geral com CPF no mesmo documento.',
    'Envie foto legível do RG, frente e verso, com CPF visível.', NULL, NULL, NULL),
  ('cnh',                     'CNH — Carteira Nacional de Habilitação', 'identificacao',
    'Documento oficial de habilitação para conduzir veículos, aceito como identificação.',
    'Envie foto legível da CNH, frente e verso, dentro da validade.', 1825, 'https://www.gov.br/pt-br/servicos/consultar-a-carteira-nacional-de-habilitacao-cnh-digital', NULL),
  ('cpf',                     'CPF', 'identificacao',
    'Cadastro de Pessoa Física da Receita Federal.',
    'Envie o CPF em documento oficial (foto ou cartão).', NULL, 'https://www.gov.br/receitafederal/pt-br/servicos/cpf', NULL),
  ('certidao_alteracao_nome', 'Certidão averbada de alteração de nome', 'identificacao',
    'Certidão do cartório com averbação de mudança de nome (casamento, divórcio, retificação).',
    'Envie a certidão averbada emitida pelo cartório, com selo digital ou carimbo original.', NULL, NULL, NULL),

  -- Residência
  ('comprovante_residencia',  'Comprovante de residência', 'residencia',
    'Documento em nome do cliente que comprove endereço atualizado (últimos 90 dias).',
    'Envie conta de energia, água, telefone, gás ou correspondência bancária, EM SEU NOME, emitida nos últimos 90 dias.',
    90, NULL, 'IN DG/PF 201'),
  ('declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel', 'residencia',
    'Quando o comprovante não está no seu nome, o responsável pelo imóvel declara que você reside ali.',
    'Peça ao responsável do imóvel para assinar declaração informando que você reside no endereço; anexe o comprovante em nome do declarante.',
    NULL, NULL, NULL),

  -- Ocupação lícita
  ('comprovante_ocupacao_licita', 'Comprovante de ocupação lícita', 'ocupacao_licita',
    'Documento que comprova sua atividade profissional lícita.',
    'Envie contrato social (empresário), holerite (funcionário), decore (autônomo) ou declaração de MEI.', NULL, NULL, 'IN DG/PF 201'),
  ('cartao_cnpj_mei',         'Cartão CNPJ / MEI', 'ocupacao_licita',
    'Comprovante de inscrição do CNPJ ou certificado MEI.',
    'Envie o cartão CNPJ atualizado ou o Certificado da Condição de MEI.', 90, 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor', NULL),

  -- Certidões
  ('certidao_antecedentes_criminais_federal', 'Certidão de Antecedentes Criminais — Justiça Federal', 'certidoes',
    'Nada consta federal — emitida pelo site do TRF ou Justiça Federal.',
    'Emita no site do TRF da sua região e envie o PDF original (não escaneado).', 90, 'https://www.jf.jus.br/', 'IN DG/PF 201'),
  ('certidao_antecedentes_criminais_estadual', 'Certidão de Antecedentes Criminais — Justiça Estadual', 'certidoes',
    'Nada consta estadual — emitida pelo TJ do estado onde reside.',
    'Emita no site do TJ do seu estado e envie o PDF original.', 90, NULL, 'IN DG/PF 201'),
  ('certidao_antecedentes_criminais_militar', 'Certidão de Antecedentes Criminais — Justiça Militar', 'certidoes',
    'Nada consta militar — emitida pelo STM (Superior Tribunal Militar).',
    'Emita no site do STM e envie o PDF original.', 90, 'https://www.stm.jus.br/', 'IN DG/PF 201'),
  ('certidao_antecedentes_criminais_eleitoral', 'Certidão de Antecedentes Criminais — Justiça Eleitoral', 'certidoes',
    'Nada consta eleitoral — emitida pelo TSE.',
    'Emita no site do TSE e envie o PDF original.', 90, 'https://www.tse.jus.br/', 'IN DG/PF 201'),

  -- Laudos
  ('laudo_psicologico',       'Laudo Psicológico', 'laudos',
    'Laudo de aptidão psicológica emitido por psicólogo credenciado pela Polícia Federal.',
    'Realize o exame com psicólogo credenciado PF e envie o laudo original em PDF, com carimbo e assinatura.',
    365, NULL, 'IN DG/PF 201, art. 5º'),
  ('laudo_capacidade_tecnica', 'Laudo de Capacidade Técnica (Habilitação de Tiro)', 'laudos',
    'Laudo de aptidão técnica para manuseio de arma, emitido por instrutor credenciado PF.',
    'Realize o teste com instrutor credenciado PF e envie o laudo original em PDF.',
    365, NULL, 'IN DG/PF 201, art. 5º'),

  -- Arma / acervo
  ('nota_fiscal_arma',        'Nota Fiscal da Arma', 'arma_acervo',
    'Nota fiscal de aquisição da arma de fogo.',
    'Envie a nota fiscal emitida pela loja/comércio autorizado, em seu nome.', NULL, NULL, NULL),
  ('craf',                    'CRAF — Certificado de Registro de Arma de Fogo', 'arma_acervo',
    'Documento oficial de registro da arma.',
    'Envie o CRAF vigente, frente e verso, legível.', NULL, NULL, 'Lei 10.826/2003'),
  ('gte',                     'GTE — Guia de Tráfego', 'arma_acervo',
    'Autorização para transporte da arma.',
    'Envie a GTE vigente, PDF original.', NULL, NULL, 'Lei 10.826/2003'),
  ('autorizacao_compra',      'Autorização de Compra de Arma', 'arma_acervo',
    'Autorização vigente para aquisição de arma de fogo.',
    'Envie a autorização vigente emitida pela PF.', NULL, NULL, 'Lei 10.826/2003'),

  -- Declarações
  ('declaracao_residencia_isolada', 'Declaração de residência isolada', 'declaracoes',
    'Declaração de que a residência está em local isolado ou área rural.',
    'Envie a declaração assinada de próprio punho ou modelo do sistema.', NULL, NULL, NULL),
  ('declaracao_necessidade_efetiva', 'Declaração de efetiva necessidade', 'declaracoes',
    'Declaração fundamentada da necessidade da arma para porte.',
    'Envie a declaração fundamentada conforme modelo, com sua justificativa pessoal.', NULL, NULL, 'Lei 10.826/2003, art. 10')
ON CONFLICT (codigo) DO NOTHING;

COMMENT ON TABLE public.qa_documentos_biblioteca IS
  'Biblioteca central de documentos. Fonte única do passo a passo por documento. Serviços apontam para itens daqui via qa_servicos_documentos.biblioteca_id.';
