# Efetiva Necessidade dentro do pop-up guiado (sem modal separado)

Hoje, ao tocar em "Iniciar efetiva necessidade", o portal fecha o pop-up guiado e abre **outro** modal por cima, com trilha, contador e Anterior/Próximo próprios. O cliente sai do checklist, os 7 passos não entram na contagem "17 de 22 concluídos" e nada disso é gerenciável pelo motor de pendências.

A mudança: os passos da Efetiva Necessidade passam a ser **itens da própria fila do pop-up guiado**. Nada abre por cima; o conteúdo do pop-up é substituído pelo passo atual da efetiva.

## Como fica

- O grupo "Efetiva necessidade" deixa de ser 1 item e vira **7 itens na fila** do checklist guiado: boletim de ocorrência, inquérito policial, ação criminal, ameaça atual, seu relato, rotina de risco, revisão e geração.
- Cada passo usa o próprio esqueleto do pop-up: chip do grupo, "Passo X de N", cabeçalho, corpo rolável, rodapé com Anterior/Próximo e o X bordô no canto.
- Os passos já respondidos aparecem como **concluídos** e somam na contagem do processo e do grupo ("Neste grupo — Efetiva necessidade — 4 de 7 itens concluídos"), como qualquer documento.
- Navegação livre pela fila: dá para voltar a um passo já resolvido e corrigir.
- Fechar o pop-up (X) mantém o comportamento atual — tudo já foi salvo; ao reabrir, a fila cai no primeiro passo pendente da efetiva.
- O passo 7 (revisão) traz o "Gerar meu relato" e, depois de gerado, o relato, o texto de BO e o passo a passo da delegacia — como hoje. Ao aprovar, os 7 itens ficam concluídos e a fila segue para o próximo grupo.
- O modal separado deixa de existir: o botão "Iniciar efetiva necessidade" apenas leva o pop-up guiado ao primeiro passo da efetiva.

Nenhuma regra de negócio, prompt de IA, salvamento, geração de dossiê ou tabela muda. É reorganização de interface e de fila.

## Detalhes técnicos

- `PendenciasGuiadasPopup.tsx`: `PendenciaItem` ganha um slot opcional `corpo?: React.ReactNode` e `ocultarPassosPadrao?: boolean`. Quando presente, o corpo rolável renderiza o slot no lugar da lista de passos estáticos e dos botões padrão; header, trilha, contadores e rodapé continuam iguais. Sem `corpo`, comportamento inalterado.
- Extrair de `EfetivaNecessidadeModal.tsx` a lógica e os corpos de passo para `src/components/quero-armas/portal/efetivaNecessidade/` — um hook `useEfetivaNecessidade(processoId, clienteId)` (carregamento, respostas, provas, autosave, `gerarNarrativa`, `aprovar`) e componentes de corpo (`PassoPergunta`, `PassoTexto`, `PassoRevisao`). Sem alterar chamadas às edge functions `qa-efetiva-narrativa` / `qa-efetiva-aprovar`.
- `QAClientePortalPage.tsx`: no lugar do item único de efetiva necessidade, gerar 7 `PendenciaItem` (mesmo `grupoId`), cada um com `corpo` vindo do hook e concluído derivado de `qa_efetiva_necessidade` / `_provas`. `entregarLabel`/`onEntregar` passam a apenas fixar o `pinnedId` no primeiro passo pendente. Remover `efetivaNecessidadeProcessoId` e o `<EfetivaNecessidadeModal />`; apagar o arquivo do modal depois da extração.
- Contadores: os 7 passos entram em `resumoProcesso.grupos` do grupo efetiva necessidade, para que "concluídos/total" reflita a realidade.