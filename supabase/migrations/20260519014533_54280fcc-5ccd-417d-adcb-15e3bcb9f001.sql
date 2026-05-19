
BEGIN;

-- 1) emissor em qa_servicos_documentos
ALTER TABLE qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS emissor TEXT NOT NULL DEFAULT 'cliente'
  CHECK (emissor IN ('cliente','quero_armas'));

COMMENT ON COLUMN qa_servicos_documentos.emissor IS
  'cliente = cliente envia upload | quero_armas = equipe Quero Armas emite/produz';

UPDATE qa_servicos_documentos
SET emissor = 'quero_armas', updated_at = now()
WHERE tipo_documento IN ('comprovante_efetiva_necessidade','habilitacao_cacador_ibama')
  AND emissor <> 'quero_armas';

-- 2) sigla_protocolo em qa_servicos_catalogo
ALTER TABLE qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS sigla_protocolo TEXT;

COMMENT ON COLUMN qa_servicos_catalogo.sigla_protocolo IS
  'Sigla usada na geração do número de protocolo: QA-{sigla}-{ano}-{seq}. Snake/CAPS curto.';

UPDATE qa_servicos_catalogo
SET sigla_protocolo = t.novo
FROM (VALUES
  ('renovacao-cr', 'RENOV-CR'),
  ('registro-e-apostilamento-de-arma-de-fogo-cac', 'REG-CAC'),
  ('guia-de-trafego-especial-cac', 'GTE'),
  ('posse-de-arma-de-fogo', 'POSSE'),
  ('renovacao-posse-de-arma-de-fogo', 'RENOV-POSSE'),
  ('renovacao-de-porte-de-arma-de-fogo', 'RENOV-PORTE'),
  ('operador-de-pistola-nivel-i', 'CURSO-OP1'),
  ('vip-operador-de-pistola-nivel-i', 'CURSO-VIP'),
  ('porte-arma-fogo', 'PORTE'),
  ('mudanca-servico', 'MUDANCA'),
  ('registro-arma-fogo', 'REG'),
  ('concessao-cr', 'CR'),
  ('apostilamento-atualizacao', 'APOST'),
  ('mandado-de-seguranca', 'MS'),
  ('recurso-administrativo', 'RECURSO'),
  ('aquisicao-registro-posse-de-arma-de-fogo', 'AQUISICAO'),
  ('autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac', 'AUT-ATIRADOR'),
  ('autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac', 'AUT-CACADOR'),
  ('registro-de-arma-de-fogo', 'REG-DEFESA')
) AS t(slug_v, novo)
WHERE qa_servicos_catalogo.slug = t.slug_v
  AND qa_servicos_catalogo.sigla_protocolo IS NULL;

-- 3) qa_protocolo_sequencias
CREATE TABLE IF NOT EXISTS qa_protocolo_sequencias (
  sigla         TEXT NOT NULL,
  ano           INT  NOT NULL,
  ultimo_numero INT  NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sigla, ano)
);

COMMENT ON TABLE qa_protocolo_sequencias IS
  'Sequencial atomic por (sigla, ano) para gerar números de protocolo sem colisão sob concorrência.';

ALTER TABLE qa_protocolo_sequencias ENABLE ROW LEVEL SECURITY;

-- 4) qa_protocolos (venda_id/cliente_id/servico_id = INTEGER conforme schema real)
CREATE TABLE IF NOT EXISTS qa_protocolos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,
  venda_id        INTEGER NOT NULL,
  qa_cliente_id   INTEGER,
  servico_id      INTEGER NOT NULL,
  sigla_protocolo TEXT NOT NULL,
  sequencia_ano   INT NOT NULL,
  ano             INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'aguardando_documentos'
                    CHECK (status IN (
                      'aguardando_documentos',
                      'em_andamento',
                      'protocolado_pf',
                      'concluido',
                      'cancelado'
                    )),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS qa_protocolos_venda_id_uniq ON qa_protocolos (venda_id);
CREATE INDEX IF NOT EXISTS qa_protocolos_cliente_idx ON qa_protocolos (qa_cliente_id);
CREATE INDEX IF NOT EXISTS qa_protocolos_status_idx ON qa_protocolos (status) WHERE status <> 'concluido' AND status <> 'cancelado';

