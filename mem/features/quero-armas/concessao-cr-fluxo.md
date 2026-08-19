---
name: Concessão de CR — fluxo canônico (Sinarm-CAC)
description: Processo completo do CR de atirador (serviço 44), confirmado pelo titular em 19/08/2026 e pelos 4 dossiês deferidos. O protocolo é da EQUIPE; o cliente fornece a senha GOV e paga o boleto.
type: feature
---

# Concessão de CR — fluxo canônico

Confirmado pelo titular em 19/08/2026 e conferido contra 4 dossiês deferidos
(Rivelino, Wellington, Augusto, Fabrício). Base legal: IN DG/PF 311/2025,
art. 18, § 2º.

## Fatos que não podem regredir

- **Um só serviço à venda**: `concessao-cr` (servico_id 44), R$ 1.239,
  `modalidade_cac = 'atirador'`. Colecionador e caçador NÃO são vendidos; as
  exigências deles ficam cadastradas e condicionadas à modalidade, dormindo.
- **A modalidade vem da COMPRA** (gatilho `qa_trg_processo_modalidade_do_catalogo`
  carimba `qa_processos.modalidade` no nascimento). Não é pergunta ao cliente.
- **O Sinarm-CAC é um site dentro da gestão da PF, mas o CR deferido sai em
  nome do EXÉRCITO.** Bagunçado, porém é assim — não "corrigir".
- **Quem protocola é a EQUIPE, com a senha GOV do cliente.** O cliente fornece
  a senha, acompanha e paga o boleto. Não existe roteiro de requerimento para
  o cliente operar (diferente da posse/Sinarm).
- **NÃO existe juntada final assinada no CR.** Os documentos entram em campos
  individuais no Sinarm-CAC; cada DECLARAÇÃO é assinada no gov.br
  separadamente, com verificação da cadeia de certificados na entrega
  (`regra_validacao.assinatura_requerida = 'govbr'` nas 7 declarações).
- **DEGA é sempre exigida** (endereço principal da guarda). Sobre o 2º
  endereço, SEMPRE sai uma declaração: positiva
  (`declaracao_guarda_acervo_2enderecos`) ou negativa
  (`declaracao_nao_possuir_segundo_endereco`) — nunca "nada".
- **CR vale 3 anos** (IN 311 art. 17; `qa_validade_documentos.cr` = 36 meses).
- Prazo para responder correção apontada pelo órgão: **30 dias corridos**
  (art. 76) — diferente dos 10 da posse; motor de prazos ainda usa 10
  (pendência registrada).

## As etapas

1. **Contratação** — compra + contrato + pagamento → processo nasce carimbado
   `atirador`.
2. **Instrução documental** (portal, popup guiado) — identificação, endereço
   (atual + 5 anos via `qa_seed_endereco_5_anos`), ocupação lícita por
   condição, idoneidade (4 justiças; federal em 2 abrangências), filiação +
   compromisso de habitualidade, DSA + DEGA + declaração do 2º endereço,
   laudos (psicólogo e instrutor credenciados PF), senha GOV.
3. **Conferência final** pela equipe.
4. **Protocolo no Sinarm-CAC** (equipe, com a senha GOV): cadastra o cliente →
   entrega os documentos campo a campo → sistema libera o boleto (GRU) →
   equipe envia ao cliente → cliente paga → compensação bancária →
   **"Pronto para análise"** (primeiro status no órgão; = protocolado).
5. **Análise** — fica assim até: exigência (grupo `exigencias_pf`, na frente de
   tudo), deferimento (CR sai em nome do Exército; fluxo de deferimento
   existente) ou indeferimento (recurso).
6. **Vida do CR** — 3 anos; habitualidade 8 eventos/12 meses por tipo de arma
   (IN 311 arts. 71-75, monitorada no Arsenal); renovação é o serviço 32.

## Grupo Requerimento do checklist (ordem canônica)

`credencial_gov_br` (499, cliente) → `requerimento_cr` (500, quero_armas) →
`gru` (501, quero_armas) → `gru_comprovante` (502, cliente). Sem juntada.

## Migrations da série

`20260819030000` (checklist IN 311) · `040000` (modalidade da compra) ·
`050000` (atirador) · `060000` (nome explícito + backfill) · `070000`
(completa processos abertos) · `080000` (DEGA sempre + 2º endereço declarado) ·
`090000` (DECORE na Biblioteca, sem exigência) · `100000` (protocolo pela
equipe, sem juntada, assinaturas govbr).
