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

Cada artigo de KB pode declarar passos auditáveis no `body` usando blocos:

```
<!-- audit-step n="1" route="/quero-armas/clientes" wait="text=Clientes" -->
Acessar a lista de clientes
<!-- /audit-step -->

<!-- audit-step n="2" route="/quero-armas/clientes" click="text=Novo Cliente" wait="text=Cadastrar" -->
Abrir modal de cadastro
<!-- /audit-step -->
```

Atributos suportados:
- `n`: step_number (obrigatório)
- `route`: rota relativa (obrigatório)
- `wait`: seletor que precisa estar visível antes de capturar
- `click`: seletor a ser clicado depois de carregar a rota
- `fill`: `seletor::valor` para preencher antes do print

Se o artigo **não** tiver blocos `audit-step`, o auditor faz uma única
captura na rota declarada em `qa_kb_artigos.module` ou no metadado
`audit_route` da sessão atual. Sem rota válida → `needs_real_image`.

## Resultado

- ✅ Sucesso → linha em `qa_kb_artigo_imagens` com:
  - `image_type='auditoria_real'`
  - `original_image_type='auditoria_real'`
  - `is_ai_generated_blocked=false`
  - `route_path`, `viewport`, `device`, `captured_at`, `audit_session_id`
  - `storage_path` apontando para `qa-kb-imagens/auditoria/<sessão>/<artigo>/<step>.png`
- ❌ Falha → artigo permanece `needs_real_image` e linha de erro registrada
  em `qa_kb_artigo_imagens` com `status='error'` + `error_message`.