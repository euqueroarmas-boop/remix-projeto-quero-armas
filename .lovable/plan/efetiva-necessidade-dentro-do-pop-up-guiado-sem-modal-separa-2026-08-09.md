# Efetiva Necessidade dentro do pop-up guiado (sem modal separado)

Hoje, ao tocar em "Iniciar efetiva necessidade", o portal fecha o pop-up guiado e abre **outro** modal por cima, com trilha, contador e Anterior/Próximo próprios. O cliente sai do checklist, os passos não entram na contagem "17 de 22 concluídos" e nada disso é gerenciável pelo motor de pendências. Pior: o registro do BO na delegacia e a volta do BO deferido não existem como passo — hoje é só um bloco de instruções no fim da tela, sem cobrança e sem retorno.

A mudança: os passos da Efetiva Necessidade passam a ser **itens da própria fila do pop-up guiado**. Nada abre por cima; o conteúdo do pop-up é substituído pelo passo atual da efetiva.

## Como fica

- O grupo "Efetiva necessidade" deixa de ser 1 item e vira **10 itens na fila** do checklist guiado:
  1. Boletim de ocorrência (pergunta + anexo)
  2. Inquérito policial (pergunta + anexo)
  3. Ação criminal (pergunta + anexo)
  4. Ameaça atual
  5. Seu relato
  6. Rotina de risco
  7. Geração do relato e do texto do BO — a IA escreve os dois; o cliente lê, ajusta e copia o texto de até 500 caracteres
  8. **Registrar o BO na delegacia** — passo a passo e link oficial da Polícia Civil do estado do cliente (SP já cadastrado), com o texto pronto para copiar, o que ter em mãos e o aviso de acompanhar o andamento pelo e-mail/protocolo
  9. **Enviar o BO deferido** — upload do BO novo assim que sair; o passo fica pendente até o arquivo chegar, com lembrete de acompanhamento
  10. **Defesa final** — com o BO lido (número, data, natureza, delegacia), a IA reescreve o relato em primeira pessoa **somando** os dados do BO ao que já existia; o cliente lê, aprova e só então vai para o processo
- Cada passo usa o próprio esqueleto do pop-up: chip do grupo, "Passo X de N", cabeçalho, corpo rolável, rodapé com Anterior/Próximo e o X bordô no canto.
- Os passos já respondidos aparecem como **concluídos** e somam na contagem do processo e do grupo ("Neste grupo — Efetiva necessidade — 4 de 10 itens concluídos"), como qualquer documento.
- Navegação livre pela fila: dá para voltar a um passo já resolvido e corrigir.
- Fechar o pop-up (X) mantém o comportamento atual — tudo já foi salvo; ao reabrir, a fila cai no primeiro passo pendente da efetiva.
- Enquanto o BO deferido não voltar, o passo 9 permanece pendente na fila e no contador — é uma cobrança de verdade, igual a um documento faltante, e o cliente é lembrado do prazo. Se ele não for registrar BO nenhum (já tem BO que cobre os fatos), um "Não vou registrar BO" pula os passos 8 e 9 e leva direto à defesa final.
- Só depois da aprovação do passo 10 o grupo inteiro fecha e a fila segue para o próximo grupo.
- O modal separado deixa de existir: o botão "Iniciar efetiva necessidade" apenas leva o pop-up guiado ao primeiro passo da efetiva.

Nenhuma regra de negócio, prompt de IA, salvamento, geração de dossiê ou tabela muda. É reorganização de interface e de fila.

## Detalhes técnicos

- `PendenciasGuiadasPopup.tsx`: `PendenciaItem` ganha um slot opcional `corpo?: React.ReactNode` e `ocultarPassosPadrao?: boolean`. Quando presente, o corpo rolável renderiza o slot no lugar da lista de passos estáticos e dos botões padrão; header, trilha, contadores e rodapé continuam iguais. Sem `corpo`, comportamento inalterado.
- Extrair de `EfetivaNecessidadeModal.tsx` a lógica e os corpos de passo para `src/components/quero-armas/portal/efetivaNecessidade/` — um hook `useEfetivaNecessidade(processoId, clienteId)` (carregamento, respostas, provas, autosave, `gerarNarrativa`, `aprovar`) e componentes de corpo (`PassoPergunta`, `PassoTexto`, `PassoRevisao`). Sem alterar chamadas às edge functions `qa-efetiva-narrativa` / `qa-efetiva-aprovar`.
- `QAClientePortalPage.tsx`: no lugar do item único de efetiva necessidade, gerar os 10 `PendenciaItem` (mesmo `grupoId`), cada um com `corpo` vindo do hook e concluído derivado de `qa_efetiva_necessidade` / `_provas`. `entregarLabel`/`onEntregar` passam a apenas fixar o `pinnedId` no primeiro passo pendente. Remover `efetivaNecessidadeProcessoId` e o `<EfetivaNecessidadeModal />`; apagar o arquivo do modal depois da extração.
- Passos 8 e 9: reaproveitam o que já existe — `qa_bo_links_uf` (link de abrir/acompanhar por UF) e a flag `bo_pendente_registro` em `qa_efetiva_necessidade`. O passo 9 grava o arquivo como uma prova `boletim_ocorrencia` em `qa_efetiva_necessidade_provas`, passando pelo mesmo parser/leitura das demais provas; ao chegar a prova, `bo_pendente_registro` volta a false e o passo 10 é liberado.
- Passo 10: chama `qa-efetiva-narrativa` novamente com relato + provas (incluindo o BO novo lido) + acréscimos, incrementando `versao` — a mesma regra de "somar, nunca descartar" já implantada. A aprovação continua em `qa-efetiva-aprovar` (dossiê assinado + e-mail).
- Contadores: os 10 passos entram em `resumoProcesso.grupos` do grupo efetiva necessidade, para que "concluídos/total" reflita a realidade.
- Sem mudança de banco: as colunas e tabelas necessárias (`texto_bo`, `bo_pendente_registro`, `versao`, `qa_bo_links_uf`, `_provas`, `_acrescimos`) já existem. Continua pendente apenas cadastrar os links das demais UFs.