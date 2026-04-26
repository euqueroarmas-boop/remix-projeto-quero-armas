# Eu Quero Armas

Sistema jurídico-operacional para gestão de clientes, documentos, processos administrativos, vencimentos, arsenal, exames, CR, CRAF, GTE e geração assistida de peças administrativas para legalização de armas de fogo no Brasil.

## Visão geral

A plataforma **Eu Quero Armas** centraliza:

- **Cadastro e perfil 360º de clientes** (PF, CACs, Segurança Pública, Magistrados/MP, Militares).
- **Gestão de casos e serviços**: posse, porte, CR (CAC), CRAF, GTE, recursos administrativos junto à PF/EB.
- **Geração assistida de peças jurídico-administrativas** com IA (streaming em tempo real, padrão "Advogado Sênior", >2.000 palavras).
- **Acervo Jurídico** (base de conhecimento) com ingestão de leis, decretos, jurisprudência e petições aprovadas.
- **Gestão de arsenal** com catálogo, fotos, classificação CRAF, calibre e jurisdição.
- **Alertas de vencimentos**: CR, CRAF, GTE, exames psicológico/manuseio, documentos.
- **Portal do cliente** com acompanhamento de processos, downloads e suporte.
- **Cadastro público** para captura de leads/clientes via link.
- **Curso de Operador de Pistola** (landing page de captura).

## Stack técnica

- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui, React Router, TanStack Query, i18next (pt-BR/en-US).
- **Backend:** Lovable Cloud (Supabase): Postgres + RLS, Auth, Storage, Edge Functions (Deno).
- **IA:** Lovable AI Gateway (Google Gemini 2.5 Pro/Flash + OpenAI GPT-5) para geração de peças, extração documental e RAG via pgvector.
- **PDF/Assinatura:** PAdES via @signpdf com certificados ICP-Brasil A1 (AES-256-GCM).
- **Pagamentos / billing:** Asaas (sandbox + produção) — fluxo legado preservado.
- **WhatsApp:** Evolution API.

## Rotas principais

### Públicas
- `/` — Landing page principal
- `/servicos` — Catálogo de serviços
- `/cadastro` e `/cadastro/foto` — Cadastro público de clientes
- `/lp/defesa-pessoal-posse`, `/lp/cac-cr`, `/lp/atividades-avulsas` — Landing pages segmentadas
- `/curso-operador-pistola`
- `/descobrir-meu-caminho` — Quiz de orientação
- `/area-do-cliente/login` — Portal do cliente
- `/login` — Login administrativo

### Administrativas (acesso restrito)
- `/dashboard` — KPIs operacionais
- `/clientes`, `/casos`, `/gerar-peca` — Núcleo operacional
- `/base-conhecimento`, `/legislacao`, `/jurisprudencia`, `/modelos-docx` — Acervo
- `/armamentos` — Arsenal
- `/financeiro`, `/relatorios`, `/auditoria`
- `/historico`, `/configuracoes`, `/acessos`, `/clubes`

## Variáveis de ambiente (Lovable Cloud)

Geridas automaticamente em `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Secrets das edge functions (configuradas via painel Lovable Cloud):
- `LOVABLE_API_KEY` (IA Gateway)
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS`
- `INTERNAL_FUNCTION_TOKEN` — autenticação service-to-service entre edge functions
- `ADMIN_PASSWORD`, `QA_ENCRYPTION_KEY`, `QA_CRON_TOKEN`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_SECURE`
- E-mail transacional: `RESEND_API_KEY`
- WhatsApp: `EVOLUTION_API_URL`, `EVOLUTION_API_TOKEN`
- Asaas (legado): `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`
- Outras: `FIRECRAWL_API_KEY`, `GITHUB_PAT`

## Comandos

```bash
npm install            # instala dependências
npm run dev            # ambiente de desenvolvimento (Vite)
npm run build          # build de produção (gera sitemap + bundle)
npm run preview        # serve o build local
npm run typecheck      # checagem de tipos
npm run lint           # ESLint
npm run test           # Vitest (unitários)
npm run cy:open        # Cypress (e2e interativo)
npm run cy:run         # Cypress headless
```

## Segurança (resumo do hardening)

A plataforma foi endurecida em 8 ondas de auditoria:

1. **RBAC**: roles em tabela dedicada `user_roles`, função `has_role()` SECURITY DEFINER.
2. **RLS** estrita em tabelas operacionais (clientes, casos, documentos, financeiro).
3. **Auditoria fiscal imutável**: triggers bloqueiam DELETE em `fiscal_documents` e histórico.
4. **Senha Gov criptografada** (AES) com tabela de acessos imutável.
5. **CMS/blog/leads**: separação entre conteúdo público e dados sensíveis.
6. **Edge functions sensíveis** com guarda dual (JWT admin OU `INTERNAL_FUNCTION_TOKEN`).
7. **Performance**: ~60 índices estratégicos em FKs e colunas filtradas.
8. **View `qa_exames_cliente_status`** com `security_invoker=true` (respeita RLS do consultante).

Decisões conscientes: `pgvector`/`unaccent` permanecem em `public` (mover quebra RAG).

## Status

Plataforma em operação. Hardening de segurança completo. Sitemap restrito a rotas públicas reais. Identidade 100% Eu Quero Armas (`www.euqueroarmas.com.br`).
