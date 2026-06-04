---
name: QA Document Center Baseline
description: Baseline estável e CONGELADO da Central de Documentos do Quero Armas — não alterar sem motivo técnico claro
type: constraint
---
# Central de Documentos — Baseline Estável (Aprovado em E2E real)

Esta base foi validada via fluxo real (login cliente → upload storage → qa-processo-doc-upload → qa-processo-doc-validar-ia, confiança IA 1.00, evento auditoria + e-mail documento_aprovado). **NÃO alterar sem motivo técnico claro e autorização.**

## Pilares congelados
1. **8 certidões granulares** (não reagrupar).
2. Links específicos por certidão (sem URL crua nos botões).
3. Validação rígida por IA (`qa-processo-doc-validar-ia`).
4. Regra holerite atual vs antigo (rejeita período desatualizado com motivo específico).
5. Condição profissional dinâmica (CLT/Autônomo/etc — `qa-processo-set-condicao` recalcula checklist sem duplicar renda).
6. Grupo identificação com `dispensado_grupo` (CNH aprovada satisfaz RG/CTPS — não bloqueia processo).
7. Bloqueio pré-IA de formato incorreto (`formato_aceito` enforcement).
8. Bloqueio pré-IA de imagem baixa qualidade (<40KB) e PDF inválido (<8KB), máx 20MB.
9. Auditoria imutável em `qa_processo_eventos` (trigger `qa_processo_eventos_imutavel`).
10. E-mail por pendência específica (`qa-processo-notificar`).
11. Documentos aprovados ou `dispensado_grupo` NÃO são re-solicitados em troca de condição.
12. Reconciliação de campos vazios: `cadVazio` trata "", "none", "null", "n/a" como vazio (sem falsa divergência).

## Proibições explícitas
- Não reescrever a Central de Documentos do zero.
- Não trocar/renomear status (`em_analise`, `aprovado`, `invalido`, `dispensado_grupo`, etc).
- Não voltar a agrupar certidões.
- Não remover `dispensado_grupo`.
- Não alterar regras de validação IA sem autorização.
- Não enfraquecer enforcement pré-IA (formato/tamanho).

## Próximas fases permitidas
- Testes automatizados de regressão sobre este baseline.
- Melhoria de OCR fallback (antes da IA, sem trocar a estratégia atual Gemini Vision).
- Integração futura com WhatsApp/Meta para notificações.

## Arquivos críticos (somente hardening, nunca refactor)
- `supabase/functions/qa-processo-doc-upload/index.ts`
- `supabase/functions/qa-processo-doc-validar-ia/index.ts`
- `supabase/functions/qa-processo-set-condicao/index.ts`
- `supabase/functions/qa-processo-notificar/index.ts`
- Trigger `qa_processo_eventos_imutavel`