# Modo noturno do admin — refazer por inversão inteligente

O modo atual falhou porque o admin tem ~2.700 cores fixas escritas direto nos componentes (`#0A0A0A`, `#FFFFFF`, etc.), quase todas em `style` inline. A ponte de classes CSS não alcança inline styles, então o fundo escureceu mas o texto continuou preto — resultado ilegível.

## Nova abordagem

Trocar a ponte de classes por uma **inversão calibrada** aplicada ao container do admin:

- `filter: invert(1) hue-rotate(180deg)` no elemento `qa-scope`, o que transforma qualquer cor — inline, Tailwind ou token — em sua contraparte escura, mantendo os matizes (bordô continua bordô, verde continua verde).
- Ajuste fino de `brightness` e `contrast` para o branco virar um cinza-carvão profundo (não preto puro) e o texto ficar legível sem estourar.
- **Re-inversão** de tudo que não pode inverter: imagens, `img`, `svg` com foto, logos, avatares, `canvas`, `video`, iframes e mapas recebem `filter: invert(1) hue-rotate(180deg)` de volta.
- Os overlays do Radix (modais, popovers, selects) renderizam fora da árvore do layout, então recebem a mesma regra via `[data-radix-popper-content-wrapper]` e `[role="dialog"]`, com a mesma re-inversão de mídia.
- Sombras e o overlay preto de modais ganham correção de opacidade para não virarem manchas brancas.

## Limpeza

Remove-se o bloco anterior do modo noturno em `src/index.css`: os overrides de tokens (`--background`, `--card`, `--qa-paper`…) e a ponte de hex. Manter os dois causa dupla inversão. Os tokens do modo claro continuam intactos.

## O que não muda

- Botão de lua/sol, contexto `QATemaContext`, persistência em `localStorage` e script anti-flash no `index.html` permanecem como estão.
- Área do cliente, site público e checkout continuam sem modo noturno.
- Nenhuma mudança de dados, backend ou regra de negócio.
- A correção dos chips (fonte que encolhe em vez de quebrar linha) continua valendo.

## Detalhes técnicos

- Arquivo tocado: `src/index.css` (substituição do bloco `html.qa-noite`).
- `filter` cria um contexto de empilhamento; por isso a inversão vai no wrapper do admin, não no `<html>`, para não quebrar `position: fixed` da sidebar. Elementos fixos dentro do admin serão verificados após a mudança.
- Verificação: abrir `/dashboard` no modo noturno e conferir nomes de clientes, chips, KPIs, sidebar, modal de colunas e logos.
