-- =============================================================================
-- Aviso de documentos rejeitados — varredura por cliente
--
-- Fecha uma lacuna real: hoje o e-mail de rejeição só sai no momento em que o
-- arquivo é anexado no Hub. Documento que JÁ está no sistema como rejeitado
-- nunca avisa ninguém — o cliente não sabe que precisa substituir, e a
-- exigência trava sem explicação.
--
-- Reusa o motor existente (qa-notify-event → send-transactional-email) e o
-- template `certidao-rejeitada`, que já traz o passo a passo de como emitir
-- novamente e como reenviar pelo portal.
--
-- SEGURANÇA DE OPERAÇÃO: a função nasce em modo CONFERÊNCIA (p_disparar =
-- false). Nesse modo ela só DEVOLVE o que enviaria, sem mandar nada. Disparo
-- de e-mail para cliente não se testa em produção às cegas.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_avisar_documentos_rejeitados(
  p_cliente_id  bigint,
  p_disparar    boolean DEFAULT false
)
RETURNS TABLE (
  documento_id   uuid,
  documento      text,
  tipo_documento text,
  motivo         text,
  rejeitado_em   timestamptz,
  enviado        boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_url     text;
  v_service text;
  v_email   text;
  v_nome    text;
  r         record;
  v_link    text;
  v_orgao   text;
BEGIN
  SELECT c.email, c.nome_completo INTO v_email, v_nome
    FROM public.qa_clientes c WHERE c.id = p_cliente_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Cliente % sem e-mail cadastrado — nada a enviar.', p_cliente_id;
  END IF;

  -- Endpoint e credencial, no mesmo padrão das triggers já existentes.
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'edge_qa_notify_event_url' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  IF v_url IS NULL THEN
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'edge_base_url' LIMIT 1;
      IF v_url IS NOT NULL THEN v_url := v_url || '/qa-notify-event'; END IF;
    EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_service
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_service := NULL; END;

  FOR r IN
    SELECT d.id, d.tipo_documento, d.nome_documento, d.motivo_reprovacao, d.reprovado_em
      FROM public.qa_documentos_cliente d
     WHERE d.qa_cliente_id = p_cliente_id
       AND d.status = 'rejeitado'
       -- Documento já substituído não precisa de cobrança: o cliente resolveu.
       AND d.substituido_por_documento_id IS NULL
     ORDER BY d.reprovado_em DESC NULLS LAST, d.created_at DESC
  LOOP
    -- Link oficial de emissão, quando conhecido. Sem link confirmado vai vazio:
    -- o e-mail orienta mesmo assim, e link chutado faz o cliente perder viagem.
    v_link := CASE r.tipo_documento
      WHEN 'antecedentes_militar'            THEN 'https://www.stm.jus.br/servicos-stm/certidao-negativa/emitir-certidao'
      WHEN 'antecedentes_militar_estadual'   THEN 'https://certidaocriminal.tjmsp.jus.br/'
      WHEN 'antecedentes_eleitoral'          THEN 'https://www.tse.jus.br/servicos-eleitorais/certidoes/certidao-de-crimes-eleitorais'
      WHEN 'antecedentes_estadual_distribuicao' THEN 'https://esaj.tjsp.jus.br/sco/abrirCadastro.do'
      WHEN 'antecedentes_estadual_execucoes' THEN 'https://esaj.tjsp.jus.br/sco/abrirCadastro.do'
      ELSE COALESCE((SELECT b.link_emissao FROM public.qa_documentos_biblioteca b
                      WHERE b.codigo = r.tipo_documento AND b.link_emissao <> ''), '')
    END;

    v_orgao := CASE r.tipo_documento
      WHEN 'antecedentes_militar'          THEN 'Superior Tribunal Militar (STM)'
      WHEN 'antecedentes_militar_estadual' THEN 'Tribunal de Justiça Militar de São Paulo'
      WHEN 'antecedentes_eleitoral'        THEN 'Tribunal Superior Eleitoral (TSE)'
      WHEN 'antecedentes_criminais'        THEN 'SSP/SP — IIRGD'
      WHEN 'antecedentes_estadual_distribuicao' THEN 'Tribunal de Justiça de São Paulo'
      WHEN 'antecedentes_estadual_execucoes'    THEN 'Tribunal de Justiça de São Paulo'
      WHEN 'antecedentes_federal_trf3_regional' THEN 'Tribunal Regional Federal da 3ª Região'
      ELSE ''
    END;

    documento_id   := r.id;
    documento      := COALESCE(NULLIF(r.nome_documento, ''), r.tipo_documento);
    tipo_documento := r.tipo_documento;
    motivo         := COALESCE(NULLIF(r.motivo_reprovacao, ''),
                               'Divergência entre os dados do documento e o seu cadastro.');
    rejeitado_em   := r.reprovado_em;
    enviado        := false;

    IF p_disparar AND v_url IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service, '')
        ),
        body := jsonb_build_object(
          'evento',        'certidao_rejeitada',
          'cliente_id',    p_cliente_id,
          'certidao',      documento,
          'orgao',         v_orgao,
          'link_emissao',  v_link,
          'referencia_tabela', 'qa_documentos_cliente',
          'referencia_id', r.id::text,
          'problemas', jsonb_build_array(
            jsonb_build_object('label', 'Motivo da recusa', 'mensagem', motivo)
          )
        )
      );
      enviado := true;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$fn$;

COMMENT ON FUNCTION public.qa_avisar_documentos_rejeitados(bigint, boolean) IS
  'Varre os documentos rejeitados do cliente e avisa por e-mail (template certidao-rejeitada). Nasce em modo conferência: passe p_disparar := true para enviar de verdade.';

REVOKE ALL ON FUNCTION public.qa_avisar_documentos_rejeitados(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_avisar_documentos_rejeitados(bigint, boolean) TO service_role;

COMMIT;
