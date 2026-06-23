---
name: Cockpit Z6 Light — Canônico
description: Stack visual canônica do portal do cliente (Meus Processos + qualquer página nova). Cabeçalho cliente-centric, FOCO DO DIA, 6 KPIs e cards de processo com PROGRESSO + Stepper + Timeline + Checklist
type: design
---

# Cockpit Z6 Light — Stack canônica do Portal do Cliente

Toda página NOVA do portal/área do cliente DEVE seguir este layout. Não regredir. Mockup oficial: `cockpits/cockpit-z6.jpg`. Código de referência: `src/components/quero-armas/cockpit-z6/`.

## Tokens (verbatim, sem trocar)
- Página: `#F2F2F2` · Card: `#FFFFFF` · Borda: `#E5E5E5` · Linha interna: `#EFEFEF` · Tinta: `#0A0A0A` · Texto secundário: `#6A6A6A` / `#7A7A7A`
- Bordô oficial Arsenal: `#7A1F2B` (CTAs, barras de progresso ativas, badge EM ANDAMENTO)
- Âmbar atenção: `#D6A64B` (etapa em curso) · fundo âmbar: `#FCEFCE`
- Verde concluído: `#2F8F4A` · fundo verde: `#E3F2E8`
- Vermelho bloqueante: `#D9342B` / fundo `#FCE3E1` / tinta `#8A1410`
- Sidebar: fundo `#0A0A0A`, ativo `#161616` com borda esquerda `#D6A64B`

## Tipografia
- Oswald (`600`, letter-spacing `.04em–.22em`): H1, labels técnicos, números, badges, stepper, etapa, sidebar brand, topbar
- Inter: corpo de texto, descrições, sublinha de KPIs e timeline

## Estrutura obrigatória
1. **Header cliente-centric** — `RAFAEL, ESSES SÃO SEUS PROCESSOS` (H1 Oswald 26px) + meta `CPF · MEMBRO DESDE · N PROCESSOS ATIVOS`. Nunca usar "Bem vindo de volta".
2. **FOCO DO DIA · AÇÃO BLOQUEANTE** — card branco com borda esquerda `#D9342B`, label vermelho Oswald, título 15px, CTA bordô `ASSINAR AGORA →`.
3. **6 KPIs humanos** — grid de 6 colunas: COM VOCÊ / COM EQUIPE / NA PF / CONCLUÍDOS / PAGO ANO / DOC VENCENDO. Dot colorido + label Oswald + valor 26px Oswald + sub 10.5px.
4. **Cards de Processo** — header com badge de status + protocolo PF à direita. Body em `proc-grid` (170px + 1fr):
   - Esquerda: `PROGRESSO` + número 54px Oswald com `%` 20px + barra 6px colorida pelo status + Etapa atual (Oswald) + previsão de conclusão + métrica temporal.
   - Direita: stepper de 5 etapas (✓ verde · número âmbar atual · cinza pendente) + LINHA DO TEMPO vertical à esquerda e CHECKLIST · ETAPA ATUAL à direita (linhas `#F7F7F7` com badge). Banner "Próximo passo automático" em fundo âmbar `#FCEFCE` quando aplicável.
   - Para cards menores (pendente assinatura / Na PF): substituir stepper detalhado por barra horizontal de 5 segmentos coloridos.

## Regras
- Nunca mudar tokens para hsl/tailwind tokens. Usar HEX explícito conforme acima — é a referência visual única.
- Sidebar do portal mantém estrutura preto + ativo com borda âmbar. Item ativo: bordô `#7A1F2B` no badge de contagem.
- Todo card respeita `border-radius: 4px`, borda `#E5E5E5`, fundo branco, header 14/18px padding.
- Labels técnicas SEMPRE UPPERCASE com `letter-spacing` Oswald.
- Não adicionar dark mode, gradientes ou sombras pesadas. Sombra só `shadow-sm` discreta.
- Implementação React: `src/components/quero-armas/cockpit-z6/CockpitZ6MeusProcessos.tsx` (template base reutilizável).
