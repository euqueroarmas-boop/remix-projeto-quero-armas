# Project Memory

## Core
Toda foto de armamento no Arsenal (Quero Armas) DEVE entrar com fundo 100% transparente real. Proibido fundo branco, cinza ou padrão xadrez impresso. Aplicar máscara de limpeza (brightness>170 && saturation<25 → alpha=0) antes de subir ao bucket `qa-armamentos`. Manter todas as gravações de fábrica.

## Memories
- [Arsenal weapon image policy](mem://features/quero-armas/arsenal-weapon-image-policy) — Regra absoluta de fundo transparente, limpeza de pixels residuais, gravações de fábrica e enquadramento por tipo de arma.
- [QA Doc Center Baseline](mem://features/quero-armas/document-center-baseline) — CONGELADO: 8 certidões granulares, dispensado_grupo, validação IA, holerite atual/antigo, auditoria imutável. Não alterar sem autorização.- [P0 Senha GOV Postmortem](mem://tech/security/p0-incident-postmortem) — Reconciliação P0 + UNIQUE(cliente_ativo) + revelação manual obrigatória, sempre filtrar consolidado_em IS NULL
