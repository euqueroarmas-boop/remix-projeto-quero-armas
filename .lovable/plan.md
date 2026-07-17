
# Piloto Real Quero Armas — Contratação Assistida pela Equipe

## Diagnóstico do que já existe (nada será duplicado)

Mapeei o fluxo real e ele já é 100% coberto por Edge Functions oficiais. O que falta é uma **tela admin única** que orquestre esses passos com um cliente real, sem `INSERT`/`UPDATE` manual no banco.

Peças oficiais reutilizadas (sem reescrever):

| Etapa | Função / RPC oficial | Uso |
|---|---|---|
| Criar venda + itens | `qa-checkout-criar-venda` | Mesma origem do checkout público |
| Gerar cobrança Asaas (opcional) | `qa-venda-gerar-cobranca` | Se equipe quiser boleto/pix real |
| Aprovar valor da venda | RPC `qa_venda_aprovar_valor` | Já usada em `QAVendasPendentesPage` |
| Confirmar pagamento manual | Edge `qa-processo-confirmar-pagamento` → RPC `qa_confirmar_pagamento_processo(p_origem='manual_admin')` | Já existe e grava evento |
| Gerar contrato | `qa-generate-contract` | Fluxo oficial |
| Assinatura da empresa | `qa-sign-contract-company` | Oficial |
| Upload do assinado pelo cliente | `qa-upload-signed-contract` → encadeia `qa-validate-customer-signature` | Oficial |
| Liberação operacional | `qa-liberar-servicos-contrato` | Cria `qa_solicitacoes_servico`, `qa_processos`, checklist via `qa_explodir_checklist_processo` |
| Processo/checklist | `qa-processo-criar` + `qa_explodir_checklist_processo` | Disparado pela liberação |
| Hub Documental | `qa-processo-doc-upload` + `qa-processo-doc-validar-ia` | Cliente testa no portal |

**Conclusão:** não precisa criar RPC nova nem duplicar lógica. Precisa de **um wizard admin** que chame essas funções na ordem certa, exija comprovante/justificativa no passo de pagamento manual e registre auditoria.

## O que será construído

### 1. Nova rota admin `/quero-armas/admin/piloto-real`
Wizard de 6 passos, cada passo chama a função oficial correspondente e não avança até receber sucesso. Nenhum passo grava direto na tabela; tudo passa por RPC/Edge.

```text
┌─ 1. Cliente ─────────┐   busca em qa_clientes por CPF/nome/email
├─ 2. Serviço ─────────┤   seleciona de qa_servicos_catalogo
├─ 3. Criar venda ─────┤   invoke qa-checkout-criar-venda (identificação = cliente real)
├─ 4. Pagamento ───────┤   escolhe: (a) gerar cobrança Asaas real  OU
│                      │           (b) marcar manual pago + comprovante
│                      │   caminho (b) → invoke qa-processo-confirmar-pagamento
├─ 5. Contrato ────────┤   qa-generate-contract → qa-sign-contract-company
│                      │   → equipe cola link para cliente assinar / faz upload
│                      │   qa-upload-signed-contract em nome do cliente
├─ 6. Liberação ───────┤   qa-liberar-servicos-contrato (idempotente)
│                      │   mostra processo/checklist criados
└──────────────────────┘
```

Estados intermediários ficam persistidos: se a equipe fechar o navegador, o wizard reabre no passo correto lendo `qa_vendas.status`, `qa_contracts.status`, `qa_processos.id`.

### 2. Comprovante obrigatório no pagamento manual
Novo campo no wizard (passo 4b):
- upload de PDF/JPG → `storage.upload` no bucket `paid-contracts` sob `qa/manual-payments/<venda_id>/comprovante.<ext>`;
- observação textual obrigatória (mín. 20 chars);
- só depois habilita o botão que chama `qa-processo-confirmar-pagamento`;
- evento `qa_venda_eventos.tipo_evento='pagamento_manual_confirmado'` gravado com `metadata.comprovante_path` e `metadata.observacao` (via RPC já existente `qa_venda_evento_registrar`, sem SQL solto).

Se a RPC de evento não aceitar metadados livres, adiciono uma migration pequena que só amplia a coluna JSONB (nenhuma mudança de regra).

### 3. Cancelamento sem apagar histórico
Botão "Arquivar piloto" no topo do wizard:
- venda: RPC `qa_venda_reprovar_valor` com motivo "piloto_cancelado";
- contrato: `qa_contracts.status='cancelled'` via função oficial `qa-generate-contract` modo cancel (já existe);
- processo: `qa-processo-set-condicao` com condição `arquivado_piloto`.
Nada é deletado; tudo vira evento.

### 4. Checklist operacional impresso na tela
Aba lateral fixa "Checklist do Piloto" com os 10 passos do enunciado marcados verde/amarelo/vermelho em tempo real conforme os estados reais das tabelas.

## Segurança e conformidade

- Rota protegida por `requireQAStaff` no frontend (perfil ativo em `qa_usuarios_perfis`).
- Cada chamada Edge já valida JWT staff no backend — sem service_role no cliente.
- Auditoria: todas as ações caem em `qa_venda_eventos`, `qa_contract_events`, `qa_processo_eventos`, `qa_logs_auditoria` (já disparados pelas funções oficiais).
- Base normativa: o fluxo respeita Lei 10.826/03, Dec. 11.615/23, Dec. 12.345/24 e IN 201/311 porque **usa as mesmas funções do fluxo real de produção** — nenhum atalho.

## Detalhes técnicos

Arquivos novos:
- `src/pages/quero-armas/admin/QAPilotoRealPage.tsx` (wizard principal)
- `src/components/quero-armas/admin/piloto/PassoCliente.tsx`
- `src/components/quero-armas/admin/piloto/PassoServico.tsx`
- `src/components/quero-armas/admin/piloto/PassoVenda.tsx`
- `src/components/quero-armas/admin/piloto/PassoPagamento.tsx` (com upload de comprovante)
- `src/components/quero-armas/admin/piloto/PassoContrato.tsx`
- `src/components/quero-armas/admin/piloto/PassoLiberacao.tsx`
- `src/components/quero-armas/admin/piloto/ChecklistPilotoSidebar.tsx`
- `src/hooks/queroArmas/usePilotoRealState.ts` (hidrata estado real das tabelas)

Arquivos alterados:
- `src/App.tsx` — adiciona rota `/quero-armas/admin/piloto-real` protegida.
- `src/components/quero-armas/portal/QASidebarAdmin*.tsx` — item de menu "Piloto Real".

Sem migrations obrigatórias. Se surgir necessidade do `metadata` de comprovante, uma migration mínima adicionando coluna JSONB em `qa_venda_eventos` (se ainda não tiver) — só coluna, sem alterar policies.

Validação final: `bun run typecheck` + smoke test manual no preview navegando o wizard com um cliente real de teste.

## Critérios de aceite (mapeados 1-a-1 do pedido)

- [x] Cliente real escolhido em `qa_clientes` (passo 1).
- [x] Venda criada por `qa-checkout-criar-venda` (passo 3).
- [x] Pagamento manual exige comprovante + observação, grava evento (passo 4b).
- [x] Contrato gerado/assinado/anexado pelas funções oficiais (passo 5).
- [x] Liberação via `qa-liberar-servicos-contrato` só depois de contrato `validated` (passo 6).
- [x] Processo/checklist nasce automaticamente pela cadeia oficial.
- [x] Nenhum status crítico alterado por `UPDATE` manual solto.
- [x] Cancelamento por arquivamento com evento, sem apagar.
- [x] Auditoria completa em `qa_*_eventos`.
