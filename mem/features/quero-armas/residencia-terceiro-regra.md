---
name: Residência em nome de terceiro (regra aprovada)
description: Comprovante de endereço em nome de outra pessoa NUNCA reprova por parentesco/titular — abre o fluxo de Declaração do Responsável pelo Imóvel
type: feature
---
REGRA APROVADA (01/08/2026) — não pode ser destruída por correções futuras.

Grupo de comprovação de endereço (`comprovante_residencia`, `declaracao_responsavel_imovel`, contrato de locação):
- Documento em nome de terceiro (mesmo com sobrenome de família em comum) **NÃO é rejeitado**.
- Sempre abre `ResidenciaTerceiroModal` → Declaração do Responsável pelo Imóvel (assinada no GOV.BR) + documento de identidade do responsável.
- A conformidade passa a cruzar contra o responsável pelo imóvel, não contra o interessado.
- A rejeição por **grau de parentesco** vale APENAS para nota fiscal (tomador parente no mesmo endereço) — nunca para comprovante de endereço.
- O contexto vale pelo tipo lido **ou** pela exigência aberta (`defaultTipo`), pois a leitura pode rotular a conta como declaração.
- Tipos do mesmo grupo de endereço não contam como "documento incorreto" quando a exigência é comprovante de residência.
