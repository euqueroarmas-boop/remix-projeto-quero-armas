
# Regras canônicas do sistema

## Arsenal Inteligente
- **Arsenal Inteligente é gratuito** e permanece acessível a todos os clientes independentemente do status de pagamento.
- Nunca bloquear Arsenal por plano, trigger de upgrade ou gate de acesso.

---

# Plano: Simulação completa CR Atirador (cliente sintético)

## Identidade do teste
- **Cliente novo** em `qa_clientes` (CPF sintético, sem histórico):
  - Nome: `VANESSA MASSAROTO (TESTE QA)`
  - CPF: `111.444.777-35` (CPF de teste válido na regra)
  - E-mail: `will.rodrigues.wrii@icloud.com`
  - Celular: `11963166915`
  - Categoria: PF — Atirador
  - Marca: `observacao = 'SIMULACAO_QA_<timestamp>'` para isolar do real.

## Fluxo executado (mesma ordem do cliente real)

### 1. Checkout público — `qa-checkout-criar-venda`
Chamo via curl com `cart = [{servico: CR Atirador (id 44 / slug correspondente em qa_servicos_catalogo), qtd: 1}]` + identificação.
Resultado: venda criada com `cobranca_origem='checkout_site'`, `checkout_token`, status `RASCUNHO`.

### 2. Geração da cobrança — `qa-checkout-iniciar-pagamento`
Billing type **PIX** sandbox. Cria customer + payment no Asaas sandbox (ambiente já configurado no projeto).
Resultado: `asaas_payment_id`, `asaas_invoice_url`, `cobranca_status='pendente'`.

### 3. Confirmação de pagamento — webhook simulado em `qa-asaas-webhook`
POST com `event=PAYMENT_CONFIRMED`, `externalReference=qa_venda:<id>`, token correto.
A trigger em `qa_vendas` (status → PAGO) dispara provisionamento:
- contrato (qa_generate-contract / qa-liberar-servicos-contrato)
- conta no portal (qa-provisionar-acesso-portal) → cria `qa_cliente_credenciais` com senha temporária + envia e-mail de boas-vindas (template já existente).
- criação do processo CR Atirador (`qa-processo-criar`) com checklist montado a partir de `qa_servico_documentos_obrigatorios`.

### 4. Checklist — força-aprovação via service_role
Loop em `qa_processo_documentos` do processo: para cada item obrigatório
- gera arquivo dummy no bucket privado de cliente,
- `status='aprovado'`, `validado_em=now()`, `validado_por='SIMULACAO_QA'`,
- insere evento em `qa_processo_eventos` (`tipo='doc_aprovado_simulacao'`).
- registra em `qa_status_eventos` (origem=`sistema`, motivo=`simulacao_qa_force_approve`).

### 5. Reconciliação de pivot + auto-liberação — `qa-processo-etapa-auto-liberar`
Roda até saturar (até 5 etapas). Cada transição grava evento.

### 6. Conclusão do checklist — `qa-processo-checar-conclusao-checklist`
Promove `status='pronto_para_protocolar'` + dispara:
- e-mail ao cliente ("documentação completa, pronto para protocolar")
- e-mail à equipe ("processo pronto para entrar na PF")

### 7. Auditoria final
Gero um relatório consolidado (.md em `/mnt/documents/`) com:
- IDs criados (cliente, venda, payment, contrato, processo, credencial)
- Linha do tempo completa via `qa_status_eventos` + `qa_venda_eventos` + `qa_processo_eventos`
- E-mails enviados (consulta `email_send_log` filtrando por message_id `simulacao_qa_*`)
- Logs em `qa_logs_auditoria` + `logs_sistema` com tag `SIMULACAO_QA_<timestamp>`
- Estado final do processo (etapa, prazos, status)

## Restrições/seguranças
- **Sandbox Asaas**: se as credenciais sandbox não estiverem configuradas no projeto, paro em (2) e te aviso.
- **E-mails só para você**: todos os templates já usam `recipientEmail` do cliente — como o cliente sintético tem o seu e-mail, nada vai para terceiros.
- **Tag de teste**: cliente, venda e processo levam tag `SIMULACAO_QA_<timestamp>` em `observacao`/`metadata_json` para você localizar e remover depois com 1 query.
- **Rollback simples**: ao final entrego um `DELETE` em cascata pronto (cliente sintético + venda + processo) caso queira purgar.

## Não faço sem nova confirmação
- Não toco nos clientes reais existentes.
- Não envio nada para terceiros.
- Não promovo para `protocolado` (esse é passo humano da equipe).

## Estimativa
~25-30 tool calls (inserts/curls/queries). ~3-5 min.

Se aprovar, executo a sequência e te entrego o relatório de auditoria no final.
