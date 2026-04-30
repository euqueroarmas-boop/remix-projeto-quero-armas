---
name: client-portal-light-mandate
description: Portal do Cliente / Arsenal Inteligente é Premium Light, NÃO tactical dark
type: design
---
O Portal do Cliente (`QAClientePortalPage`, `ArsenalView`, `ArmaManualForm`, `ClienteDocsHubModal`, KPIs, modais, drawers) deve seguir o padrão BRANCO PREMIUM idêntico ao dashboard interno: fundo `bg-slate-50`, cards `bg-white border-slate-200 shadow-sm`, títulos `text-slate-900`, secundários `text-slate-500/600`.

PROIBIDO em telas internas/autenticadas:
- `data-tactical-portal` como switch de tema dark (atributo foi neutralizado em `src/index.css` para apenas reforçar light — não recriar regras dark)
- fundos `bg-black`, `bg-zinc-950`, `bg-slate-950`, `bg-neutral-950`
- gradientes escuros `from-slate-900`, `to-slate-950`
- header com gradient preto + dourado (#c9a961)
- botões `bg-slate-800/900` com texto âmbar dourado em telas autenticadas

PERMITIDO dark/tactical apenas em: site público, landing pages, páginas SEO, arsenal digital público gratuito.
