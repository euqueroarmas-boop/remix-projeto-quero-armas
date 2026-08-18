# Pacote jurídico — entrada do programador

Atualizado em 18/08/2026. Estes são **rascunhos de trabalho**, feitos para você
levar prontos ao advogado, não para substituí-lo. Os pontos que exigem
advogado obrigatoriamente estão marcados com ⚠️ ao longo dos arquivos.

---

## A regra que vale acima de todas

**Nenhum acesso antes de assinatura.** Nem swagger, nem repositório, nem
schema do banco, nem print de tela do painel. O swagger é a planta baixa do
sistema: lista todos os endpoints, os parâmetros de cada um e o formato dos
dados. Quem tem o swagger tem o mapa para reconstruir o sistema.

Hoje ele não assinou nada. Enquanto isso for verdade, o que você entregar
está juridicamente desprotegido — e pior, deixa de ser "segredo de negócio"
aos olhos da lei, porque segredo só é segredo se você o tratou como tal
(art. 195, XI e XII da Lei 9.279/96).

---

## Quem contrata: WMTi, não Quero Armas

Isto não é detalhe, é a espinha do arranjo.

- Quem desenvolve software é a **WMTi** (está no CNAE dela).
- O Arsenal Inteligente foi escrito pela WMTi.
- A **Quero Armas** (CNPJ 34.316.002/0001-06) usa o produto.
- A WMTi é quem vai para os Estados Unidos.

Logo: **o programador é contratado pela WMTi.** Se ele for contratado pela
Quero Armas, três coisas quebram de uma vez — a titularidade do código fica
confusa, a ida para os EUA perde o lastro (o visto L-1 exige que ele tenha
sido empregado da empresa que se transfere), e a futura S.A. trava na due
diligence.

⚠️ Existe um buraco no histórico: a "cooperação" entre WMTi e Quero Armas
nunca foi para o papel. Hoje, se alguém perguntar "de quem é o Arsenal
Inteligente?", a resposta está só na sua cabeça. O documento 07 fecha isso, e
fecha de forma retroativa.

---

## Os documentos, na ordem de assinatura

| # | Documento | Quando | Para quê |
|---|---|---|---|
| 01 | NDA / Confidencialidade | **Hoje, antes de qualquer acesso** | Ele poder ver o sistema sem poder usar, copiar ou contar |
| 06 | Declaração de não conflito com o emprego atual | Junto com o 01 | Impedir que o patrão dele reivindique o código |
| 02 | Prestação de serviços + cessão de propriedade intelectual | Antes do primeiro commit | Tudo que ele criar nasce seu |
| 05 | Anexo de acessos e segurança | Junto com o 02 | Quem tem chave de quê, e em que fase |
| 03 | Term sheet da participação (1 página, linguagem simples) | Antes de falar número de novo | Alinhar o "1%" antes que vire briga |
| 04 | Contrato de opção de compra de quotas (vesting) | Depois que o 03 for aceito | Ele vira sócio ao longo do tempo, não de uma vez |
| 07 | Contrato WMTi ↔ Quero Armas | Assim que der | Limpar a titularidade do produto |
| 08 | Checklist INPI e proteção | Em paralelo | Marca, registro do software, segredo |

Os documentos 01, 02, 05 e 06 são **defesa**: valem mesmo que a sociedade
nunca aconteça. Os documentos 03 e 04 são **sociedade**: só fazem sentido
depois que a defesa está de pé. Não inverta a ordem.

---

## O que está indefinido e precisa de você

Preencha antes de mandar para o advogado. Os campos aparecem como `[[...]]`
nos arquivos.

1. Nome completo, CPF, RG e endereço do programador.
2. Ele tem PJ/MEI? Razão social e CNPJ, se tiver.
3. Razão social e endereço completos da WMTi (CNPJ já registrado: 13.366.668/0001-07).
4. Endereço completo da Quero Armas.
5. O percentual da participação — e **sobre o quê** (ver documento 03).
6. Se vai haver pagamento mensal e de quanto (ver o alerta no documento 02).
7. Cidade/estado do foro.
