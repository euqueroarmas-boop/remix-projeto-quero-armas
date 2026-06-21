-- Unifica a politica de retencao por rescisao por culpa/iniciativa da
-- CONTRATANTE em todo o catalogo (decisao do usuario), substituindo a
-- tabela de 3 niveis (herdada do documento de referencia) que so existia
-- em concessao-cr e nos dois servicos de posse.
--
-- Regra unica para despachos administrativos (15 servicos, incluindo os 3
-- que ja tinham tabela de 3 niveis): 50% retido a partir da confirmacao do
-- pagamento; 100% retido a partir do inicio do envio de documentos pela
-- CONTRATANTE (Arsenal Inteligente, e-mail, WhatsApp ou presencial).
--
-- Regra para os 2 cursos (operador de pistola / VIP): 50% antes do
-- agendamento da turma, 100% apos agendar.
--
-- mudanca-servico (valor R$ 0,00) fica sem tabela, nao ha o que reter.
--
-- Incrementa versao e reprocessa contratos existentes, mesmo mecanismo
-- das migrations anteriores.
UPDATE public.qa_contract_templates
   SET versao = versao + 1,
       corpo_html = replace(
         replace(
           corpo_html,
           '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do início da conferência documental: retenção de R$ 200,00 a título de taxa de consultoria e abertura de atendimento;</li>
  <li>Após início da conferência documental e antes do protocolo perante o órgão: retenção de 50% do valor contratado;</li>
  <li>Após protocolo do requerimento perante o órgão competente: sem direito a reembolso (100% do valor retido).</li>
</ul>
',
           ''
         ),
         '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do início da conferência documental: retenção de R$ 1.000,00 a título de taxa de consultoria;</li>
  <li>Após início da busca de provas de efetiva necessidade: retenção de R$ 2.000,00;</li>
  <li>Após protocolo do requerimento perante a Polícia Federal: sem direito a reembolso (100% do valor retido).</li>
</ul>
<p><strong>Provas de efetiva necessidade:</strong> a CONTRATANTE é a única responsável pela obtenção e apresentação de provas documentais que comprovem a efetiva necessidade (Boletins de Ocorrência, queixas-crime, documentos que comprovem atividade profissional de risco, entre outros). A CONTRATADA poderá auxiliar na organização e formatação, mas a responsabilidade pela obtenção é exclusivamente da CONTRATANTE.</p>
',
         ''
       ),
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true;

-- Insere a tabela de retenção logo após o parágrafo "Identificador (slug): X"
-- de cada serviço (mesmo ponto de inserção usado nas migrations anteriores).
UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): apostilamento-atualizacao</strong></p>', '<p><strong>Identificador (slug): apostilamento-atualizacao</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): apostilamento-atualizacao</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): apostilamento-atualizacao</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac</strong></p>', '<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac</strong></p>', '<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): concessao-cr</strong></p>', '<p><strong>Identificador (slug): concessao-cr</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): concessao-cr</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): concessao-cr</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): guia-de-trafego-especial-cac</strong></p>', '<p><strong>Identificador (slug): guia-de-trafego-especial-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): guia-de-trafego-especial-cac</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): guia-de-trafego-especial-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): registro-e-apostilamento-de-arma-de-fogo-cac</strong></p>', '<p><strong>Identificador (slug): registro-e-apostilamento-de-arma-de-fogo-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): registro-e-apostilamento-de-arma-de-fogo-cac</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): registro-e-apostilamento-de-arma-de-fogo-cac</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): renovacao-cr</strong></p>', '<p><strong>Identificador (slug): renovacao-cr</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): renovacao-cr</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): renovacao-cr</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): posse-de-arma-de-fogo</strong></p>', '<p><strong>Identificador (slug): posse-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): posse-de-arma-de-fogo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): posse-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): aquisicao-registro-posse-de-arma-de-fogo</strong></p>', '<p><strong>Identificador (slug): aquisicao-registro-posse-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): aquisicao-registro-posse-de-arma-de-fogo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): aquisicao-registro-posse-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): mandado-de-seguranca</strong></p>', '<p><strong>Identificador (slug): mandado-de-seguranca</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): mandado-de-seguranca</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): mandado-de-seguranca</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): porte-arma-fogo</strong></p>', '<p><strong>Identificador (slug): porte-arma-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): porte-arma-fogo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): porte-arma-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): recurso-administrativo</strong></p>', '<p><strong>Identificador (slug): recurso-administrativo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): recurso-administrativo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): recurso-administrativo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): registro-arma-fogo</strong></p>', '<p><strong>Identificador (slug): registro-arma-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): registro-arma-fogo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): registro-arma-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): renovacao-de-porte-de-arma-de-fogo</strong></p>', '<p><strong>Identificador (slug): renovacao-de-porte-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): renovacao-de-porte-de-arma-de-fogo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): renovacao-de-porte-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): renovacao-posse-de-arma-de-fogo</strong></p>', '<p><strong>Identificador (slug): renovacao-posse-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>A partir da confirmação do pagamento e celebração do contrato: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>A partir do início do envio de documentos pela CONTRATANTE --- pelo Arsenal Inteligente, e-mail, WhatsApp ou atendimento presencial ---: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): renovacao-posse-de-arma-de-fogo</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): renovacao-posse-de-arma-de-fogo</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): operador-de-pistola-nivel-i</strong></p>', '<p><strong>Identificador (slug): operador-de-pistola-nivel-i</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do agendamento da turma/aula: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>Após o agendamento da turma/aula: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): operador-de-pistola-nivel-i</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): operador-de-pistola-nivel-i</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';

