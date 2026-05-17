# Plano — Etapa inicial "Já tenho conta no Arsenal" em /cadastro e /cadastro-mira

## Regra canônica permanente — Arsenal Inteligente
- Arsenal Inteligente é gratuito.
- Arsenal Inteligente permanece acessível independentemente de pagamento, contrato ou serviço contratado.
- Arsenal não pode ser bloqueado por pagamento, contrato ou serviço.
- O Arsenal é hub gratuito de relacionamento e organização documental.

## Resumo
Adicionar uma nova primeira tela ao fluxo de cadastro refinado que pergunta se o usuário já é cliente do Arsenal Inteligente. Se sim (ou "não sei"), autentica via OTP por e-mail/WhatsApp reutilizando `cliente-portal-request-otp` / `cliente-portal-verify-otp` (já existentes), carrega dados de `qa_clientes`, documentos, serviços e Arsenal, e pré-preenche o restante do fluxo. Visual dark/brass Mira preservado. Fluxo 2C, WMTi, Arsenal gratuito, contratos e webhooks **não são tocados**.

## Mudanças

### 1. Estado (`useCadastroRefinadoState.ts`)
Adicionar campos:
- `modo_cliente: "indefinido" | "novo" | "existente" | "verificando" | "autenticado"`
- `cliente_existente_id: string | null`
- `dados_carregados_do_arsenal: boolean`
- `documentos_reaproveitados: Array<{ key; tipo; fileName; validade?; status }>`
- `documentos_vencidos: Array<{...}>`
- `documentos_pendentes_revisao: Array<{...}>`
- `servicos_anteriores: Array<{ id; servico_slug; status; data }>`
- `processos_ativos: Array<{...}>`
- `contratos_existentes: Array<{...}>`
- `arsenal_resumo: { cr?; craf?; armas?: number; laudos?: any[] } | null`

Default: `modo_cliente: "indefinido"`. Persistência sessionStorage já existente cobre.

### 2. Nova etapa `Etapa00Identificacao.tsx`
Tela com 3 opções (visual Mira dark/brass, mesmos tokens `qa-ref-opt-card`):
1. **Sim, já tenho conta** → fluxo OTP
2. **Não, quero começar agora** → seta `modo_cliente: "novo"` e avança para `Etapa00Escolha`
3. **Não sei** → fluxo OTP com mensagem genérica

Sub-componente `IdentificacaoOTPPanel`:
- Input e-mail OU WhatsApp (toggle).
- Botão "Enviar código" → `supabase.functions.invoke("cliente-portal-request-otp", { body: { identificador } })`.
- Resposta **sempre genérica**: "Se encontrarmos uma conta, enviaremos um código." (não confirma existência).
- Após envio, exibe `<InputOTP>` (6 dígitos) + botão "Validar".
- Validar → `cliente-portal-verify-otp` → recebe JWT/cliente_id.
- Em sucesso: chama nova edge function `qa-cadastro-carregar-cliente` (autenticada) e salva no state.

### 3. Nova edge function `qa-cadastro-carregar-cliente`
- Requer JWT do `cliente-portal-verify-otp`.
- Valida token; resolve `cliente_id`.
- Retorna: `qa_clientes` (campos pessoais/endereço), lista `qa_documentos_cliente` agrupada por `status` (válido/vencido/pendente_revisao), `qa_vendas` + `qa_itens_venda`, `qa_solicitacoes_servico`, `qa_processos`, `qa_contracts` (sem URLs públicas — só metadata), resumo Arsenal (CR/CRAF/armas). Sem `service_role` para leitura de outros dados — confiar em RLS já existente do portal.
- CORS + Zod.

### 4. Nova tela `Etapa00bClienteEncontrado.tsx`
Após autenticação. Mostra cards resumo (Dados, Docs válidos, Docs vencidos, Serviços em andamento, Arsenal). CTAs:
- "Continuar com meus dados" → pré-preenche `dadosPessoais` + marca `documentos_reaproveitados` e avança para `Etapa01Servico`.
- "Atualizar meus dados" → vai para `Etapa03Revisao` em modo edição.
- "Enviar novo documento" → vai para `Etapa02Documentos`.

