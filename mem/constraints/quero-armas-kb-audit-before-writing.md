---
name: QA - Auditoria obrigatória antes da Base de Conhecimento
description: Artigos e passo a passo da Base Quero Armas só podem ser escritos após auditoria do checklist, da base e do procedimento real testado.
type: constraint
---
Na Base de Conhecimento Quero Armas, a IA só pode escrever/revisar artigo depois de auditoria completa:

1. checklist auditado;
2. base de conhecimento conferida;
3. procedimento real testado;
4. liberação explícita para escrita;
5. print/imagem real auditável anexado e aprovado antes de aprovar/publicar.

Estados esperados:
- `audit_pending`: ainda não pode gerar passo a passo;
- `needs_real_image`: texto pode estar pronto, mas falta evidência real;
- `needs_review`: pronto para revisão humana;
- `audited`/`published`: somente com auditoria completa + imagem real aprovada.

É proibido gerar passo a passo antes da auditoria. É proibido usar imagem IA/genérica como validação.

**Why:** a Base deve documentar comportamento real validado, não suposição gerada antes de auditar o sistema.