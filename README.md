# WMTi Tecnologia da Informação — Site Corporativo

Site institucional da WMTi Tecnologia da Informação, empresa de TI localizada em Jacareí/SP com atuação no Vale do Paraíba.

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Estilização:** TailwindCSS + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — captura de leads
- **Animações:** Framer Motion

## Estrutura

```
src/
  components/   → Componentes reutilizáveis (Navbar, Footer, WhatsApp, etc.)
  pages/        → Páginas e rotas
  hooks/        → Custom hooks
  lib/          → Utilitários
  assets/       → Imagens e recursos estáticos
  integrations/ → Cliente Supabase e tipos
```

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Configurado para deploy via Lovable. Para hospedagem estática (Netlify, Vercel), adicione regra de rewrite:

```
/* → /index.html  200
```

## Variáveis de Ambiente

- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Chave anon do Supabase

## Contato

- **Site:** https://wmti.com.br
- **WhatsApp:** (11) 96316-6915
- **Email:** contato@wmti.com.br
