---
name: Naturalidade — fonte de verdade canônica
description: Só documentos que declaram o local de nascimento servem de referência de naturalidade; certidões (TSE/TJSP/TRF/STM) e CNH nunca
type: feature
---
Naturalidade = LOCAL DE NASCIMENTO. Regra canônica para TODOS os clientes:

- Lista BRANCA de referência: `cin`, `rg_com_cpf`, `certidao_nascimento`, `certidao_casamento`, `passaporte`, `certidao_alteracao_nome`.
- NUNCA servem de referência: CNH (traz local de EMISSÃO), comprovante de residência e qualquer certidão de antecedentes (TSE traz DOMICÍLIO ELEITORAL; TJSP/TRF/STM/TJM trazem comarca/seção judiciária). Foi o que produzia o falso "Divergência: Faxinal (PR) x JACAREI/SP".
- Fallback: `qa_clientes.naturalidade_municipio` (Central de Adesão), tier 1.5.
- Implementado em `calcularConformidade` (`ClienteDocsHubModal.tsx`).
