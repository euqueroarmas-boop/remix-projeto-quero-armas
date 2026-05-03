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
- Resolução de passos em ordem: (1) `audit-step` manual no body; (2) `qa_kb_artigos.audit_plan_json` existente; (3) plano gerado pela edge function `qa-kb-audit-plan` (Lovable AI google/gemini-2.5-flash, tool calling com `emit_audit_plan`). Apenas passos com `confidence ≥ 0.6` são executados.
- Validação semântica: cada step pode listar `expected_text[]` — Playwright só captura screenshot se pelo menos uma frase estiver visível na rota. Caso contrário, registra erro `EXPECTED_TEXT_NOT_FOUND` e mantém `needs_real_image`.
- Plano IA é persistido em `qa_kb_artigos.audit_plan_json` (+ `audit_plan_generated_at`, `audit_plan_model`) para revisão da equipe.
- A IA NÃO gera imagem em nenhuma etapa — só sugere rotas, textos esperados e ações. Captura é sempre real via Playwright.
- Em sucesso: upload no bucket `qa-kb-imagens` em `auditoria/<session>/<article>/step-N-<ts>.png` e insert em `qa_kb_artigo_imagens` com:
  - `image_type='auditoria_real'`, `original_image_type='auditoria_real'`, `is_ai_generated_blocked=false`, `status='approved'`
  - `route_path`, `viewport`, `device`, `captured_at`, `audit_session_id`, `origem='playwright[<source>|conf=<n>]:<finalUrl>'`
- Em falha (rota redireciona para login, 404, timeout, expected_text ausente, plano IA com baixa confiança): registra `status='error'` + `error_message` e mantém artigo `needs_real_image`. NUNCA gera imagem fake.
- Sessão registrada em `qa_kb_audit_sessions` com totals/rotas/módulos.

Secrets obrigatórios no GitHub: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QA_AUDIT_BASE_URL`, `QA_AUDIT_EMAIL`, `QA_AUDIT_PASSWORD`.

**Why:** A Base de Conhecimento precisa de prova visual real do sistema. Esta pipeline substitui qualquer geração de imagem por captura real auditável.