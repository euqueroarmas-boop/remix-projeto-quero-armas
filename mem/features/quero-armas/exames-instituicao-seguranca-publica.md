---
name: Exames da instituição (segurança pública)
description: Ramificação do checklist para servidor de segurança pública usar laudo psicológico e de tiro da própria instituição
type: feature
---
Base legal: Portaria Conjunta COLOG/C Ex e DPA/PF nº 1, de 29/11/2024, art. 3º, II.

- Condição profissional `seguranca_publica` recebe a pergunta pivot `exames_instituicao` (`exames_instituicao_definir`) antes do laudo psicológico.
- Resposta `sim` → exige `atestado_aptidao_psicologica_instituicao` e `atestado_capacidade_tecnica_instituicao` (exige_quando) e DISPENSA `laudo_psicologico` / `laudo_capacidade_tecnica` via `regra_validacao.dispensa_quando`.
- `dispensa_quando` é regra genérica do motor: item some quando TODAS as chaves casam. Implementado em `checklistGuiadoEngine.itemVisivelGuia`, `_shared/checklistVisibility.ts` e `simuladorChecklist.ts`.
- Textos do cliente vêm SEMPRE da Biblioteca de Documentos (`descricao_como_enviar`). Proibido texto hardcoded no simulador (ex.: "VALE QUALQUER UM"). Identidade funcional NÃO é intercambiável com CNH/RG/CIN.
