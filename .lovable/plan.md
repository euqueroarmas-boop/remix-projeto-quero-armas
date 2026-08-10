# Coluna lateral esquerda até o rodapé

## O problema
A coluna esquerda hoje tem **altura fixa de 800px**. Em telas mais altas ela termina antes do fim da janela, e o que sobra abaixo é o fundo claro da página — daí o espaço em branco. A coluna direita não tem esse problema porque está ancorada em cima **e** embaixo.

## O que muda
- A coluna esquerda passa a ser ancorada do topo até o rodapé da janela, exatamente como a coluna direita.
- O papel de parede / anúncio cobre toda a altura da coluna, sem faixa clara sobrando embaixo.
- Largura permanece 200px e o layout mobile permanece intacto.

## Detalhe técnico
Em `src/pages/quero-armas/QAClientePortalPage.tsx` (linha ~3606), trocar `h-[800px] max-h-dvh` por ancoragem `bottom-0` (altura total da viewport) na `<aside>` esquerda, mantendo `w-[200px]`, o tema de fundo e o espaçador `flex-1`. Conferir que a imagem de fundo siga com `cover`/`center` para preencher a nova altura sem distorcer.