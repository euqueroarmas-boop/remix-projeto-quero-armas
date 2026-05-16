UPDATE qa_homologacao_sessoes
SET etapa = 'pix_inline_implementado_com_polling_pipeline_b',
    payload = payload || '{"bucket_corrigido": "qa-cadastro-selfies", "prefixo": "cadastro-publico/refinado", "edge_function_qa_checkout_status_criada": true, "pix_inline_etapa04": true, "polling_4s": true, "check_payment_status_intacto": true}'::jsonb,
    observacoes = observacoes || ' | Bucket de upload corrigido (Opcao A). Criada edge function qa-checkout-status (aditiva, read-only) para polling do pipeline B sem tocar em check-payment-status (que serve o pipeline WMTi legado). PIX/Boleto/Cartao inline na Etapa 04 do /cadastro refinado.'
WHERE sessao_codigo = 'HOMOLOG_CATALOGO_COMPLETO_2026_05_15';