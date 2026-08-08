---
name: Ciclo do comprovante de consumo
description: Validade do comprovante de endereço sai da próxima leitura (não da emissão da NF-e) e a recusa afirma o mês de referência a enviar
type: feature
---
Regra canônica global (todos os clientes do Arsenal), implementada em
`src/lib/quero-armas/cicloComprovanteConsumo.ts`:

1. Validade do comprovante de endereço (conta de consumo): `data_proxima_leitura`
   → `data_vencimento` → `data_emissao + 30 dias`. NUNCA emissão da NF-e + 1 mês.
2. Reprovação por vencido não especula: proibido dizer "existe uma emissão mais
   recente". A mensagem afirma o mês: "Envie a conta com mês de referência JULHO/2026".
3. Mês exigido a partir do dia da leitura D e da data de hoje T:
   `dia(T) >= D` → mês seguinte ao de T; `dia(T) < D` → mês de T.
4. Borda de fim de mês: D é limitado ao último dia do mês corrente (D=31 em
   fevereiro vira 28/29).
