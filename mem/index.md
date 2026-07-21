# Project Memory

## Core
**Fuso oficial: America/Sao_Paulo (BRT, UTC−03).** Toda auditoria, log exibido, timeline, e-mail e PDF deve converter timestamps para BRT antes de mostrar ao usuário. Nunca reportar UTC. Ver mem://tech/timezone-canonical.

**🚨 REGRA-MÃE QA (BLOCO 0):** Pagamento confirmado é o gatilho-mãe → ativa serviço, libera doc, cria processo, reflete em portal+equipe instantaneamente. 5 dimensões de status obrigatórias: Financeiro · Documentação · Protocolo · Decisão · Validade. KPIs refletem SITUAÇÃO REAL, nunca contagem. PROIBIDO KPI verde com problema crítico. Padrão de cores fixo: verde=ok/deferido · azul=andamento/protocolado · amarelo=vencendo · laranja=pendência/exigência · vermelho=vencido/indeferido/inválido · cinza=sem dado. PROIBIDO usar termo "admin" — sempre "Equipe Quero Armas". Ver mem://architecture/quero-armas/regra-mae-fluxo-operacional.

**🔒 CARIMBO DE SESSÃO PDF CONTRATO — CANÔNICO:** Layout do carimbo lateral de auditoria em `qa-contrato-view-public` (`buildSessionStampedPdf`) é imutável. Qualquer alteração (margens, fonte, campos, remoção, mover para client, trocar gerador) EXIGE confirmação explícita do usuário antes de editar. Ver mem://tech/security/carimbo-sessao-pdf-contrato.

Toda foto de armamento no Arsenal (Quero Armas) DEVE entrar com fundo 100% transparente real. Proibido fundo branco, cinza ou padrão xadrez impresso. Aplicar máscara de limpeza (brightness>170 && saturation<25 → alpha=0) antes de subir ao bucket `qa-armamentos`. Manter todas as gravações de fábrica.

TODAS as telas internas/operacionais/administrativas do Quero Armas seguem padrão Premium Light (fundo branco/cinza claro, cards brancos com borda suave, tipografia escura, badges elegantes, espaçamento generoso). NÃO aplicar em site público, landing públicas, página pública do Arsenal Digital Gratuito ou páginas SEO. Portal do cliente pode manter dark/tático. Ajustes apenas visuais e progressivos — nunca alterar banco/RLS/pagamentos/processos/checklist/arsenal/fotos por estética.

**PROIBIDO FUNDO PRETO em forms/inputs/textarea/dialogs do painel admin QA.** Toda página admin envolvida em `.qa-scope`. Padrão visual = tela do Arsenal de Clientes (Premium Light com letras e botões legíveis). Ver mem://style/quero-armas/no-dark-forms-rule.

**PROIBIDO EXPOR URL DO SUPABASE ao abrir documentos.** Toda visualização de arquivo (PDF, imagem) deve usar `DocumentoViewerModal` (`@/components/quero-armas/DocumentoViewerModal`) com blob interno via `URL.createObjectURL`. Nunca usar `window.open(signedUrl)`. Ver mem://constraints/no-supabase-url-leak.

**ZERO REGRESSÃO QA (regra mestra):** NUNCA apagar tabelas/colunas, renomear campos, alterar fluxos aprovados, substituir integrações existentes (send-smtp-email, Asaas) ou criar arquitetura paralela. Sempre extensão (add), nunca substituição (replace). Em dúvida → criar novo compatível. Arquitetura canônica imutável: qa_clientes (CPF=identidade) · qa_vendas (verdade financeira, status_financeiro derivado) · qa_solicitacoes_servico · qa_processos · cliente_auth_links. status_servico: montando_pasta→documentos→verificação→protocolo→órgão→resultado. E-mail SEMPRE via send-smtp-email + naoresponda@queroarmas.com.br (proibido email_send_log/pgmq/cron/App Emails). IA extrai TUDO em campos_complementares_json/metadados_documento_json — proibido descartar dados ou exigir preenchimento manual do já extraído. Ver mem://constraints/quero-armas-diretriz-global.

Base de Conhecimento QA: NUNCA gerar passo a passo antes de auditar checklist + base + procedimento real testado. Sem imagem IA/genérica; só evidência real aprovada.

**🟥 COCKPIT Z6 LIGHT (CANÔNICO PORTAL):** Toda página NOVA da área do cliente DEVE seguir o layout `Cockpit Z6 Light` — header `RAFAEL, ESSES SÃO SEUS PROCESSOS` (Oswald), banner FOCO DO DIA com borda `#D9342B`, 6 KPIs humanos, cards de processo com `proc-grid` (PROGRESSO % + stepper 5 etapas + linha do tempo + checklist). Tokens HEX explícitos: `#7A1F2B` bordô, `#D6A64B` âmbar, `#2F8F4A` verde, `#0A0A0A` tinta, sidebar dark. Oswald para labels/números, Inter para corpo. Implementação base em `src/components/quero-armas/cockpit-z6/`. Nunca regredir. Ver mem://style/quero-armas/cockpit-z6-light-canonical.

