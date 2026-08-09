---
name: Texto para registro de BO (Efetiva Necessidade)
description: Após gerar o relato, o sistema também produz um texto de até 500 caracteres para o cliente registrar boletim de ocorrência, com histórico de fatos novos e guia por UF
type: feature
---
Regra do usuário (09/08/2026). Mesmo com "tenho BO = sim", o BO existente costuma não cobrir os fatos narrados (é antigo, é outro fato, ou surgiram fatos novos). Por isso, ao clicar em "Gerar meu relato" o sistema entrega **dois textos**:

1. **Relato em primeira pessoa** (já existente) — base da defesa perante a PF.
2. **Texto para registrar BO** (`qa_efetiva_necessidade.texto_bo`) — MÁXIMO 500 caracteres, primeira pessoa, linguagem simples e humana, nunca com cara de IA/advogado. Formaliza situação fática de risco atual e prestes a se consumar (medo, pânico, temor pela própria vida ou de terceiros), comunicada à delegacia para providências. PROIBIDO citar lei, pedir deferimento, mencionar arma/porte/posse/PF/este sistema.

**Fatos novos:** botão abre campo; cada acréscimo vira linha em `qa_efetiva_necessidade_acrescimos` (ordem, origem). Nada é sobrescrito. Ao refazer, a IA recebe relato + provas + todos os acréscimos em ordem e reescreve **somando** (proibido descartar fatos). `versao` incrementa.

**Salvamento final:** o dossiê assinado (`qa-efetiva-aprovar`) inclui respostas, provas, acréscimos, relato aprovado E o texto de BO. O e-mail ao cliente também traz o texto de BO e os links.

**Guia de abertura de BO:** tabela `qa_bo_links_uf` (uf, nome_orgao, url_abrir, url_acompanhar, observacao), lida pela UF do cliente. SP já cadastrado (delegacia eletrônica da Polícia Civil SP: comunicar-ocorrencia / acompanhar-andamento). Para acompanhar: número do protocolo ou do BO, ano do registro e CPF do declarante. Sem UF cadastrada, orientação genérica.

**Pendência:** cadastrar os links de abertura e acompanhamento de BO das demais unidades federativas em `qa_bo_links_uf`.
