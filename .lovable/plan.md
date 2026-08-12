# Chips em uma linha + Modo Noturno do admin

## 1. Chips param de quebrar linha (fonte encolhe até caber)

Alvo: `Chip` em `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx:146`.

Hoje o chip usa `break-words [overflow-wrap:anywhere]`, então texto longo como "IDENTIFICAÇÃO CIVIL" ou "SERVIDOR/INSTITUIÇÃO" quebra em duas linhas e desalinha a tabela.

Mudança:
- Chip passa a ser `whitespace-nowrap` (nunca quebra) e o texto interno ganha escala automática: um wrapper mede a largura disponível da célula e aplica um `font-size` proporcional, com piso de 8px para continuar legível.
- Implementação sem biblioteca: classe utilitária CSS `qa-chip-fit` usando `container-type: inline-size` na célula e `font-size: clamp(8px, 1.9cqi, 10.5px)` — o chip diminui sozinho conforme a coluna aperta, sem JS e sem custo de re-render.
- `title` continua com o texto completo, então o conteúdo nunca se perde.
- A régua de 1px a menos em telas ≤1600px continua valendo por cima disso.

## 2. Botão de modo noturno no cabeçalho do painel

Posição: ao lado do ícone de colunas (engrenagem) e do atualizar, em `DashboardProgressoClientes.tsx:586-603`. Ícone lua/sol (`Moon` / `Sun` do lucide), mesmo tamanho e mesmo estilo discreto dos outros dois.

Alcance: **todo o admin Quero Armas** (sidebar, cabeçalho, breadcrumb, cards, tabelas, modais das páginas administrativas). A área do cliente e o site público não mudam.

Como funciona:
- Novo contexto leve `QATemaProvider` (`src/components/quero-armas/QATemaContext.tsx`) montado no `QALayout`, guardando a preferência em `localStorage` (`qa_admin_tema`) e respeitando `prefers-color-scheme` na primeira visita.
- O provider adiciona a classe `qa-noite` no mesmo elemento que já tem `qa-scope`, então o tema fica confinado ao admin.
- Script curto no `index.html` para aplicar a classe antes da pintura, evitando o flash de tela clara ao recarregar.

## 3. Paleta noturna

O admin usa muitos hex fixos (`#0A0A0A`, `#E4E4E4`, `bg-white`), então só trocar tokens não basta. Duas camadas:

1. **Tokens shadcn** — bloco `.qa-scope.qa-noite` em `src/index.css` sobrescrevendo `--background`, `--card`, `--popover`, `--border`, `--input`, `--muted`, `--sidebar-*` para a escala neutra Dark AAA já registrada na memória do projeto. Isso resolve todo componente shadcn (Dialog, Select, Input, Button outline).
2. **Ponte para os hex fixos** — regras em `.qa-noite` que remapeiam os valores mais usados do admin: superfícies (`bg-white`, `#FFFFFF`, `#FAFAFA`), bordas (`#E4E4E4`, `#DADADA`, `#F3F3F3`) e tintas (`#0A0A0A`, `#3A3A3A`, `#9A9A9A`). As cores de estado (verde, âmbar, bordô `#7A1F2B`) ganham variantes de fundo escuro para manter contraste, sem mudar o significado.

Os chips continuam com a mesma semântica de cor; só o fundo e a borda ficam escuros no modo noturno.

## Detalhes técnicos

- Arquivos tocados: `src/index.css` (bloco `.qa-scope.qa-noite` + `qa-chip-fit`), `src/components/quero-armas/QATemaContext.tsx` (novo), `src/components/quero-armas/QALayout.tsx` (provider + classe), `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx` (botão + `Chip`), `index.html` (script anti-flash).
- Nenhuma mudança de backend, dados ou regra de negócio.
- A escala neutra Dark AAA da memória do projeto é a fonte da paleta — nada de cinza inventado.

## Fora de escopo

Área do cliente, site público, checkout e páginas de contrato mantêm a identidade atual.
