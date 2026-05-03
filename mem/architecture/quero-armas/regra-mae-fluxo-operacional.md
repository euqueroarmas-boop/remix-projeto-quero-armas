---
name: Regra-Mãe Fluxo Operacional Quero Armas
description: BLOCO 0 — Regra principal que rege TODO o sistema QA. Pagamento é o gatilho-mãe. Define 5 dimensões de status (Financeiro, Documentação, Protocolo, Decisão, Validade), regras de KPI por situação real, padrão de cores e escopo do Arsenal.
type: feature
---

# BLOCO 0 — REGRA-MÃE DO SISTEMA QUERO ARMAS

## Objetivo
Sistema deve refletir fielmente o fluxo real dos serviços: pagamento → documentação → protocolo → decisão → validade → vencimentos → alertas. Painel operacional real, sem divergência entre dados, KPIs e documentos.

## REGRA PRINCIPAL — Pagamento é o gatilho-mãe
Pagamento confirmado deve AUTOMATICAMENTE:
- Ativar o serviço
- Definir status financeiro = pago/confirmado
- Definir status operacional = aguardando_documentacao
- Liberar checklist/documentação
- Criar ou atualizar o processo
- Refletir IMEDIATAMENTE no portal do cliente E na área da Equipe Quero Armas

## 5 DIMENSÕES DE STATUS (obrigatórias)

### 1. Financeiro
`aguardando_pagamento` · `pago` · `falhou` · `cancelado` · `reembolsado`

### 2. Documentação
`aguardando_documentacao` · `documentos_pendentes` · `documentos_em_analise` · `documentos_incompletos` · `documentos_invalidos` · `documentos_aprovados` · `pronto_para_protocolo`

### 3. Protocolo
`nao_protocolado` · `protocolado` · `enviado_ao_orgao` · `em_analise_orgao` · `exigencia_emitida` · `notificado` · `cumprindo_exigencia` · `recurso_administrativo`

### 4. Decisão
`deferido` · `indeferido` · `concluido` · `arquivado` · `cancelado`

### 5. Validade/Renovação
`ok` · `vencendo_180` · `vencendo_90` · `vencendo_60` · `vencendo_30` · `vencendo_15` · `vencendo_7` · `iminente` · `vencido` · `sem_data` · `leitura_pendente`

## REGRAS DE KPI
- KPIs refletem SITUAÇÃO REAL, nunca apenas contagem
- Devem considerar: vencimentos, indeferimentos, pendências, docs inválidos, status de processo, status de leitura
- **PROIBIDO KPI verde se houver problema crítico**

## PADRÃO DE CORES (obrigatório em todo o sistema)
- 🟢 **Verde** = ok, deferido, concluído, em dia
- 🔵 **Azul** = em andamento, protocolado, em análise
- 🟡 **Amarelo** = atenção, vencendo
- 🟠 **Laranja** = pendência, exigência, incompleto
- 🔴 **Vermelho** = vencido, indeferido, inválido, falhou
- ⚪ **Cinza** = sem dados, aguardando leitura

## ESCOPO DO ARSENAL
Deve refletir: CR · CRAF · GTE · autorizações de compra · processos · documentos · exames · laudos · munições · validade de munições · vencimentos · alertas · indeferimentos · status reais.

## REGRAS GLOBAIS
- ❌ PROIBIDO usar o termo "admin" — usar sempre **"Equipe Quero Armas"**
- ❌ Não destruir estrutura existente
- ❌ Não apagar dados
- ❌ Não substituir fonte de verdade existente
- ✅ Criar nova camada de leitura ANTES de substituir lógica antiga

## OBJETIVO FINAL
Painel operacional real: qualquer cliente aberto pela Equipe mostra exatamente a situação real de tudo que ele possui.
