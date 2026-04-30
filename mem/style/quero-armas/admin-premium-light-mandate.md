---
name: QA Admin Premium Light Mandate
description: Padrão branco premium obrigatório em TODAS as telas internas/operacionais/administrativas do Quero Armas. Site público intocado.
type: design
---

## Onde APLICAR (Premium Light obrigatório)
Painel Operacional, Dashboard admin, Clientes, Homologação de Clientes, Contratações, Financeiro, Processos, Central de Documentos, Arsenal admin, Cadastro de armas, Cadastro de CR/CRAF/GTE, Revisão admin, Modais admin, Drawers, Tabelas, Cards internos, Formulários internos.

## Onde NÃO APLICAR
Site público institucional, landing pages públicas, páginas SEO, página pública do Arsenal Digital Gratuito, páginas públicas de venda/marketing. Portal do cliente pode manter dark/tático quando fizer sentido para UX do cliente final.

## Padrão visual
- Fundo branco ou cinza muito claro (slate-50/white).
- Cards brancos com borda suave (border-slate-200), sombra leve e refinada.
- Tipografia escura, limpa, legível (slate-900 títulos, slate-600 secundário).
- Botões premium, discretos e alinhados.
- Badges elegantes, tabelas organizadas, modais claros, espaçamento generoso.
- Visual executivo/moderno/profissional. Sem aparência de "app antigo". Sem excesso de dark em admin.

## Regras de segurança (Zero Regression)
- NÃO remover componentes existentes.
- NÃO refatorar estrutura sem necessidade.
- NÃO mexer em banco, RLS, pagamentos, processos, checklist, arsenal, fotos de armas ou fluxos funcionais por causa de ajuste visual.
- Ajustes devem ser visuais e progressivos.

**How to apply:** Em qualquer nova tela admin/operacional do QA, partir do Premium Light por padrão. Em telas existentes, migrar progressivamente sem quebrar lógica.
