# Ajustes de layout do portal do cliente (notebook/desktop)

## 1. Botão ADICIONAR x avatar

Hoje o avatar do cliente é fixo no topo direito (56px, a 16px do topo e 72px da direita) e o botão ADICIONAR do painel de documentos fica exatamente embaixo dele, gerando competição visual.

Correção: reservar a zona do avatar no cabeçalho dos painéis do portal em telas grandes — o conteúdo do header (título + botão ADICIONAR) passa a respeitar uma faixa livre de ~140px à direita, de modo que o botão nunca fique sob o avatar. Em telas menores que notebook nada muda (o avatar fixo não é exibido).

## 2. Coluna de apresentação da esquerda voltando ao tamanho original

A coluna de apresentação (a barra lateral escura com o papel de parede e a marca) foi reduzida de 260px para 190px em uma alteração anterior. Ela volta para 260px quando expandida, e o conteúdo da página volta a ser deslocado nos mesmos 260px, evitando sobreposição. O estado recolhido (68px) continua igual.

Mobile permanece exatamente como está — a coluna lateral já não aparece nesse tamanho de tela.

## 3. Nome do dispositivo

Para se referir a notebooks e desktops (telas grandes, a partir de 1024px de largura), o termo usado no projeto é **desktop** (ou, quando quiser separar, "notebook/desktop" = breakpoint `lg` para cima). Basta dizer "no desktop" que o ajuste será aplicado só nessa faixa, sem tocar em mobile e tablet.

## Detalhes técnicos

- `src/pages/quero-armas/QAClientePortalPage.tsx`
  - wrapper raiz: `lg:pl-[190px]` volta a `lg:pl-[260px]` (estado expandido).
  - aside da barra lateral: `w-[190px] max-w-[190px]` volta a `w-[260px] max-w-[260px]`.
- `src/components/quero-armas/portal/DocumentosCategoriaZ6V3Panel.tsx`
  - regra CSS `.qa-docsz6 .hdr-top` com `padding-right: 140px` apenas em `@media (min-width: 1024px)`, mantendo o comportamento atual abaixo desse breakpoint.
- Verificar visualmente as demais telas fixas do portal (contratos, processos) que usam o mesmo cabeçalho com botão à direita e aplicar a mesma reserva caso o botão caia sob o avatar.
