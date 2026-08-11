# Por que o checklist do Anthony voltou a pedir a condição profissional

## O que foi confirmado nos dados

- O processo do Anthony (`dd62ffd7…`, serviço 60) **já tem** `condicao_profissional = seguranca_publica`, gravado em 10/08 às 11:52 (evento `condicao_profissional_definida`).
- Às **22:01:00** de 10/08 o motor de explosão de checklist rodou de novo e registrou: `Checklist explodido: 1 ins, 24 exist … (cond=seguranca_publica)`. Esse **1 inserido** é exatamente o item `renda_definir_condicao` — recriado com status `pendente` no mesmo instante.
- Motivo: quando o cliente responde a condição, a função de gravação **apaga** o item `renda_definir_condicao`. Mas o explodidor de checklist recria qualquer item do catálogo que não exista no processo, e esse placeholder está no catálogo sem vínculo de condição. Como havia sido apagado, o explodidor o entende como "faltando" e insere de novo. A resposta real vive em outro campo (`qa_processos.condicao_profissional`), que o explodidor não consulta.
- Sobre o dashboard: ele **está** refletindo. Consultando o painel agora, o Anthony aparece em `OCUPAÇÃO LÍCITA · grupo 3 de 7`, próximo passo "Defina sua condição profissional". O print mostrava LAUDOS porque o painel **carrega os dados uma única vez ao abrir a tela** — não há atualização automática nem tempo real. A tela estava aberta desde antes das 22:01.

## O que corrigir

### 1. Impedir a ressurreição da pergunta (causa raiz)

No motor `qa_explodir_checklist_processo`: nunca recriar o placeholder `renda_definir_condicao` quando o processo já tiver condição profissional preenchida. Mesma regra para qualquer item de pergunta cuja resposta já esteja registrada — o explodidor passa a ignorar perguntas já respondidas em vez de reinseri-las como pendentes.

### 2. Limpeza retroativa

Remover os placeholders `renda_definir_condicao` pendentes de todos os processos que já têm condição definida (hoje: o do Anthony e quaisquer outros no mesmo estado), registrando evento de auditoria no processo.

### 3. Dashboard atualizando sozinho

No painel de progresso dos clientes:
- Recarregar automaticamente a cada 60 segundos e ao voltar o foco para a aba.
- Escuta em tempo real de `qa_processo_documentos` e `qa_processos`, disparando novo carregamento quando algo muda.
- Indicador discreto de "atualizado às HH:MM" com botão de recarregar manual, ao lado do título.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(...)` — no CTE `desejados`, excluir `tipo_documento = 'renda_definir_condicao'` quando a condição do processo estiver definida, e excluir itens `regra_validacao->>'tipo' = 'pergunta'` cuja `chave` já tenha valor em `qa_processos.respostas_questionario_json` ou na coluna dedicada.
- Limpeza de dados via comando de dados (não migração): `DELETE` dos placeholders pendentes + `INSERT` em `qa_processo_eventos`.
- `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx`: extrair o `useEffect` de carga para uma função `carregar()` reutilizável; adicionar `setInterval` de 60s, listener de `visibilitychange` e canal realtime com limpeza no unmount.