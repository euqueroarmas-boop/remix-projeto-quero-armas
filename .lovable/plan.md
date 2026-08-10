# Tela "Exames da instituição": respiro, tipografia e passo a passo real

## O que muda para o cliente

Hoje essa etapa do checklist guiado mostra o título grudado nas badges de status, com fonte maior que o título principal, e dois passos genéricos ("Envie o documento solicitado…" / "A IA valida integridade…") que não ensinam nada sobre como conseguir o laudo na própria instituição.

### 1. Respiro e tipografia
- Espaço extra entre a linha de badges (LAUDOS · GRUPO 7 DE 8 / EXIGÊNCIA DO PROCESSO / 5 PENDÊNCIAS) e o título da exigência, e entre o título e o primeiro passo numerado.
- O título da exigência passa a ter o mesmo tamanho do título principal do pop-up (18px / 20px em telas maiores), em vez do tamanho 22px que hoje o deixa maior que o H1. No modo página (ícone da granada) nada muda — aquele layout está travado.

### 2. Texto do título, específico e não genérico
Novo texto, deixando claro que os dois caminhos valem:

"Você trabalha na Segurança Pública (SSP, Polícia Militar, Polícia Civil, Guarda Civil Municipal). Você pode escolher: usar os laudos emitidos pela sua própria instituição OU fazer os exames com credenciados da Polícia Federal. Nosso sistema aceita e valida os dois."

### 3. Passo a passo de como conseguir o laudo pela instituição
Passos que aparecem na tela quando o cliente é de segurança pública:

1. Confirme com o setor de Recursos Humanos / Departamento de Pessoal da sua corporação quem emite o atestado de aptidão psicológica e o de capacidade técnica (tiro) — normalmente o serviço de psicologia e o estande/instrução de tiro da própria corporação.
2. Protocole o pedido interno (memorando, SEI, ofício ou sistema interno da corporação) informando que o atestado é para processo de aquisição/posse de arma de fogo junto à Polícia Federal.
3. Faça a avaliação psicológica com o psicólogo da corporação e o teste de tiro com o instrutor da corporação, se ainda não tiver os resultados vigentes.
4. Peça que cada atestado saia em papel timbrado da instituição, com data, nome completo, CPF, matrícula, finalidade (aquisição/posse de arma de fogo) e assinatura do responsável com registro profissional (CRP no psicológico) — assinatura digital ICP-Brasil ou gov.br quando disponível.
5. Baixe os dois atestados em PDF original (nada de foto de tela ou reimpressão) e envie aqui pelo botão "Entregar documento".
6. Se a sua corporação não emitir, responda "NÃO" na pergunta abaixo: mostramos os psicólogos e instrutores credenciados pela PF mais próximos de você.

Observação em destaque: a Guarda Civil Municipal e demais órgãos de segurança pública cumprem o mesmo checklist do cidadão comum — a única diferença é poder apresentar esses dois laudos emitidos pela própria instituição. Base: Portaria Conjunta COLOG/C Ex e DPA/PF nº 1, de 29/11/2024, art. 3º, II.

### 4. Resposta e escolha do profissional no mesmo pop-up
- A pergunta SIM / NÃO continua sendo respondida dentro deste mesmo pop-up guiado — nada de tela nova só para decidir.
- Respondendo **SIM**: o pop-up passa a pedir os dois atestados da instituição, com o passo a passo acima.
- Respondendo **NÃO**: aparece, logo abaixo dos botões, um bloco de destaque com o botão "ESCOLHER PROFISSIONAL CREDENCIADO", que abre o pop-up de credenciados já existente — a mesma lista de psicólogos e instrutores de tiro credenciados pela PF, ordenada pelos mais próximos do CEP do cliente. Ao fechar, o cliente volta ao checklist guiado no ponto em que estava.
- O botão continua disponível nas pendências de laudo psicológico e de laudo de capacidade técnica, para o cliente reabrir a lista quando quiser.

## Detalhes técnicos

- `src/components/quero-armas/portal/PendenciasGuiadasPopup.tsx`: no modo pop-up, o `<h2>` do título deixa de usar `qa-h1` (22px) e passa a usar a mesma escala do `<h1>` do header (`text-[18px] sm:text-[20px]`, Oswald 700). Aumenta o `margin-top` do separador/título e o `padding-top` do bloco de passos. Modo `asPage` permanece exatamente como está (layout travado).
- Conteúdo: migração atualizando as linhas `exames_instituicao_definir` de `qa_servicos_documentos` (todos os `servico_id` que possuem a pergunta) preenchendo `nome_documento` (novo título), `instrucoes` (os 6 passos, um por linha) e `observacoes_cliente` (observação GCM + base legal). O pop-up já consome `instrucoes`/`observacoes_cliente` do catálogo quando não há registro estático, então o texto passa a ser editável pelo admin — sem hardcode no front.
- Escolha do profissional: reaproveita `src/components/quero-armas/clientes/AgendarExame/AgendarExameModal.tsx` (o mesmo componente usado hoje no resumo/kanban e na rota `/area-do-cliente/agendar-exame`, alimentado por `qa_psico_credenciados`). O `PendenciasGuiadasPopup` renderiza o botão quando `perguntaChave === "exames_instituicao"` com resposta `nao`, ou quando a pendência atual é `laudo_psicologico` / `laudo_capacidade_tecnica`, abrindo o modal por cima sem fechar o guiado.
- Nenhuma mudança na lógica do motor: `exige_quando`/`dispensa_quando` de `exames_instituicao` continuam iguais; os dois caminhos (instituição e credenciado PF) já são reconhecidos.
