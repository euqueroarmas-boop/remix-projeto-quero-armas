-- ============================================================================
-- RECURSO ADMINISTRATIVO — o texto que o cliente aprova antes de a equipe
-- protocolar
-- ----------------------------------------------------------------------------
-- Negado o pedido, a PF abre 10 dias para recorrer (Lei 9.784/99, art. 59).
-- Quem escreve a peça e' a equipe, mas os FATOS sao do cliente — e o cliente
-- precisa ler e confirmar que sao os fatos dele antes de a peca entrar na
-- delegacia. Recurso protocolado com fato errado nao se conserta: ele vira
-- parte do processo e a proxima autoridade le aquilo.
--
-- Por isso o relato vai em PRIMEIRA PESSOA, na voz dele, do mesmo jeito que ja
-- fazemos na efetiva necessidade: "eu registrei o boletim", nao "o requerente
-- registrou". Texto na terceira pessoa o cliente le como documento de
-- escritorio e aprova no automatico, sem conferir. Na voz dele, ele corrige.
--
-- ── UMA LINHA POR RODADA ────────────────────────────────────────────────────
-- Um processo pode recorrer mais de uma vez (indeferimento → recurso → novo
-- indeferimento → recurso a instancia superior). Cada rodada tem o seu texto,
-- as suas provas e a sua aprovacao. Guardar num campo unico apagaria a rodada
-- anterior — justamente o historico que a instancia superior le.
--
-- `manifestacao_id` amarra o recurso ao DOCUMENTO da PF que ele responde. Sem
-- essa amarra, duas rodadas viram duas linhas soltas e ninguem sabe qual
-- responde o que.
--
-- ── POR QUE O CLIENTE NAO ESCREVE DIRETO NA TABELA ──────────────────────────
-- A politica do cliente e' so de LEITURA. A aprovacao passa por edge function
-- com service_role, que registra quem aprovou, quando, e se o texto foi
-- editado. RLS nao restringe coluna: dar UPDATE ao cliente daria a ele o
-- direito de mexer em status, datas e no numero do protocolo.
--
-- Reexecutavel.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.qa_processo_recursos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id       uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,
  -- O documento da PF que este recurso responde.
  manifestacao_id   uuid REFERENCES public.qa_processo_manifestacoes_pf(id) ON DELETE SET NULL,

  -- rascunho | aguardando_aprovacao | aprovado | enviado_equipe | protocolado
  status            text NOT NULL DEFAULT 'rascunho',

  -- O relato em primeira pessoa gerado pela IA.
  narrativa_gerada     text,
  narrativa_gerada_em  timestamptz,
  -- O texto que o cliente aprovou. Pode ser igual ao gerado ou editado por ele.
  narrativa_final      text,
  editada_pelo_cliente boolean NOT NULL DEFAULT false,

  -- Provas que sustentam esta rodada (as que a PF exigiu e ele enviou).
  provas_json       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- O que a PF exigiu, copiado da analise da manifestacao no momento da
  -- geracao. Congelado de proposito: se a analise for refeita depois, o
  -- recurso ja aprovado continua mostrando o que o cliente de fato aprovou.
  exigencias_json   jsonb NOT NULL DEFAULT '[]'::jsonb,

  aprovado_em       timestamptz,
  aprovado_por      uuid REFERENCES auth.users(id),
  enviado_equipe_em timestamptz,
  protocolado_em    timestamptz,
  numero_protocolo  text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_recursos_processo
  ON public.qa_processo_recursos(processo_id, created_at DESC);

ALTER TABLE public.qa_processo_recursos ENABLE ROW LEVEL SECURITY;

-- Equipe: acesso total.
DROP POLICY IF EXISTS "qa_recursos_staff_all" ON public.qa_processo_recursos;
CREATE POLICY "qa_recursos_staff_all" ON public.qa_processo_recursos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis up
     WHERE up.user_id = auth.uid() AND up.ativo = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_usuarios_perfis up
     WHERE up.user_id = auth.uid() AND up.ativo = true
  ));

-- Cliente: LE o recurso do proprio processo. Nunca escreve — a aprovacao passa
-- pela edge, que e' quem tem o direito de mexer em status e datas.
--
-- As duas portas de vinculo sao as mesmas que o portal usa para achar o
-- cadastro: `qa_clientes.user_id` (login direto) e `cliente_auth_links`
-- (login social). Sem funcao auxiliar: a migration que criaria os atalhos
-- nunca foi aplicada neste banco.
DROP POLICY IF EXISTS "qa_recursos_cliente_select" ON public.qa_processo_recursos;
CREATE POLICY "qa_recursos_cliente_select" ON public.qa_processo_recursos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.qa_processos p
      JOIN public.qa_clientes c ON c.id = p.cliente_id
     WHERE p.id = qa_processo_recursos.processo_id
       AND (
         c.user_id = auth.uid()
         OR EXISTS (
           SELECT 1
             FROM public.cliente_auth_links l
            WHERE l.user_id = auth.uid()
              AND l.qa_cliente_id = c.id
              AND l.status = 'active'
         )
       )
  ));

DROP POLICY IF EXISTS "qa_recursos_service" ON public.qa_processo_recursos;
CREATE POLICY "qa_recursos_service" ON public.qa_processo_recursos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

-- ── Conferencia ─────────────────────────────────────────────────────────────
-- Deve voltar TRES linhas (staff_all, cliente_select, service):
--
-- SELECT policyname, cmd
--   FROM pg_policies
--  WHERE tablename = 'qa_processo_recursos'
--  ORDER BY policyname;
