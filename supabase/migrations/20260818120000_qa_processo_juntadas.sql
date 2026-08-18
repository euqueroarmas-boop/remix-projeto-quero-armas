-- ============================================================================
-- A JUNTADA DEIXA DE SER UM ARQUIVO QUE NINGUÉM CONSEGUE PEGAR
-- ----------------------------------------------------------------------------
-- Achado mais grave do fim do fluxo, auditoria de 18/08/2026.
--
-- `qa-montar-juntada` faz o trabalho inteiro: junta todos os documentos
-- aprovados e vigentes na ordem canônica do protocolo, converte imagem em
-- página, e produz o PDF único que a Polícia Federal exige ("digitalizar todos
-- os documentos em um único arquivo .pdf"). Nos casos reais deu 42, 55 e 106
-- páginas.
--
-- E aí ele sobe o arquivo para o storage e grava o caminho DENTRO do
-- `dados_json` de um evento. Nenhuma linha do front lê esse caminho. A equipe
-- clica em "MONTAR JUNTADA", vê um toast de sucesso, e não existe botão, link
-- ou tela — nem para ela, nem para o cliente — que abra o PDF. Só pelo console
-- do Supabase.
--
-- Pior: o checklist tem o item `juntada_assinada`, em que o cliente precisa
-- assinar a juntada no gov.br. Ele nunca recebe o arquivo para assinar. É uma
-- exigência impossível de cumprir.
--
-- Esta tabela dá endereço ao arquivo. Guarda também O QUE entrou e o que ficou
-- de fora — quando a PF questiona uma peça do dossiê, a pergunta é "o que foi
-- que a gente entregou naquele dia", e evento em JSON não responde isso.
--
-- Versionada de propósito: remontar depois de o cliente corrigir um documento
-- é rotina, e a juntada anterior é o que foi efetivamente protocolado.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.qa_processo_juntadas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id   uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,
  cliente_id    bigint NOT NULL,

  -- Sobe a cada remontagem. A maior é a vigente.
  versao        integer NOT NULL DEFAULT 1,

  bucket        text NOT NULL DEFAULT 'qa-processo-docs',
  storage_path  text NOT NULL,
  paginas       integer NOT NULL DEFAULT 0,

  -- O que entrou, na ordem do protocolo, e o que ficou de fora com o motivo.
  itens_json     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ignorados_json jsonb NOT NULL DEFAULT '[]'::jsonb,

  montada_em    timestamptz NOT NULL DEFAULT now(),
  montada_por   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_processo_juntadas IS
  'Dossie unico (PDF) entregue ao orgao. Uma linha por montagem; a maior versao e a vigente.';
COMMENT ON COLUMN public.qa_processo_juntadas.itens_json IS
  'Documentos que entraram, na ordem canonica do protocolo (numero, grupo, tipo, nome).';
COMMENT ON COLUMN public.qa_processo_juntadas.ignorados_json IS
  'O que ficou de fora e por que. Sem isto, "faltou tal peca" nao tem resposta.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_processo_juntadas_versao
  ON public.qa_processo_juntadas (processo_id, versao);

CREATE INDEX IF NOT EXISTS idx_qa_processo_juntadas_processo
  ON public.qa_processo_juntadas (processo_id, versao DESC);

ALTER TABLE public.qa_processo_juntadas ENABLE ROW LEVEL SECURITY;

-- Equipe Quero Armas: tudo.
DROP POLICY IF EXISTS "qa_juntadas_staff_all" ON public.qa_processo_juntadas;
CREATE POLICY "qa_juntadas_staff_all" ON public.qa_processo_juntadas
  FOR ALL TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

-- Cliente: LÊ a juntada do próprio processo. É ela que ele assina no gov.br.
-- Só leitura — quem monta é a edge function com service role.
DROP POLICY IF EXISTS "qa_juntadas_cliente_select" ON public.qa_processo_juntadas;
CREATE POLICY "qa_juntadas_cliente_select" ON public.qa_processo_juntadas
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      public.qa_current_cliente_id(auth.uid()),
      public.qa_current_cliente_id_legado(auth.uid())
    )
  );

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- (a) Tabela e policies no lugar. Esperado: 2 policies.
--
-- SELECT policyname, cmd, roles
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'qa_processo_juntadas'
--  ORDER BY policyname;
--
-- (b) Depois de a equipe clicar em "MONTAR JUNTADA" uma vez, a linha aparece:
--
-- SELECT j.processo_id, j.versao, j.paginas,
--        jsonb_array_length(j.itens_json)     AS documentos,
--        jsonb_array_length(j.ignorados_json) AS fora,
--        j.montada_em
--   FROM public.qa_processo_juntadas j
--  ORDER BY j.montada_em DESC
--  LIMIT 10;
