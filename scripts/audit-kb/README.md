# QA KB Audit Screenshots

Pipeline de **auditoria automatizada** da Base de Conhecimento Quero Armas.

> ⚠️ **Esta pipeline NÃO gera imagem por IA.**
> Ela abre o sistema real com Playwright, navega pelas telas reais
> descritas no artigo e captura **screenshot real**. Se a tela não existir,
> o artigo continua marcado como `needs_real_image` — nenhuma imagem é
> inventada, nenhuma imagem ilustrativa é criada.

## Como rodar

1. No GitHub: **Actions → QA KB Audit Screenshots → Run workflow**.
2. Inputs:
   - `article_ids` (opcional): UUIDs separados por vírgula. Vazio = pega
     todos os artigos com `status='needs_real_image'`.
   - `max_articles`: limite de artigos por execução (default 10).
   - `viewport`: ex `1440x900` (desktop) ou `390x844` (iPhone 12).

## Secrets obrigatórios (Repo → Settings → Secrets and variables → Actions)

| Nome | Descrição |
|------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-only) |
| `QA_AUDIT_BASE_URL` | URL do sistema (ex: preview Lovable) |
| `QA_AUDIT_EMAIL` | Email do usuário-robô auditor |
| `QA_AUDIT_PASSWORD` | Senha do usuário-robô auditor |

## Como o artigo é "lido"

O auditor tenta, em ordem:

1. **`audit-step` manual** no `body` (controle máximo, fallback canônico).
2. **`audit_plan_json`** já gravado no artigo.
3. **Plano gerado pela IA** via `qa-kb-audit-plan` (Lovable AI, `google/gemini-2.5-flash`)
   — chama a edge function, persiste o plano em `qa_kb_artigos.audit_plan_json`
   e usa apenas passos com `confidence ≥ 0.6`.

> A IA **não** desenha imagem. Ela só sugere `route`, `expected_text`, `click`, `wait`.
> Quem captura é o Playwright. Se nenhum `expected_text` aparece na tela,
> o screenshot **não** é salvo e o artigo continua `needs_real_image`.

### Bloco manual (override)

```
<!-- audit-step n="1" route="/quero-armas/clientes" wait="text=Clientes" -->
Acessar a lista de clientes
<!-- /audit-step -->
```

Atributos suportados:
- `n`: step_number (obrigatório)
- `route`: rota relativa (obrigatório)
- `wait`: seletor que precisa estar visível antes de capturar
- `click`: seletor a ser clicado depois de carregar a rota
- `fill`: `seletor::valor` para preencher antes do print

### Plano IA (`audit_plan_json`)

Estrutura persistida em `qa_kb_artigos.audit_plan_json`:

```json
{
  "intent": "Cadastrar um novo cliente",
  "entities": ["cliente", "CPF"],
  "candidate_routes": ["/quero-armas/clientes"],
  "steps": [
    { "n": 1, "route": "/quero-armas/clientes",
      "expected_text": ["Clientes", "Novo cliente"],
      "confidence": 0.86 }
  ],
  "overall_confidence": 0.86,
  "needs_human_review": false
}
```

`needs_human_review=true` é apenas um sinalizador informativo (não bloqueia
execução). O Playwright sempre tenta executar o plano. Se todos os steps
tiverem `confidence < 0.6`,
o auditor não captura imagem e marca o artigo como `needs_real_image`
com erro `AI_PLAN_NEEDS_HUMAN_REVIEW`.

## Resultado

- ✅ Sucesso → linha em `qa_kb_artigo_imagens` com:
  - `image_type='auditoria_real'`
  - `original_image_type='auditoria_real'`
  - `is_ai_generated_blocked=false`
  - `route_path`, `viewport`, `device`, `captured_at`, `audit_session_id`
  - `storage_path` apontando para `qa-kb-imagens/auditoria/<sessão>/<artigo>/<step>.png`
- ❌ Falha → artigo permanece `needs_real_image` e linha de erro registrada
  em `qa_kb_artigo_imagens` com `status='error'` + `error_message`.