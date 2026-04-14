
-- ============================================
-- TABELA: qa_servicos (catálogo de serviços)
-- ============================================
CREATE TABLE public.qa_servicos (
  id serial PRIMARY KEY,
  nome_servico text NOT NULL,
  valor_servico numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.qa_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_servicos" ON public.qa_servicos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_servicos" ON public.qa_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_status_tipos
-- ============================================
CREATE TABLE public.qa_status_tipos (
  id serial PRIMARY KEY,
  nome_status text NOT NULL,
  tipo_status text NOT NULL DEFAULT 'SERVIÇO'
);
ALTER TABLE public.qa_status_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_status_tipos" ON public.qa_status_tipos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_status_tipos" ON public.qa_status_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_clientes
-- ============================================
CREATE TABLE public.qa_clientes (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  nome_completo text NOT NULL,
  cpf text,
  rg text,
  emissor_rg text,
  data_nascimento date,
  naturalidade text,
  nacionalidade text,
  nome_mae text,
  nome_pai text,
  expedicao_rg date,
  estado_civil text,
  titulo_eleitor text,
  endereco text,
  numero text,
  bairro text,
  cep text,
  cidade text,
  estado text,
  pais text DEFAULT 'Brasil',
  geolocalizacao text,
  endereco2 text,
  numero2 text,
  cep2 text,
  bairro2 text,
  cidade2 text,
  estado2 text,
  pais2 text,
  geolocalizacao2 text,
  profissao text,
  email text,
  escolaridade text,
  celular text,
  cliente_lions boolean DEFAULT false,
  imagem text,
  excluido boolean DEFAULT false,
  observacao text,
  complemento text,
  complemento2 text,
  status text DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_clientes" ON public.qa_clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_clientes" ON public.qa_clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_clubes
-- ============================================
CREATE TABLE public.qa_clubes (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  nome_clube text NOT NULL,
  cnpj text,
  numero_cr text,
  data_validade date,
  endereco text
);
ALTER TABLE public.qa_clubes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_clubes" ON public.qa_clubes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_clubes" ON public.qa_clubes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_vendas
-- ============================================
CREATE TABLE public.qa_vendas (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  data_cadastro date,
  forma_pagamento text,
  data_protocolo date,
  data_deferimento date,
  data_ultima_atualizacao text,
  status text DEFAULT 'À INICIAR',
  numero_processo text,
  valor_a_pagar numeric DEFAULT 0,
  cliente_id integer REFERENCES public.qa_clientes(id_legado),
  desconto numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_vendas" ON public.qa_vendas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_vendas" ON public.qa_vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_itens_venda
-- ============================================
CREATE TABLE public.qa_itens_venda (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  venda_id integer,
  servico_id integer,
  valor numeric DEFAULT 0,
  data_protocolo date,
  data_deferimento date,
  data_ultima_atualizacao date,
  status text DEFAULT 'À INICIAR',
  numero_processo text
);
ALTER TABLE public.qa_itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_itens_venda" ON public.qa_itens_venda FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_itens_venda" ON public.qa_itens_venda FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_crafs
-- ============================================
CREATE TABLE public.qa_crafs (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  cliente_id integer,
  data_validade date,
  nome_arma text,
  numero_sigma text,
  numero_arma text,
  nome_craf text DEFAULT 'CRAF'
);
ALTER TABLE public.qa_crafs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_crafs" ON public.qa_crafs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_crafs" ON public.qa_crafs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_gtes
-- ============================================
CREATE TABLE public.qa_gtes (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  cliente_id integer,
  data_validade date,
  nome_arma text,
  numero_sigma text,
  numero_arma text,
  nome_gte text DEFAULT 'GTE'
);
ALTER TABLE public.qa_gtes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_gtes" ON public.qa_gtes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_gtes" ON public.qa_gtes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_filiacoes
-- ============================================
CREATE TABLE public.qa_filiacoes (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  numero_filiacao text,
  validade_filiacao date,
  clube_id integer,
  nome_filiacao text DEFAULT 'FILIACAO',
  cliente_id integer
);
ALTER TABLE public.qa_filiacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_filiacoes" ON public.qa_filiacoes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_filiacoes" ON public.qa_filiacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_cadastro_cr
-- ============================================
CREATE TABLE public.qa_cadastro_cr (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  cliente_id integer,
  numero_cr text,
  validade_cr date,
  validade_laudo_psicologico date,
  validade_exame_tiro date,
  senha_gov text,
  num_item_servico_cr integer DEFAULT 0,
  check_laudo_psi boolean DEFAULT false,
  check_exame_tiro boolean DEFAULT false
);
ALTER TABLE public.qa_cadastro_cr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_cadastro_cr" ON public.qa_cadastro_cr FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_cadastro_cr" ON public.qa_cadastro_cr FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_terceiros
-- ============================================
CREATE TABLE public.qa_terceiros (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  cliente_id integer,
  nome_completo text,
  cpf text,
  data_nascimento date,
  naturalidade text,
  nacionalidade text,
  estado_civil text,
  profissao text,
  endereco text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  pais text,
  cep text,
  geolocalizacao text,
  reside_desde date,
  reside_ate date,
  complemento text
);
ALTER TABLE public.qa_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_terceiros" ON public.qa_terceiros FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_terceiros" ON public.qa_terceiros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TABELA: qa_tempo_validade (config de prazos)
-- ============================================
CREATE TABLE public.qa_tempo_validade (
  id serial PRIMARY KEY,
  id_legado integer UNIQUE,
  nome_configuracao text NOT NULL,
  tempo_dias integer DEFAULT 365,
  primeiro_aviso_dias integer DEFAULT 120,
  segundo_aviso_dias integer DEFAULT 90
);
ALTER TABLE public.qa_tempo_validade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon full access qa_tempo_validade" ON public.qa_tempo_validade FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth full access qa_tempo_validade" ON public.qa_tempo_validade FOR ALL TO authenticated USING (true) WITH CHECK (true);
