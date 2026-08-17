# APIs de Produtos — Arsenal Inteligente

Contrato das APIs de produtos do módulo Arsenal Inteligente, para entregar a
quem for integrar de fora (dev externo, app, parceiro).

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `arsenal-inteligente-produtos.openapi.yaml` | **O Swagger.** Especificação OpenAPI 3.1. É este arquivo que o dev importa. |
| `arsenal-inteligente-produtos.html` | A mesma coisa em página pronta para ler. Abre com dois cliques, funciona offline. |
| `redocly.yaml` | Tema da página HTML (cores e fontes do Quero Armas). |

## Como o dev abre o Swagger

Qualquer um destes caminhos, todos com o mesmo arquivo `.yaml`:

- **Swagger Editor** — <https://editor.swagger.io> → *File → Import file*
- **Postman** — *Import* → arrasta o `.yaml` → vira uma coleção com todas as chamadas
- **Insomnia** — *Import from file*
- **Redoc local** — `npx @redocly/cli preview-docs docs/api/arsenal-inteligente-produtos.openapi.yaml`
- **Gerar cliente** — `npx @openapitools/openapi-generator-cli generate -i <arquivo> -g typescript-fetch -o ./sdk`

## O que o dev ainda precisa receber (não está no arquivo)

1. A **anon key** do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`). É chave pública,
   pode mandar — mas sozinha ela não abre nada, o RLS depende do JWT.
2. Um **login de teste** (e-mail/senha ou acesso ao portal do cliente) para ele
   conseguir um `access_token` e enxergar dados.
3. O **`cliente_id`** do cadastro de teste, que é o filtro da maior parte das rotas.

Sem os três, toda chamada volta `[]` ou `401` — e não é bug.

## Regenerar a página HTML depois de mexer no YAML

```bash
npx @redocly/cli build-docs docs/api/arsenal-inteligente-produtos.openapi.yaml \
  --config docs/api/redocly.yaml \
  -o docs/api/arsenal-inteligente-produtos.html

node scripts/api-docs-offline.mjs docs/api/arsenal-inteligente-produtos.html
```

O segundo comando é obrigatório: ele embute as fontes e tira as chamadas de CDN,
que é o que faz a página abrir sem internet.

Para validar o YAML antes de entregar:

```bash
npx @redocly/cli lint docs/api/arsenal-inteligente-produtos.openapi.yaml
```

## Manutenção

A especificação foi escrita a partir do schema real (`src/integrations/supabase/types.ts`,
migrations em `supabase/migrations/` e as Edge Functions em `supabase/functions/`).
Mexeu em coluna, constraint ou contrato de função, atualize o YAML e regenere o HTML.

> **Nota**: o Supabase também publica um OpenAPI automático em
> `https://<projeto>.supabase.co/rest/v1/?apikey=<anon>`. Ele lista *todas* as
> tabelas do banco, sem recorte nem explicação de regra de negócio — serve para
> conferência, não para entregar ao dev.
