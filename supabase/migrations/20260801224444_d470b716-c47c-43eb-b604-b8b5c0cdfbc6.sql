
CREATE TABLE IF NOT EXISTS public.qa_declaracoes_residencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_cliente_id integer NOT NULL,
  documento_comprovante_id uuid,
  requerente_nome text NOT NULL,
  requerente_cpf text,
  requerente_nacionalidade text,
  requerente_naturalidade text,
  requerente_nascimento date,
  requerente_profissao text,
  requerente_estado_civil text,
  responsavel_nome text NOT NULL,
  responsavel_cpf text,
  responsavel_nacionalidade text,
  responsavel_naturalidade text,
  responsavel_nascimento date,
  responsavel_profissao text,
  responsavel_estado_civil text,
  responsavel_doc_path text,
  endereco_completo text NOT NULL,
  mora_desde text,
  conteudo_html text NOT NULL,
  status text NOT NULL DEFAULT 'gerada_pendente_assinatura',
  gerado_em timestamptz NOT NULL DEFAULT now(),
  sessao_geracao_json jsonb,
  arquivo_assinado_path text,
  assinado_enviado_em timestamptz,
  sessao_envio_json jsonb,
  assinatura_status text,
  assinatura_signatario text,
  assinatura_cpf text,
  assinatura_data timestamptz,
  assinatura_autoridade text,
  assinatura_icp_brasil boolean,
  assinatura_motivo_falha text,
  assinatura_detalhes_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_declaracoes_residencia TO authenticated;
GRANT ALL ON public.qa_declaracoes_residencia TO service_role;

ALTER TABLE public.qa_declaracoes_residencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente_le_suas_declaracoes"
ON public.qa_declaracoes_residencia
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.qa_clientes c
    WHERE (c.id = qa_declaracoes_residencia.qa_cliente_id OR c.id_legado = qa_declaracoes_residencia.qa_cliente_id)
      AND c.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_qa_decl_residencia_cliente
  ON public.qa_declaracoes_residencia (qa_cliente_id, created_at DESC);
