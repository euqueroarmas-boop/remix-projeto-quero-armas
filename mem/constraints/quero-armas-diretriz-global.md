---
name: Diretriz Global Quero Armas — Zero Regressão
description: Regra permanente e obrigatória para qualquer alteração no sistema Quero Armas. Proíbe destruição/refatoração de fluxos validados, exige extensão sobre substituição, preserva arquitetura canônica e infra existente.
type: constraint
---

# DIRETRIZ GLOBAL — QUERO ARMAS

## 1. Princípio
Alterações devem ser **incrementais, compatíveis e sem regressão**. Nada validado pode ser destruído, removido ou refatorado estruturalmente sem autorização explícita.

## 2. Proibições absolutas (sem autorização)
- Apagar tabelas / remover colunas / renomear campos críticos
- Alterar fluxos já aprovados
- Substituir integrações existentes (SMTP, Asaas, etc.)
- Criar arquitetura paralela para algo que já existe
- Duplicar lógica já implementada
- Sobrescrever regras de negócio definidas

## 3. Fluxo obrigatório antes de mudar
1. Identificar o que já existe e funciona
2. Perguntar: "isso já existe / já está em uso?"
3. Aplicar **extensão (add)** — nunca substituição (replace)

## 4. Arquitetura canônica (NÃO ALTERAR)
- `qa_clientes` → fonte canônica do cliente (CPF = identidade)
- `qa_vendas` → verdade financeira
- `qa_solicitacoes_servico` → fluxo operacional
- `qa_processos` → execução do serviço
- `cliente_auth_links` → vínculo login ↔ cliente

## 5. E-mail (CRÍTICO)
Reutilizar SEMPRE: `send-smtp-email` + `naoresponda@queroarmas.com.br`.
PROIBIDO: criar `email_send_log`, `pgmq`, cron de envio, App Emails do Lovable, ou qualquer sistema paralelo.

## 6. Status e fluxos
- `status_financeiro` é **derivado** de `qa_vendas` — nunca atualizar diretamente
- `status_servico` segue fluxo: montando_pasta → documentos → verificação → protocolo → órgão → resultado

## 7. Checklist e documentos
Checklist é dinâmico. IA valida e extrai. PROIBIDO exigir preenchimento manual de dados já extraídos, descartar extração ou limitar IA a campos mínimos.

## 8. Dados extraídos pela IA
Tudo deve ser salvo (mesmo sem campo fixo) em `campos_complementares_json` / `metadados_documento_json`. PROIBIDO perder informação.

## 9. UI/UX
Não reintroduzir tema dark antigo. Não criar componentes desalinhados. Não alterar layouts aprovados. Apenas ajustes finos / melhorias incrementais.

## 10. REGRA DE OURO
Em dúvida entre **(A) mudar o que existe** ou **(B) criar algo novo compatível** → SEMPRE escolher **B**.

## 11. Validação final antes de concluir
- Não quebrou fluxo existente
- Não duplicou estrutura
- Não criou fonte de verdade paralela
- Não removeu comportamento anterior
