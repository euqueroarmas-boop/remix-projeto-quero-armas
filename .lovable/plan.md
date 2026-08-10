# Busca de psicólogos em 25 km — diagnóstico e correção

## O que já foi verificado agora

- **O motor de busca funciona.** Chamando a função de busca com o CEP do Anthony (Mogi das Cruzes/SP) e raio de 25 km, ela devolveu **10 psicólogos credenciados**, o mais próximo a **2,3 km**, com `fora_do_raio: false`.
- **A base está populada e geocodificada:** 3.879 credenciados no total, 1.609 em SP, 1.371 com coordenadas, 14 em Mogi das Cruzes.
- **O cadastro do cliente está correto:** CEP `08.775-395`, cidade MOGI DAS CRUZES, UF SP — a limpeza da máscara resulta em 8 dígitos válidos.
- **A pendência é do tipo certo:** `laudo_psicologico` (não é a variante "da instituição"), que é justamente o tipo que aciona o botão de escolha de credenciado.
- **O código do pop-up guiado já contém o bloco do botão** "Escolher profissional credenciado", que abre o modal com raio padrão de 25 km.

Ou seja: o problema **não é o raio nem os dados** — é que o botão não está chegando à tela do print. O print é do domínio publicado, e a integração do botão dentro do checklist guiado é recente. A hipótese principal — ainda não confirmada — é defasagem entre a versão publicada e o código atual, ou uma condição de renderização cortando o bloco nessa etapa.

## Passo 1 — Confirmar a causa antes de mexer em qualquer coisa

- Abrir a mesma etapa (Laudo psicológico) no preview logado e verificar se o botão aparece.
  - **Aparece no preview e não no publicado:** é defasagem de publicação — basta republicar, sem mudança de código.
  - **Não aparece nem no preview:** seguir para o passo 2.

## Passo 2 — Correção no pop-up guiado (se necessário)

- Tornar a detecção do tipo mais tolerante: hoje depende do tipo cru do item. Passar a considerar também o tipo normalizado e o nome do documento, para que qualquer variação de "laudo psicológico" e "laudo de capacidade técnica" acione o botão.
- Manter a variante "da instituição" **sem** botão (o laudo vem do órgão, não de credenciado particular).
- Colocar a observação "use o botão de busca…" dentro do mesmo bloco do botão, para não repetir a orientação sem ação disponível.

## Passo 3 — Robustez da busca

- Sem credenciado dentro de 25 km, manter o aviso "o mais perto está a X km" em vez de lista vazia.
- Sem CEP no cadastro, cair para UF/cidade em vez de não buscar nada.

## Passo 4 — Publicar

- Republicar para a área do cliente em produção ficar igual ao preview.

## Detalhes técnicos

- Arquivos envolvidos: `src/components/quero-armas/portal/PendenciasGuiadasPopup.tsx` (detecção `tipoCredenciado` e bloco do botão) e `src/components/quero-armas/clientes/AgendarExame/AgendarExameModal.tsx` (raio padrão, fallback CEP → UF/cidade).
- Função `qa-psico-credenciados-buscar` e tabela de credenciados: **sem alteração** — validadas como funcionais nesta análise.