COMMENT ON TABLE qa_protocolos IS
  'Protocolo gerado no fechamento do checkout (1 por venda). Vincula cliente, serviço e processo.';
COMMENT ON COLUMN qa_protocolos.numero IS 'Formato: QA-{sigla}-{ano}-{seq3}';

ALTER TABLE qa_protocolos ENABLE ROW LEVEL SECURITY;

-- 5) Funções
CREATE OR REPLACE FUNCTION qa_proximo_protocolo(p_sigla TEXT, p_ano INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INT;
BEGIN
  INSERT INTO qa_protocolo_sequencias (sigla, ano, ultimo_numero, updated_at)
  VALUES (p_sigla, p_ano, 1, now())
  ON CONFLICT (sigla, ano)
  DO UPDATE SET
    ultimo_numero = qa_protocolo_sequencias.ultimo_numero + 1,
    updated_at = now()
  RETURNING ultimo_numero INTO v_numero;
  RETURN v_numero;
END;
$$;

CREATE OR REPLACE FUNCTION qa_gerar_protocolo(p_venda_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id     INT;
  v_qa_cliente_id  INT;
  v_sigla          TEXT;
  v_ano            INT;
  v_seq            INT;
  v_numero         TEXT;
  v_existing       TEXT;
BEGIN
  SELECT numero INTO v_existing FROM qa_protocolos WHERE venda_id = p_venda_id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Schema real: qa_vendas.cliente_id INT; qa_itens_venda.servico_id INT
  SELECT vi.servico_id, v.cliente_id
  INTO v_servico_id, v_qa_cliente_id
  FROM qa_vendas v
  LEFT JOIN qa_itens_venda vi ON vi.venda_id = v.id
  WHERE v.id = p_venda_id
  ORDER BY vi.id ASC
  LIMIT 1;

  IF v_servico_id IS NULL THEN
    RAISE EXCEPTION 'venda_id % sem servico vinculado', p_venda_id;
  END IF;

  SELECT c.sigla_protocolo INTO v_sigla
  FROM qa_servicos_catalogo c
  WHERE c.servico_id = v_servico_id
  LIMIT 1;
  IF v_sigla IS NULL THEN v_sigla := 'GERAL'; END IF;

  v_ano := EXTRACT(YEAR FROM now())::INT;
  v_seq := qa_proximo_protocolo(v_sigla, v_ano);
  v_numero := 'QA-' || v_sigla || '-' || v_ano || '-' || LPAD(v_seq::TEXT, 3, '0');

  INSERT INTO qa_protocolos (
    numero, venda_id, qa_cliente_id, servico_id,
    sigla_protocolo, sequencia_ano, ano, status
  )
  VALUES (
    v_numero, p_venda_id, v_qa_cliente_id, v_servico_id,
    v_sigla, v_seq, v_ano, 'aguardando_documentos'
  );

  RETURN v_numero;
END;
$$;

COMMENT ON FUNCTION qa_gerar_protocolo IS
  'Gera número de protocolo no formato QA-{sigla}-{ano}-{seq3} para a venda. Idempotente.';

-- 6) qa_documento_status_producao
CREATE TABLE IF NOT EXISTS qa_documento_status_producao (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_documento_id  UUID NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'nao_iniciado'
                           CHECK (status IN (
                             'nao_iniciado',
                             'em_producao',
                             'bloqueado_cliente',
                             'pronto',
                             'entregue'
                           )),
  bloqueio_motivo        TEXT,
  responsavel_admin_id   UUID,
  iniciado_em            TIMESTAMPTZ,
  pronto_em              TIMESTAMPTZ,
  entregue_em            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_doc_status_prod_status_idx
  ON qa_documento_status_producao (status)
  WHERE status <> 'entregue';

COMMENT ON TABLE qa_documento_status_producao IS
  'Rastreio interno dos documentos cuja emissão é responsabilidade da Quero Armas. Cada registro espelha 1 qa_processo_documentos com emissor=quero_armas.';

ALTER TABLE qa_documento_status_producao ENABLE ROW LEVEL SECURITY;

COMMIT;
