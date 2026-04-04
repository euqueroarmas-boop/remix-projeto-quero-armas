## Plano de Implementação — CMS Builder (MVP Simplificado)

### Fase 1: Banco de Dados (migração)
Criar tabelas:
- `cms_pages` — tabela principal (serviços + segmentos)
- `cms_blocks` — blocos de cada página
- `cms_pricing_rules` — regras de precificação globais
- `cms_redirects` — redirects 301 automáticos

### Fase 2: Admin UI — Services Builder (`/admin/services-builder`)
- Lista de serviços (existentes hardcoded + criados pelo admin)
- Formulário estruturado com seções: identidade, SEO, hero, dores, solução, benefícios, calculadora, precificação, escopo, contrato, FAQ
- Ações: criar, editar, duplicar, publicar/despublicar, arquivar
- Preview inline

### Fase 3: Admin UI — Segments Builder (`/admin/segments-builder`)
- Lista de segmentos com mesma estrutura
- Campos específicos: dores do nicho, compliance, serviços relacionados, prova social

### Fase 4: Pricing Engine (`/admin/pricing-engine`)
- Painel visual com preços por SO, SLA, criticidade
- Motor de criticidade (manual + assistido com perguntas)
- Desconto progressivo configurável

### Fase 5: Dynamic Renderer
- Componente que renderiza página a partir do schema do banco
- Dual-source: se existe no banco → renderiza dinamicamente; se não → usa legado
- Rota dinâmica no React Router

### Fase 6: Sitemap + SEO automático
- Edge function `sitemap` atualizada para ler páginas publicadas do banco
- Meta tags dinâmicas
- Redirects 301 para slugs alterados

### Fase 7: Módulos extras do admin
- `/admin/block-library` — catálogo visual dos blocos disponíveis
- `/admin/sitemap-manager` — visualização e refresh manual do sitemap

### Não será incluído neste MVP:
- Drag-and-drop visual
- Theme manager (complexo demais para MVP)
- Template manager (usaremos templates fixos por enquanto)
- Editor de variantes de componente (cascata base→variante→instância fica para v2)
