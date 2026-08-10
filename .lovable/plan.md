# Mais área útil no checklist guiado (pop-up)

O pop-up hoje gasta a maior parte da tela com cabeçalho e rodapé fixos, e o conteúdo que o cliente realmente precisa ler e responder fica espremido numa janelinha. O objetivo é devolver espaço ao meio sem tirar nenhuma informação.

Escopo: apenas o **modo pop-up** do checklist guiado. O modo página (ícone da granada) está com layout travado e não será tocado.

## Cabeçalho — mais enxuto

- Reduzir a saudação: título de 22px para 18px (20px em telas maiores), entrelinha mais fechada e menos respiro acima e abaixo.
- Ícone do canto esquerdo menor (32px para 26px) e kicker "CHECKLIST GUIADO" em corpo menor, colado ao título.
- As três tarjas (grupo, "exigência do processo", "N pendências") passam a uma única linha compacta, com altura menor e sem quebrar em duas fileiras no celular.
- Remover o espaçamento duplicado entre título, linha divisória e o subtítulo da etapa.
- Mantido: nome do cliente, nome do grupo, posição do grupo no processo, contagem de pendências e a zona reservada do botão de fechar (X).

## Rodapé — uma faixa em vez de um bloco

- O bloco "Resolva um por vez" vira uma faixa de duas linhas: a primeira com "Resolva um por vez" + "X de Y concluídos"; a segunda juntando, em texto único e curto, o que falta no processo, o andamento do grupo atual e os documentos reaproveitados.
- Textos com corpo menor e menos padding vertical.
- Botões Anterior/Próximo com altura um pouco menor e menos respiro em volta, mantendo área de toque confortável no celular.
- Mantido: todos os números e o aviso verde de documentos reconhecidos do histórico.

## Área de trabalho

- O ganho de altura (estimado 120 a 160px no celular) vai todo para a região rolável do meio, onde ficam a explicação, a linha do tempo de passos, os campos de texto e os botões Sim/Não.
- Campos de texto longos (relato, BO) ganham altura mínima maior, já que sobra espaço.

## Detalhes técnicos

- Arquivo único: `src/components/quero-armas/portal/PendenciasGuiadasPopup.tsx`, nos ramos onde `asPage === false`.
- Nenhuma mudança de lógica, dados, contagem de passos ou regras de agrupamento — só densidade visual (tamanhos de fonte, padding, gap).
- Preservadas as regras já congeladas: zona do botão de fechar (X), tamanho fixo do modal (42rem x 90dvh) com rolagem interna, e o layout do modo página.