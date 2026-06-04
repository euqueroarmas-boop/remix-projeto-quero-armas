-- ========== ONDA 7: PERFORMANCE INDEXES ==========
-- FKs sem índice
CREATE INDEX IF NOT EXISTS idx_client_events_customer_id ON public.client_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_equipment_contract_id ON public.contract_equipment(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id ON public.contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON public.contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_quote_id ON public.contracts(quote_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_change_log_related_event_history_id ON public.fiscal_change_log(related_event_history_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_contract_id ON public.fiscal_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_payment_id ON public.fiscal_documents(payment_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_replaced_by_invoice_id ON public.fiscal_documents(replaced_by_invoice_id);
CREATE INDEX IF NOT EXISTS idx_lp_contract_acceptances_contract_id ON public.lp_contract_acceptances(contract_id);
CREATE INDEX IF NOT EXISTS idx_lp_contracts_order_id ON public.lp_contracts(order_id);
CREATE INDEX IF NOT EXISTS idx_lp_contracts_template_id ON public.lp_contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_lp_order_items_order_id ON public.lp_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_lp_order_items_service_id ON public.lp_order_items(service_id);
CREATE INDEX IF NOT EXISTS idx_lp_payments_order_id ON public.lp_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_lp_payments_provider_id ON public.lp_payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_lp_services_category_id ON public.lp_services(category_id);
CREATE INDEX IF NOT EXISTS idx_lp_webhook_events_order_id ON public.lp_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_lp_webhook_events_payment_id ON public.lp_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_network_diagnostics_quote_id ON public.network_diagnostics(quote_id);
CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON public.payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_proposals_customer_id ON public.proposals(customer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_id ON public.proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_quote_id ON public.proposals(quote_id);
CREATE INDEX IF NOT EXISTS idx_qa_consultas_ia_usuario_id ON public.qa_consultas_ia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_qa_documentos_conhecimento_enviado_por ON public.qa_documentos_conhecimento(enviado_por);
CREATE INDEX IF NOT EXISTS idx_qa_exames_cliente_cadastrado_por ON public.qa_exames_cliente(cadastrado_por);
CREATE INDEX IF NOT EXISTS idx_qa_feedback_geracoes_geracao_id ON public.qa_feedback_geracoes(geracao_id);
CREATE INDEX IF NOT EXISTS idx_qa_feedback_geracoes_usuario_id ON public.qa_feedback_geracoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_qa_geracoes_pecas_usuario_id ON public.qa_geracoes_pecas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_qa_itens_venda_servico_id ON public.qa_itens_venda(servico_id);
CREATE INDEX IF NOT EXISTS idx_qa_modelos_docx_created_by ON public.qa_modelos_docx(created_by);
CREATE INDEX IF NOT EXISTS idx_qa_senha_gov_acessos_cliente_id ON public.qa_senha_gov_acessos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON public.quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_revenue_intelligence_lead_id ON public.revenue_intelligence(lead_id);
CREATE INDEX IF NOT EXISTS idx_revenue_intelligence_quote_id ON public.revenue_intelligence(quote_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_customer_id ON public.service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_quote_id ON public.service_requests(quote_id);
CREATE INDEX IF NOT EXISTS idx_signature_logs_certificate_id ON public.signature_logs(certificate_id);
CREATE INDEX IF NOT EXISTS idx_signature_logs_contract_id ON public.signature_logs(contract_id);

-- Colunas de filtro frequente
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON public.payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON public.payments(due_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON public.fiscal_documents(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_is_active ON public.fiscal_documents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_asaas_invoice_id ON public.fiscal_documents(asaas_invoice_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_name ON public.integration_logs(integration_name);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON public.integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_created_at ON public.logs_sistema(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_status ON public.logs_sistema(status);

-- Buscas de cliente / leads
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- user_roles e cliente_auth_links (críticos para autorização)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_user_id ON public.cliente_auth_links(user_id);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_qa_cliente_id ON public.cliente_auth_links(qa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_auth_links_status ON public.cliente_auth_links(status);

-- qa_clientes
CREATE INDEX IF NOT EXISTS idx_qa_clientes_email ON public.qa_clientes(email);
CREATE INDEX IF NOT EXISTS idx_qa_clientes_status ON public.qa_clientes(status);
CREATE INDEX IF NOT EXISTS idx_qa_clientes_user_id ON public.qa_clientes(user_id);

ANALYZE;