UPDATE public.qa_contract_templates
   SET corpo_html = replace(corpo_html, '<p><strong>Identificador (slug): vip-operador-de-pistola-nivel-i</strong></p>', '<p><strong>Identificador (slug): vip-operador-de-pistola-nivel-i</strong></p>' || E'\n' || '<p><strong>Tabela de retenção em caso de rescisão por culpa/iniciativa da CONTRATANTE:</strong></p>
<ul>
  <li>Antes do agendamento da turma/aula: retenção de 50% (cinquenta por cento) do valor contratado;</li>
  <li>Após o agendamento da turma/aula: retenção de 100% (cem por cento) do valor contratado, sem direito a reembolso.</li>
</ul>'), updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%<p><strong>Identificador (slug): vip-operador-de-pistola-nivel-i</strong></p>%'
   AND corpo_html NOT LIKE '%<p><strong>Identificador (slug): vip-operador-de-pistola-nivel-i</strong></p>' || E'\n' || '<p><strong>Tabela de retenção%';


-- Reprocessa contratos existentes (mesmo mecanismo das migrations anteriores).
DO $$
DECLARE
  v_function_url text := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-generate-contract';
  v_anon_key text := current_setting('app.settings.anon_key', true);
  v_service_key text;
  v_auth_key text;
  v_versao_vigente integer;
  v_row record;
  v_total integer := 0;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;
  v_auth_key := COALESCE(v_service_key, v_anon_key, '');

  SELECT versao INTO v_versao_vigente
    FROM public.qa_contract_templates
   WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
     AND vigente = true
   LIMIT 1;

  IF v_versao_vigente IS NULL THEN
    RAISE NOTICE 'qa_contract_template_retencao_unificada: nenhum template vigente encontrado, abortando reprocessamento.';
    RETURN;
  END IF;

  FOR v_row IN
    SELECT id, venda_id, template_versao
      FROM public.qa_contracts
     WHERE venda_id IS NOT NULL
       AND arquivado_em IS NULL
       AND (
         template_codigo IS DISTINCT FROM 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
         OR template_versao IS DISTINCT FROM v_versao_vigente
         OR conteudo_renderizado IS NULL
         OR btrim(conteudo_renderizado) = ''
       )
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_auth_key,
          'apikey', v_auth_key,
          'x-trigger-source', 'qa_contract_template_retencao_unificada'
        ),
        body := jsonb_build_object('venda_id', v_row.venda_id, 'force', true)
      );
      v_total := v_total + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao enfileirar reprocessamento do contrato % (venda %): %',
        v_row.id, v_row.venda_id, SQLERRM;
    END;
    PERFORM pg_sleep(0.2);
  END LOOP;

  RAISE NOTICE 'qa_contract_template_retencao_unificada: % contrato(s) enfileirado(s) para reprocessamento.', v_total;
END;
$$;