### 5. Ajustes em etapas existentes
- **`Etapa01Servico`**: se `servicos_anteriores` contém serviço igual/relacionado ao escolhido → mostrar alerta inline (não bloqueia): "Existe um serviço parecido no seu histórico. Deseja continuar?"
- **`Etapa02Documentos`**: para `modo_cliente === "autenticado"`, renderizar três seções:
  - "Documentos que já temos" (cards verdes, status "Já recebido", botão "Substituir" opcional).
  - "Documentos que precisam atualizar" (vencidos, força reenvio).
  - "Documentos faltantes" (mesmo fluxo de upload atual).
  Substituição mantém histórico (não delete físico — só novo registro).
- **`Etapa03Revisao`**: badge "dados já existentes no Arsenal" nos campos pré-preenchidos. Edição marca campo como `pendente_confirmacao` (apenas flag local).

### 6. Roteamento da etapa
`QACadastroRefinadoPage` (orquestrador) renderiza `Etapa00Identificacao` quando `modo_cliente === "indefinido"`. Demais transições inalteradas.

### 7. Segurança
- Nenhuma consulta por CPF/e-mail sem OTP.
- `cliente-portal-request-otp` já normaliza identificador e retorna 200 mesmo sem match (anti-enumeração) — confirmar no código.
- `qa-cadastro-carregar-cliente` valida JWT obrigatoriamente; retorna 401 sem ele.
- URLs de documentos: apenas signed URLs curtas (5 min) via `storage.createSignedUrl` quando necessário; nunca expor `storagePath` cru.

### 8. Testes (`__tests__/cadastroMiraIntegration.test.ts`)
Adicionar guards:
- Existe `Etapa00Identificacao` montada antes de `Etapa00Escolha` quando `modo_cliente === "indefinido"`.
- Fluxo "novo" pula direto para `Etapa00Escolha`.
- Não há import de `WMTi`, `post-purchase`, `ensureClientAccess`, `customers`, `payments`, `contracts`, `quotes` em arquivos do `cadastro-refinado/`.
- Edge function `qa-cadastro-carregar-cliente` retorna 401 sem JWT (teste Deno).
- Resposta do request-otp não vaza existência.

## Arquivos
**Criar**:
- `src/pages/quero-armas/cadastro-refinado/steps/Etapa00Identificacao.tsx`
- `src/pages/quero-armas/cadastro-refinado/steps/Etapa00bClienteEncontrado.tsx`
- `src/pages/quero-armas/cadastro-refinado/components/IdentificacaoOTPPanel.tsx`
- `supabase/functions/qa-cadastro-carregar-cliente/index.ts`
- `supabase/functions/qa-cadastro-carregar-cliente/index_test.ts`

**Alterar**:
- `src/pages/quero-armas/cadastro-refinado/hooks/useCadastroRefinadoState.ts` (novos campos)
- `src/pages/quero-armas/cadastro-refinado/QACadastroRefinadoPage.tsx` (roteamento de etapa)
- `src/pages/quero-armas/cadastro-refinado/steps/Etapa01Servico.tsx` (alerta de duplicidade)
- `src/pages/quero-armas/cadastro-refinado/steps/Etapa02Documentos.tsx` (seções de reaproveitamento)
- `src/pages/quero-armas/cadastro-refinado/steps/Etapa03Revisao.tsx` (badge origem)
- `src/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css` (estilos das novas seções)
- `src/pages/quero-armas/cadastro-refinado/__tests__/cadastroMiraIntegration.test.ts` (guards)

## Não toca
WMTi, `qa-checkout-*`, `qa-asaas-webhook`, `qa-generate-contract`, `qa-provisionar-acesso-portal`, `qa-upload-signed-contract`, `qa-liberar-servicos-contrato`, `post-purchase.ts`, `ensureClientAccess`, Arsenal gating (continua gratuito), fluxo 2C de pagamento.

## Validação
`npm run typecheck`, `npm run test`, `npm run build` ao final.

## Pontos a confirmar
1. **OTP por WhatsApp**: hoje `cliente-portal-request-otp` aceita só e-mail, ou também telefone? Se só e-mail, mantenho input e-mail e adiciono WhatsApp em fase 2.
2. **Estrutura real de `qa_documentos_cliente`**: confirma colunas de validade/status que devo usar para classificar válido/vencido/pendente.
3. **Quer que eu já implemente substituição de documento com histórico (não-destrutiva) nesta entrega, ou ficamos só com leitura+marcação nesta fase**?
