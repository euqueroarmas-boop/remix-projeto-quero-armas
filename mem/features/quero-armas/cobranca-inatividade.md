---
name: Cobrança automática por inatividade
description: Regra global de cobrança de clientes parados no checklist (15 dias + semanal) e painel de progresso ordenável no dashboard
type: feature
---
Cliente que fica **15 dias sem enviar nenhum documento** do checklist recebe a 1ª cobrança.
A partir daí, cobrança **semanal (7 em 7 dias)** enquanto continuar parado. Qualquer envio zera o contador e encerra as cobranças.

Canais: e-mail (template `processo-parado-cobranca`) **e** central de notificações do portal (`qa_notificacoes_cliente`, categoria `inatividade_processo`). Não há popup extra.

Persistência das regras: `public.qa_config` → `inatividade_primeira_cobranca_dias` = 15, `inatividade_intervalo_dias` = 7.
Dedupe de envio: `public.qa_inatividade_cobrancas` UNIQUE (processo_id, semana_num, canal).
Rotina: Edge Function `qa-inatividade-cobranca`, cron diário 13:00 UTC (10h BRT).

Painel admin: `DashboardProgressoClientes.tsx` (dashboard), lista **todos os processos ativos**, estilo editorial minimalista (linhas, sem cards), com **todas as colunas ordenáveis**: cliente, fase, progresso (ex. 17/22), próximo documento, aberto em, cobranças, dias parado. Fonte: RPC `qa_painel_progresso_clientes()`.
Sensor de cor igual ao dos processos: verde até 6d, amarelo 7–14d, vermelho 15d+.
