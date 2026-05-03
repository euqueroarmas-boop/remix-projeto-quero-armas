---
name: QA - Pipeline de auditoria automatizada (screenshots reais)
description: Workflow .github/workflows/qa-kb-audit.yml roda Playwright real, loga como equipe, captura screenshots reais e insere em qa_kb_artigo_imagens com image_type='auditoria_real'. Nunca gera imagem.
type: feature
---
Pipeline `qa-kb-audit-screenshots`:

- Workflow: `.github/workflows/qa-kb-audit.yml` (workflow_dispatch).
- Código: `scripts/audit-kb/{run,login,parseSteps,capture}.ts`.
- Lê artigos com `status='needs_real_image'` (ou IDs explícitos).
- Abre `QA_AUDIT_BASE_URL` com Playwright (Chromium real), loga via `/quero-armas/login` usando `QA_AUDIT_EMAIL`/`QA_AUDIT_PASSWORD` (usuário-robô dedicado).
- Cada artigo declara passos auditáveis em `body` via `<!-- audit-step n="1" route="/..." wait="..." click="..." fill="sel::valor" -->...<!-- /audit-step -->`.
- Em sucesso: upload no bucket `qa-kb-imagens` em `auditoria/<session>/<article>/step-N-<ts>.png` e insert em `qa_kb_artigo_imagens` com:
  - `image_type='auditoria_real'`, `original_image_type='auditoria_real'`, `is_ai_generated_blocked=false`, `status='approved'`
  - `route_path`, `viewport`, `device`, `captured_at`, `audit_session_id`, `origem='playwright:<finalUrl>'`
- Em falha (rota redireciona para login, 404, timeout, etc.): registra `status='error'` + `error_message` e mantém artigo `needs_real_image`. NUNCA gera imagem fake.
- Sessão registrada em `qa_kb_audit_sessions` com totals/rotas/módulos.

Secrets obrigatórios no GitHub: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QA_AUDIT_BASE_URL`, `QA_AUDIT_EMAIL`, `QA_AUDIT_PASSWORD`.

**Why:** A Base de Conhecimento precisa de prova visual real do sistema. Esta pipeline substitui qualquer geração de imagem por captura real auditável.