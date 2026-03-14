

## Problem

The 40+ SEO pages exist in `seoPages.ts` and render via `/:slug`, but there are **zero navigation links** pointing to them anywhere in the UI. The navbar only links to anchor sections and `/blog`. The footer has no service links. Service cards in sections don't link to their corresponding pages.

## Plan

### 1. Add links from service section cards to their SEO pages

In `ServicesSection.tsx`, wrap each service card with a `Link` to the matching SEO page:
- DELL POWEREDGE → `/servidor-dell-poweredge-jacarei`
- MICROSOFT 365 → `/microsoft-365-para-empresas-jacarei`
- PFSENSE → `/firewall-pfsense-jacarei`
- BACKUP → `/backup-empresarial-jacarei`
- REDES → `/montagem-e-monitoramento-de-redes-jacarei`
- SUPORTE → `/suporte-ti-jacarei`

Add a "Saiba mais →" link at the bottom of each card.

### 2. Add a "Serviços" dropdown submenu in the Navbar

Replace the simple "Serviços" anchor link with a dropdown (desktop hover, mobile expandable) containing direct links to the main service pages:
- Suporte TI
- Servidores Dell
- Microsoft 365
- Firewall pfSense
- Redes
- Locação de Computadores
- Backup Empresarial
- Segurança da Informação

### 3. Expand the Footer with service and segment links

Add columns to the footer:
- **Serviços**: links to 6-8 main service pages
- **Segmentos**: Cartórios, Clínicas, Escritórios
- **Regiões**: Jacareí, SJC, Taubaté
- **Institucional**: Blog, Contato, Diagnóstico TI

### 4. Add links from other home sections

- `CartoriosSection`: link to `/ti-para-cartorios` and `/cartorios/provimento-213`
- `InfraSection`: link to `/infraestrutura-ti-corporativa-jacarei`
- `RentalSection`: link to `/locacao-de-computadores-para-empresas-jacarei`
- `SecuritySection`: link to `/seguranca-da-informacao-empresarial-jacarei`
- `HeroSection`: add a secondary CTA linking to `/empresa-de-ti-jacarei`

### 5. Fix console warnings

The `ServicePageTemplate` passes refs to `Navbar`, `Footer`, and `WhatsAppButton` which are function components without `forwardRef`. Remove any ref passing or wrap with `forwardRef` as needed.

### Files to modify
- `src/components/Navbar.tsx` — add services dropdown
- `src/components/Footer.tsx` — add link columns
- `src/components/ServicesSection.tsx` — add links to cards
- `src/components/CartoriosSection.tsx` — add page links
- `src/components/InfraSection.tsx` — add page link
- `src/components/RentalSection.tsx` — add page link
- `src/components/SecuritySection.tsx` — add page link
- `src/components/HeroSection.tsx` — add pillar page CTA
- `src/components/MobileSummary.tsx` — update `to` props if needed

