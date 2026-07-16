---
name: Arsenal Inteligente Logo (Oficial MODELO 08)
description: Logo oficial canônica do produto Arsenal Inteligente — arte final aprovada, bordô #7A1F2B, sempre via componente ArsenalInteligenteLogo
type: design
---
A logo oficial do Arsenal Inteligente é a arte final MODELO 08 (bordô #7A1F2B, monograma AI + wordmark ARSENAL/INTELIGENTE). NÃO redesenhar em SVG à mão — o desenho manual foi rejeitado pelo cliente.

**Fonte de verdade (assets canônicos):**
- Horizontal: `src/assets/branding/arsenal-inteligente-horizontal.png.asset.json`
- Vertical: `src/assets/branding/arsenal-inteligente-vertical.png.asset.json`
- Símbolo AI isolado: `src/assets/branding/arsenal-inteligente-symbol.png.asset.json`

**Uso obrigatório:** sempre via `<ArsenalInteligenteLogo />` em `src/components/branding/ArsenalInteligenteLogo.tsx`. Props: `orientation` (`horizontal` | `vertical`), `color` (`burgundy` | `black` | `white`), `showWordmark` (false → só o monograma AI). Nunca importar as imagens diretamente em outras telas; sempre usar o componente.

**Proibido:** recriar em SVG, alterar cores fora de burgundy/black/white, aplicar sombra/degradê/brilho, deformar tipografia, cortar letras.