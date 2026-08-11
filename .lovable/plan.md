# Rejeição só por dado realmente divergente + leitura de APTO/INAPTO

## O que está errado (verificado)

**1. Rejeição por campo que o documento não traz.**
No laudo do Anthony a leitura devolveu a data de nascimento como o texto `(não consta)`. O motor de conformidade só pula o campo quando ele vem **vazio** — texto qualquer é tratado como valor lido, comparado com `04/08/1981` do cadastro e marcado como divergência, o que reprovou o laudo. Expressões como "não consta", "não informado", "n/a", "ilegível", "—" precisam valer como ausência.

**2. Resultado apto/inapto não é lido.**
O classificador de IA devolve o campo `resultado_laudo` ("apto"/"inapto"), mas a conferência do laudo lê `laudo_aptidao` (nome antigo) — então o resultado chega sempre vazio e o laudo é salvo sem registrar se o cliente foi considerado APTO ou INAPTO.

**3. Por que a mesma psicóloga entrou duas vezes na lista de não localizados.**
As duas linhas existem no banco: `THAÍS DA SILVA MARQUES` (com acento, CRP `06/163074`, endereço da clínica, cliente Anthony) e `THAIS DA SILVA MARQUES` (sem acento, CRP `CRP/06 163074`, cidade do cliente — Mogi das Cruzes — e sem cliente vinculado). Causas somadas:
- a checagem de duplicidade compara o nome sem ignorar acento, então "THAIS" não encontrou "THAÍS" e criou linha nova;
- o registro é gravado como veio no documento (`CRP/06 163074` x `CRP 06/163074`), sem normalizar;
- a linha nova grava a **cidade do cliente**, não a cidade da clínica que está no laudo, e não grava endereço nem nome do cliente.

## Área do cliente

- Nenhum campo é exigido do cliente por ausência no documento. Só há rejeição quando o dado está **declarado no cadastro** e o documento traz um valor diferente de verdade.
- Campo ausente aparece como "não consta no documento" em cinza, com status "sem referência", e não bloqueia o SALVAR.
- Laudo passa a mostrar o resultado lido: chip **APTO** (verde) ou **INAPTO** (bordô). INAPTO continua sendo rejeição — é resultado real do exame, não falha de leitura.

## Admin

- Card/coluna de profissionais não localizados deixa de duplicar a mesma pessoa: comparação por nome sem acento + registro normalizado (só os dígitos), somando a ocorrência na linha existente.
- A linha passa a guardar endereço e cidade/UF **da clínica lidos no laudo** (endereço do cliente só como último recurso) e sempre o nome do cliente e o documento de origem.
- As duas linhas da Thaís são consolidadas em uma só, com o endereço completo e o cliente vinculado.

## Detalhes técnicos

- `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx`
  - novo `valorAusente()` (não consta / não informado / não declarado / n/a / nd / — / ilegível / ***) aplicado antes de qualquer `pushItem` e reforçado dentro dele;
  - `pushItem` permanece "sem referência" quando o cadastro não declara o dado, agora explícito e coberto por teste;
  - conferência de laudo passa a aceitar `resultado_laudo` / `laudo_aptidao` / `tiro_conclusao` / `resultado`, normalizando para `apto` | `inapto`;
  - gravação em `qa_psico_nao_localizados`: dedupe por nome sem acento + registro só com dígitos, endereço/cidade/UF da clínica, `cliente_nome`, `qa_cliente_id` e `documento_id` sempre preenchidos.
- Limpeza de dados: mesclar as duas linhas da Thaís (mantém a completa, soma ocorrências, apaga a duplicada).
- Teste unitário de `calcularConformidade` cobrindo "(não consta)" e a leitura de apto/inapto.