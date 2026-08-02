---
name: Declaração do Responsável pelo Imóvel
description: Fluxo de comprovante de residência em nome de terceiro — geração, assinatura GOV.BR pelo dono do imóvel e conferência determinística
type: feature
---
Comprovante de residência em nome de outra pessoa NUNCA reprova. Fluxo:

1. `ResidenciaTerceiroModal` coleta estado civil e profissão DO DONO DO IMÓVEL (preâmbulo da declaração), a data desde quando o REQUERENTE mora no endereço e o documento de identidade do dono.
2. Ao salvar, o comprovante é APROVADO (`recomendacao: "aceitar"`) — nunca fica "em análise".
3. Abre automaticamente `DeclaracaoResponsavelImovelModal` (mesma moldura do pop-up de pendências guiadas).
4. Edge function `qa-declaracao-residencia`:
   - `acao=gerar` → PDF com texto LITERAL do modelo oficial + carimbo de sessão (`_shared/carimboConexao.ts`), registro em `qa_declaracoes_residencia`.
   - `acao=enviar_assinada` → valida PAdES/ICP-Brasil (`_shared/qaPdfSignatureValidate.ts`) e reprova se: signatário ≠ responsável (nome/CPF), assinatura anterior à geração, ou fora da cadeia ICP-Brasil/GOV.BR.
5. Espelha no Hub Documental como `declaracao_responsavel_imovel` (categoria jurídico), idempotente por declaração.

Quem assina é o DONO DO IMÓVEL via GOV.BR — igual contrato e procuração. Nunca o requerente.