## Memories
- [🚨 REGRA-MÃE QA — BLOCO 0](mem://architecture/quero-armas/regra-mae-fluxo-operacional) — Pagamento=gatilho, 5 dimensões status (Financeiro/Doc/Protocolo/Decisão/Validade), KPIs reais, padrão de cores, escopo Arsenal, proibição do termo "admin"
- [Diretriz Global QA](mem://constraints/quero-armas-diretriz-global) — Regra permanente: zero regressão, extensão sobre substituição, arquitetura canônica preservada, infra de e-mail reutilizada, IA não perde dados
- [Arsenal weapon image policy](mem://features/quero-armas/arsenal-weapon-image-policy) — Regra absoluta de fundo transparente, limpeza de pixels residuais, gravações de fábrica e enquadramento por tipo de arma.
- [QA Doc Center Baseline](mem://features/quero-armas/document-center-baseline) — CONGELADO: 8 certidões granulares, dispensado_grupo, validação IA, holerite atual/antigo, auditoria imutável. Não alterar sem autorização.- [P0 Senha GOV Postmortem](mem://tech/security/p0-incident-postmortem) — Reconciliação P0 + UNIQUE(cliente_ativo) + revelação manual obrigatória, sempre filtrar consolidado_em IS NULL

- [Doc Approval Flow](mem://features/quero-armas/doc-approval-flow) — Fluxo bidirecional admin↔portal qa_documentos_cliente: status pendente/aprovado/reprovado, Realtime, soft-delete, query keys ['cliente-documentos', clienteId]
- [QA Admin Premium Light Mandate](mem://style/quero-armas/admin-premium-light-mandate) — Padrão branco premium obrigatório em TODAS as telas internas/autenticadas (admin, operacional E portal do cliente); exceções APENAS para site público, landing e arsenal digital público
- [QA Portal Light](mem://style/quero-armas/client-portal-light-mandate) — Portal do Cliente / Arsenal Inteligente é Premium Light. data-tactical-portal foi neutralizado em src/index.css; não recriar regras dark
- [QA Integridade Venda↔Processo](mem://features/quero-armas/integridade-venda-processo) — Bloqueia divergência Posse/Porte; qa-processo-criar valida servico_id contra qa_itens_venda + 8 testes regressão
- [AI Supervised Correction](mem://features/quero-armas/ai-supervised-correction-system) — qa_ia_correcoes_juridicas + /correcoes-ia, 3 fases (admin/captura/injeção+checagem)
- [QA No AI Images](mem://constraints/quero-armas-no-ai-images) — Imagens da Base só podem ser reais/auditáveis; geração por IA bloqueada em DB+edge+UI
- [QA KB Audit Before Writing](mem://constraints/quero-armas-kb-audit-before-writing) — Base só escreve/publica após checklist, base e procedimento auditados; exige evidência real aprovada
- [QA KB Audit Screenshots Pipeline](mem://features/quero-armas/kb-audit-screenshots-pipeline) — Workflow GitHub Actions + Playwright real loga como equipe, captura screenshot real e grava em qa_kb_artigo_imagens com image_type='auditoria_real'; nunca gera imagem
- [QA Status Color Immutability](mem://style/quero-armas/status-color-immutability) — Cores semânticas de status (verde=ativo/pago, vermelho=erro, âmbar=alerta) NUNCA podem ser alteradas em restyling de UI
- [QA Neutral Scale](mem://style/quero-armas/canonical-neutral-scale) — Escala neutra canônica Light + Dark AAA Pass; RYG só como microdots discretos
- [Cockpit Z6 Light Canônico](mem://style/quero-armas/cockpit-z6-light-canonical) — Layout canônico do portal do cliente (Meus Processos): header cliente-centric, FOCO DO DIA, 6 KPIs humanos, cards de processo com PROGRESSO + stepper + timeline + checklist. Obrigatório em toda página nova.
- [Habitualidade IN 311](mem://features/quero-armas/habitualidade-classificacao-in311) — IN 311/2025 Arts. 71-75: habitualidade por TIPO de arma (não calibre), competição conta como treino, classificação = MENOR nível comprovado entre todos os tipos do acervo, progressão exige 12 meses no nível. Base dos emails 13/14/15/16.
- [Arsenal Inteligente Logo](mem://brand/arsenal-inteligente-logo) — Arte oficial MODELO 08 (bordô #7A1F2B) canônica; sempre via `<ArsenalInteligenteLogo>`, nunca redesenhar em SVG à mão
- [QA Central Empilhada](mem://features/quero-armas/central-documentos-empilhamento) — Empilhamento por família, principal vigente, alerta suprimido, reaproveitamento consolidado, auditoria dedupe 24h
