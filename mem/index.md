# Project Memory

## Core
Toda foto de armamento no Arsenal (Quero Armas) DEVE entrar com fundo 100% transparente real. Proibido fundo branco, cinza ou padrão xadrez impresso. Aplicar máscara de limpeza (brightness>170 && saturation<25 → alpha=0) antes de subir ao bucket `qa-armamentos`. Manter todas as gravações de fábrica.

TODAS as telas internas/operacionais/administrativas do Quero Armas seguem padrão Premium Light (fundo branco/cinza claro, cards brancos com borda suave, tipografia escura, badges elegantes, espaçamento generoso). NÃO aplicar em site público, landing públicas, página pública do Arsenal Digital Gratuito ou páginas SEO. Portal do cliente pode manter dark/tático. Ajustes apenas visuais e progressivos — nunca alterar banco/RLS/pagamentos/processos/checklist/arsenal/fotos por estética.

## Memories
- [Arsenal weapon image policy](mem://features/quero-armas/arsenal-weapon-image-policy) — Regra absoluta de fundo transparente, limpeza de pixels residuais, gravações de fábrica e enquadramento por tipo de arma.
- [QA Doc Center Baseline](mem://features/quero-armas/document-center-baseline) — CONGELADO: 8 certidões granulares, dispensado_grupo, validação IA, holerite atual/antigo, auditoria imutável. Não alterar sem autorização.- [P0 Senha GOV Postmortem](mem://tech/security/p0-incident-postmortem) — Reconciliação P0 + UNIQUE(cliente_ativo) + revelação manual obrigatória, sempre filtrar consolidado_em IS NULL

- [Doc Approval Flow](mem://features/quero-armas/doc-approval-flow) — Fluxo bidirecional admin↔portal qa_documentos_cliente: status pendente/aprovado/reprovado, Realtime, soft-delete, query keys ['cliente-documentos', clienteId]
- [QA Admin Premium Light Mandate](mem://style/quero-armas/admin-premium-light-mandate) — Padrão branco premium obrigatório em todas as telas admin/operacionais do QA; exceções para site público e portal do cliente
