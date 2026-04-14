
-- Tabela principal de cadastro público
CREATE TABLE public.qa_cadastro_publico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dados pessoais
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  data_nascimento text,
  telefone_principal text NOT NULL,
  telefone_secundario text,
  email text NOT NULL,
  nome_mae text,
  estado_civil text,
  nacionalidade text DEFAULT 'Brasileiro(a)',
  profissao text,
  observacoes text,
  
  -- Endereço 1 - Residencial
  end1_cep text,
  end1_logradouro text,
  end1_numero text,
  end1_complemento text,
  end1_bairro text,
  end1_cidade text,
  end1_estado text,
  end1_latitude text,
  end1_longitude text,
  
  -- Endereço 2 - Opcional
  tem_segundo_endereco boolean DEFAULT false,
  end2_tipo text, -- comercial, correspondencia, outro
  end2_cep text,
  end2_logradouro text,
  end2_numero text,
  end2_complemento text,
  end2_bairro text,
  end2_cidade text,
  end2_estado text,
  end2_latitude text,
  end2_longitude text,
  
  -- Vínculo empresarial
  vinculo_tipo text, -- proprietario, socio, registrado, autonomo, nenhum
  
  -- Empresa (proprietário/sócio)
  emp_cnpj text,
  emp_razao_social text,
  emp_nome_fantasia text,
  emp_situacao_cadastral text,
  emp_data_abertura text,
  emp_cnae_principal text,
  emp_natureza_juridica text,
  emp_endereco text,
  emp_telefone text,
  emp_email text,
  emp_cargo_funcao text,
  emp_participacao_societaria text,
  
  -- Trabalho registrado
  trab_nome_empresa text,
  trab_cnpj_empresa text,
  trab_cargo_funcao text,
  trab_data_admissao text,
  trab_faixa_salarial text,
  trab_endereco_empresa text,
  trab_telefone_empresa text,
  
  -- Autônomo
  aut_atividade text,
  aut_nome_profissional text,
  aut_cnpj text,
  aut_telefone text,
  aut_endereco text,
  
  -- Consentimento / Anuência LGPD
  consentimento_dados_verdadeiros boolean NOT NULL DEFAULT false,
  consentimento_tratamento_dados boolean NOT NULL DEFAULT false,
  consentimento_texto text,
  consentimento_timestamp timestamptz,
  consentimento_ip text,
  consentimento_user_agent text,
  
  -- Status de processamento
  status text NOT NULL DEFAULT 'pendente', -- pendente, processado, integrado, rejeitado
  cliente_id_vinculado integer, -- FK para qa_clientes quando integrado
  processado_em timestamptz,
  processado_por text,
  notas_processamento text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices úteis
CREATE INDEX idx_qa_cadastro_publico_cpf ON public.qa_cadastro_publico(cpf);
CREATE INDEX idx_qa_cadastro_publico_status ON public.qa_cadastro_publico(status);
CREATE INDEX idx_qa_cadastro_publico_created ON public.qa_cadastro_publico(created_at DESC);

-- RLS: acesso público para INSERT (via edge function com service_role)
ALTER TABLE public.qa_cadastro_publico ENABLE ROW LEVEL SECURITY;

-- Política: ninguém lê diretamente via anon - apenas via service_role (edge function)
-- Isso garante que os dados ficam protegidos
