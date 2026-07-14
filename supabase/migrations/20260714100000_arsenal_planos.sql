-- qa_arsenal_planos: fonte de verdade para preço e configuração do Arsenal
-- Inteligente Premium. Apenas 1 plano com ativo=true por vez.
-- Para mudar preço: UPDATE qa_arsenal_planos SET valor_anual=350 WHERE ativo=true;
-- Para lançar novo plano: INSERT ... ativo=true + UPDATE SET ativo=false WHERE id=<antigo>.

CREATE TABLE IF NOT EXISTS qa_arsenal_planos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL DEFAULT 'Arsenal Inteligente Premium',
  descricao     text,
  valor_anual   numeric(10,2) NOT NULL DEFAULT 297.00,
  parcelas_max  int         NOT NULL DEFAULT 12,
  ativo         boolean     NOT NULL DEFAULT true,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Qualquer usuário autenticado pode ler o plano ativo (necessário para o gate).
ALTER TABLE qa_arsenal_planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_leitura_publica"
  ON qa_arsenal_planos FOR SELECT
  USING (ativo = true);

-- Staff QA pode gerenciar (SELECT/INSERT/UPDATE para admins).
CREATE POLICY "planos_staff_gerenciar"
  ON qa_arsenal_planos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM qa_usuarios_perfis
      WHERE user_id = auth.uid()
        AND perfil IN ('administrador', 'staff')
        AND ativo = true
    )
  );

-- Plano inicial (preço atual confirmado pelo Will em 08/07/2026).
INSERT INTO qa_arsenal_planos (nome, descricao, valor_anual, parcelas_max, ativo)
VALUES (
  'Arsenal Inteligente Premium',
  'Acesso anual ao Arsenal Inteligente: Klal, gestão de armas e munições, alertas de documentos, análise de alvo e recarga.',
  297.00,
  12,
  true
);

NOTIFY pgrst, 'reload schema';
