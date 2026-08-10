# Campo de RG: pedir só o RG (sem CIN) e mover a explicação

## O que muda para o cliente

Na tela do checklist guiado que hoje pergunta "Qual é o número do seu RG ou CIN?":

- O título passa a ser **"Qual o número do seu RG?"**
- O rótulo do campo deixa de ser "RG / CIN" e passa a ser **"RG"**
- Some o texto de ajuda sobre CIN/CNH no Gov.br e some o botão "Entrar no Gov.br"
- A tela fica com **apenas o pedido e o campo para digitar**

Motivo registrado: a Polícia Federal exige o RG para cadastro e para algumas certidões de antecedentes; a CIN não substitui o RG até 2032.

## Onde a explicação passa a viver

A orientação de como obter a versão digital do RG entra **somente na etapa de grupo "Identificação Civil"** do checklist guiado (a tela de abertura do grupo, não a tela do campo). Texto orientado por estado:

- Instrução geral: acessar o site do governo do seu estado para obter/consultar o RG digital.
- Regra específica de São Paulo (usada quando a UF do emissor/endereço for SP): baixar o app **RG Digital São Paulo** e escanear o QR Code do RG físico para gerar a versão digital.
- Para os demais estados: texto genérico apontando para o portal do governo estadual, sem citar CIN/CNH.

## Detalhes técnicos

- `src/lib/quero-armas/cadastroCompleteness.ts`, campo `rg`: `label` → "RG", `pergunta` → "Qual o número do seu RG?", remover `ajuda` e `links`.
- Adicionar a orientação estadual no cabeçalho do grupo `identidade` do checklist guiado (`PendenciasGuiadasPopup`), com variação por UF (SP x demais), sem alterar o layout compacto já aprovado.
- Nenhuma mudança de dados ou validação: o campo continua o mesmo `rg`.
