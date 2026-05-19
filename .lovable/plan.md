# Bundle CAC — Comprar arma (3 serviços)

Quando o CAC com CR ativo escolhe "Comprar arma" como atirador ou caçador, o sistema passa a selecionar automaticamente 3 serviços (autorização + registro + GTE), permitindo remover individualmente na Etapa 01, mantendo no mínimo 1.

## Bundles

- **Atirador**: `autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac`, `registro-e-apostilamento-de-arma-de-fogo-cac`, `guia-de-trafego-especial-cac`
- **Caçador**: `autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac`, `registro-e-apostilamento-de-arma-de-fogo-cac`, `guia-de-trafego-especial-cac`

## Arquivos & mudanças

**1. `useCadastroRefinadoState.ts`** — adicionar `servicosSlugs: string[]` (default `[]`). Manter `servicoSlug` como derivado (`servicosSlugs[0] ?? null`) via getter ou sincronia em `update()`. Persistir em localStorage como hoje.

**2. `qaCadastroV2Catalog.ts`** — novo tipo de opção:
```ts
type QAV2NodeOption =
  | { kind: "service"; servicoSlug: string; ... }
  | { kind: "bundle"; servicoSlugs: string[]; ... }
  | { kind: "node"; nextNodeId: string; ... };
```
Trocar as 2 opções do node `comprar_arma` (atirador, caçador) para `kind: "bundle"` com os arrays acima.

**3. `Etapa00Escolha.tsx`** — quando `opt.kind === "bundle"`, chamar novo callback `onSelectBundle(slugs)` que faz `update({ servicosSlugs: slugs })` e avança para Etapa 01. Quando `service`, comportamento atual: `update({ servicosSlugs: [slug] })`.

**4. `Etapa01Servico.tsx`** — refatorar para multi-serviço:
- Buscar via `.in("slug", state.servicosSlugs)`.
- Renderizar lista de cards (um por serviço) com nome, descrição, preço, e botão **Remover** (X) — desabilitado quando `servicosSlugs.length === 1`.
- Rodapé com somatório (label "Total dos serviços").
- Quando array tem 1 item, manter visual atual (card único sem X).

**5. `Etapa04Pagamento.tsx`** — buscar todos: `.select("id, preco, nome, slug").in("slug", state.servicosSlugs)`. `preco = Σ`. Popular `cart` com `servicos.map(s => ({ servico_id: s.id, slug: s.slug, quantidade: 1 }))`. Enviar `catalogo_slug` como `servicosSlugs.join(",")` para `qa-cliente-criar-conta-publica`.

**6. `ContractPreviewCard.tsx`** — aceitar `servicos: Array<{nome, preco}>` (ou via slugs) e listar todos.

## Fora de escopo (não tocar)

- Edge functions de pagamento (já consomem `cart`).
- `checkoutPricing.ts` (recebe valor total).
- Fluxos não-CAC ou CAC fora de "comprar arma" continuam com 1 serviço (state aceita array de 1).
- Banco de dados: não há migração.

## Riscos & mitigação

- **Zero Regression**: state continua expondo `servicoSlug` como compat (derivado), então qualquer leitura existente segue funcionando até migrar.
- **Remover último**: botão remover gateado por `servicosSlugs.length > 1`.
- **CAC simples** (registro avulso, GTE avulso) seguem como `kind: "service"` — não afetados.

## Validação pós-implementação

1. CAC → Comprar arma → Atirador → Etapa 01 mostra 3 cards, total = soma. Remover 1 → 2 cards, total recalcula. Botão X some no último.
2. Pagamento PIX → checkout cria venda com `cart` de N itens (N = serviços restantes).
3. Fluxo Posse (não-CAC) continua com 1 serviço, sem regressão visual.
