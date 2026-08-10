# Diagnóstico dos 8 pontos + correções

Tudo abaixo foi conferido no banco e no código antes de escrever. Onde não deu para confirmar 100%, está marcado como "a confirmar" e vira o primeiro passo da correção.

## O que está acontecendo

**1. Psicólogos no raio de 25 km não apareceram (print 1)**
O bloco "Escolher profissional credenciado" só aparece quando o passo é reconhecido como laudo particular (`tipoCredenciado`). O passo do Anthony hoje está gravado como `laudo_psicologico` mas com metadado de PERGUNTA (`tipo: pergunta`, `chave: ja_fez_exame_psicologico`), então o pop-up trata a exigência como outra coisa e não monta o botão de busca — sobra só o texto "use o botão de busca", sem botão. O CEP dele está cadastrado (08.775-395 / MOGI DAS CRUZES / SP) e o motor de busca funciona; o problema é o passo, não a geolocalização. (Qual dos dois caminhos o item toma: a confirmar no primeiro passo da correção.)

**2. Resposta do cliente virou "pergunta em análise pela equipe" (print 3)**
Mesma causa raiz: a linha `laudo_psicologico` (documento) carrega `regra_validacao.tipo = 'pergunta'`. Quando o cliente respondeu, o sistema registrou "documento recebido — em análise" para uma pergunta. É contaminação de metadado no `qa_processo_documentos`.

**3. "Próximo passo" sobrepondo (print 3)**
Na tabela, a célula usa `truncate` dentro de um flex sem `min-w-0`/`overflow-hidden`, então o texto longo transborda por cima da coluna ABERTO EM. É só CSS.

**4. Condição profissional dos 6 clientes não bate com o que responderam**
As tags (DEFESA PESSOAL, MILITAR, APOSENTADO...) vêm de `trilhaChecklist.ts`, que **infere** a trilha pelos tipos de documento materializados, e só usa a resposta canônica quando ela existe em `respostas_questionario_json`. Hoje:
- `condicao_profissional` não é gravada nas respostas de vários processos (o Pedro Lobato ainda tem "Defina sua condição profissional" como próximo passo, mas já aparece com APOSENTADO por inferência);
- "MILITAR" está vindo de `antecedentes_militar_estadual`, que o motor materializa para quase todo mundo — mesmo dispensado/reaproveitado em alguns casos.
Resultado: rótulo inferido ≠ resposta do cliente.

**5. Anthony aparece em EFETIVA NECESSIDADE e não em LAUDOS**
No banco a linha `comprovante_efetiva_necessidade` continua `pendente`, mesmo com 3 boletins anexados, narrativa gerada e `aprovado_cliente = true`. O painel admin ordena por grupo (efetiva = 80, laudos = 90) e para no primeiro pendente; a área do cliente conta os 11 passos e já considera a efetiva resolvida. Duas leituras, duas verdades — a linha do documento nunca é fechada quando o cliente aprova a narrativa.

**6. "17 DISP./REAP." sem ninguém dispensado**
O número é `dispensados + reaproveitados`. No Anthony: 7 `dispensado_grupo` (caminhos condicionais que ele não seguiu — imóvel de terceiro, perguntas de endereço) + 11 `dispensado_por_reaproveitamento` (documentos aproveitados do histórico). Nada disso é dispensa legal — o rótulo é que está errado e mistura duas coisas.

**7. Efetiva necessidade fora dos documentos gerenciáveis / sem prazo de BO**
As provas da efetiva ficam em `qa_efetiva_necessidade_provas` e nunca são espelhadas em `qa_documentos_cliente`. Por isso o grupo não aparece no hub, não recebe validade/prazo dos BOs (6 meses) e não entra na contagem de vencimentos.

**8. Resumo (print 5) não reflete a página de documentos (print 4)**
A página lista 14 documentos, 4 a vencer em 30 dias, comprovante em 10 dias. O resumo mostra "DOCUMENTOS 0" nas abas e "Nenhum documento crítico". O card DOCUMENTOS (14) usa uma fonte; os chips das abas e o banner usam a lista de `urgents`, que está vindo vazia. Causa exata a confirmar: filtro de família (versões antigas do comprovante sendo tratadas como histórico) ou data de validade nula no item principal.

## Correções propostas

### Área do cliente
1. Limpar o metadado contaminado: `laudo_psicologico` e `laudo_capacidade_tecnica` voltam a ser documento (sem `tipo: pergunta`), com `grupo_checklist = laudos`. Backfill em todos os processos.
2. Reconhecer o passo de laudo particular pelo tipo do catálogo (não por texto solto), garantindo o botão "Escolher profissional credenciado" com raio 25 km a partir do CEP.
3. `atestado_aptidao_psicologica_instituicao` e `atestado_capacidade_tecnica_instituicao` recebem `exige_quando: {exames_instituicao: "sim"}` e grupo `laudos` — quem respondeu "não" deixa de vê-los como pendência.
4. Fechar a efetiva necessidade: quando o cliente aprova a narrativa e o conjunto de BOs é suficiente, a linha `comprovante_efetiva_necessidade` passa a cumprida.
5. Espelhar as provas da efetiva (BO, inquérito, ação) no hub de documentos, com prazo de 6 meses do BO, para entrarem em vencimentos e no ZIP.
6. Resumo x Documentos: usar a MESMA fonte e a mesma janela (30 dias) para card, chips das abas e banner de próximo vencimento.

### Admin
7. Coluna PRÓXIMO PASSO com `min-w-0` + `overflow-hidden` — fim da sobreposição.
8. Separar o indicador hoje unificado em dois chips: "REAPROVEITADOS" (histórico) e "NÃO SE APLICA" (caminho não escolhido). "DISPENSADO POR LEI" fica reservado para dispensa real por categoria.
9. Trilha do cliente passa a priorizar a resposta gravada (`condicao_profissional` / `categoria_titular`); inferência só quando não houver resposta, e "MILITAR" só quando a linha estiver viva (não dispensada/reaproveitada).
10. Etapa atual do painel passa a considerar a efetiva concluída pelos mesmos critérios da área do cliente — Anthony some de EFETIVA NECESSIDADE e aparece em LAUDOS.

## Detalhes técnicos
- Migração de dados em `qa_processo_documentos` (limpeza de `regra_validacao` dos laudos + `exige_quando` dos atestados institucionais).
- Ajuste em `qa-processo-responder-pergunta` / `qa-processo-set-condicao` para gravar sempre a condição em `respostas_questionario_json`.
- `qa_painel_progresso_clientes()`: separar `dispensados` de `nao_aplicavel`, e fechar `efetiva_necessidade` pelo mesmo cálculo de `ef_calc`.
- Front: `PendenciasGuiadasPopup.tsx`, `DashboardProgressoClientes.tsx`, `trilhaChecklist.ts`, `ClienteResumoKanban.tsx`.
