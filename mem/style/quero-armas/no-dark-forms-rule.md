---
name: QA No Dark Forms Rule
description: Proibido fundo preto em qualquer formulário, input, textarea, modal ou dialog do painel admin Quero Armas. Padrão é o Arsenal de Clientes (Premium Light)
type: constraint
---

## Regra
NENHUM formulário, input, textarea, select, modal, drawer ou dialog do painel admin Quero Armas pode ter fundo preto/escuro. Letras e botões DEVEM ser legíveis (alto contraste em tema claro).

## Padrão obrigatório (referência: tela /clientes → Arsenal de Clientes)
- Fundo do container: `bg-white` ou `bg-slate-50`
- Inputs/Textarea/Select: `bg-white border-slate-300 text-slate-900 placeholder:text-slate-400`
- Modais (DialogContent): `bg-white` explícito
- Botões primários: cores legíveis (slate-900 ok, mas nunca o CONTAINER do form preto)
- Páginas admin DEVEM ser envolvidas em `.qa-scope` para herdar tokens shadcn light

## Por que
Tokens shadcn herdam Absolute Dark do WMTi Core na raiz. Sem `.qa-scope` ou classes light explícitas, Dialog/Input/Textarea ficam pretos automaticamente.

## How to apply
1. Toda nova página admin: envolver root em `<div className="qa-scope ...">`.
2. Todo Input/Textarea dentro de Dialog admin: adicionar classes light explícitas como redundância.
3. Toda DialogContent admin: incluir `bg-white` no className.
4. Ao revisar telas existentes, substituir qualquer fundo escuro por padrão Premium Light (referência: ClienteArsenalReview / QAClientesPage).

**Why:** Usuário definiu como regra de negócio absoluta após o modal "Aprovar e usar como modelo" aparecer com fundo preto.
