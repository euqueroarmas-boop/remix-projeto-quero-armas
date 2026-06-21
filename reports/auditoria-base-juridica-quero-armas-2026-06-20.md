# Auditoria de Base Juridica Quero Armas - 2026-06-20

## Escopo

Auditoria estatica do sistema Quero Armas para verificar aderencia textual e funcional a:

- Lei nº 10.826/2003.
- Decreto nº 11.615/2023.
- Decreto nº 12.345/2024.
- Instrucao Normativa nº 201/2021-DG/PF.
- Instrucao Normativa DG/PF nº 311/2025.
- Instrucao Normativa DG/PF nº 322/2025.
- Portaria DG/PF nº 19.040/2025.
- Portarias COLOG nº 166, 167 e 260.
- Oficio Circular nº 08/DELEARM.

## Fontes oficiais consultadas

- Policia Federal - Armas: https://www.gov.br/pf/pt-br/assuntos/armas
- Policia Federal - Legislacao: https://www.gov.br/pf/pt-br/assuntos/armas/normativos/legislacao
- Gov.br - Solicitar aquisicao de arma de fogo: https://www.gov.br/pt-br/servicos/adquirir-arma-de-fogo
- Gov.br - Solicitar porte de arma de fogo para defesa pessoal: https://www.gov.br/pt-br/servicos/obter-porte-de-arma-de-fogo
- Gov.br - Obter CR CAC: https://www.gov.br/pt-br/servicos/conceder-certificado-de-registro-de-pessoa-fisica-2013-cacador-excepcional-atirador-desportivo-e-colecionador-cac

## Achados normativos confirmados

1. A propria pagina de Armas da PF separa os servicos em dois blocos: Sinarm - Defesa Pessoal e Sinarm - CAC.
2. A pagina de legislacao da PF estava atualizada em 17/03/2026 e lista:
   - Lei nº 10.826/2003.
   - Decreto nº 11.615/2023.
   - Decreto nº 12.345/2024.
   - IN DG/PF nº 311/2025.
   - IN DG/PF nº 322/2025, que altera a IN DG/PF nº 311/2025.
   - Portaria DG/PF nº 19.040/2025, sobre cronograma de servicos CAC no ambito da PF.
   - IN nº 201/2021-DG/PF para Sinarm, aquisicao, registro, posse, porte, cadastro e comercializacao.
3. A pagina de aquisicao de arma de fogo lista como documentos comuns: requerimento, identidade/CPF, certidoes criminais, comprovante de ocupacao licita, comprovante de residencia, laudo psicologico, comprovante de capacidade tecnica e taxa.
4. A pagina de porte para defesa pessoal reforca laudo psicologico, capacidade tecnica, certidoes, comprovantes e regras de uso do porte.
5. A pagina de CR CAC confirma requisitos como laudo psicologico, capacidade tecnica, taxa, filiacao a entidade quando aplicavel, compromisso de habitualidade do atirador e acompanhamento pelo Sinarm-CAC.

## Oficios Circulares

Foi pesquisado por combinacoes de:

- "Oficio Circular" + "DELEARM" + "defesa pessoal".
- "Oficio Circular" + "DELEARM" + "CAC".
- "Oficio Circular" + "SINARM-CAC".
- "Oficio Circular" + "porte de arma" + "Policia Federal".

Resultado: nao foi localizada fonte publica oficial indexada confirmando outros Oficios Circulares DELEARM especificamente relacionados a defesa pessoal ou CAC alem do Oficio Circular nº 08/DELEARM informado pelo usuario. Por prudencia, nenhum oficio adicional foi adicionado ao sistema sem fonte oficial confirmavel.

## Superficies auditadas no codigo

- `src/lib/quero-armas/serviceLegalDetails.ts`: base legal e requisitos por servico.
- `src/pages/HomePage.tsx`: textos comerciais e cards normativos, apenas como superficie auditada.
- `supabase/functions/qa-generate-contract/index.ts`: geracao do contrato pago.
- `supabase/migrations/*qa_contract_template*`: template contratual e anexos por slug.
- `src/lib/quero-armas/documentosHubCatalogo.ts`, `etapa02Checklist.ts` e fluxos de checklist: aderencia documental geral.

## Correcoes aplicadas

1. Criada base juridica central em `src/lib/quero-armas/legalBasis.ts`.
2. `serviceLegalDetails.ts` passou a usar a base centralizada para:
   - Sinarm/Defesa Pessoal.
   - Sinarm-CAC.
   - cursos/manuseio.
3. A HomePage foi preservada com o texto comercial aprovado pelo produto. A IN DG/PF 311 continua referenciada ali como norma valida.
4. Criada migration complementar para atualizar o template contratual vigente com:
   - IN DG/PF 201/2021.
   - IN DG/PF 311/2025.
   - IN DG/PF 322/2025.
   - Portaria DG/PF 19.040/2025.
   - Portarias COLOG 166/167/260.
   - Oficio Circular 08/DELEARM.

## Pontos que ainda merecem revisao humana

1. As Portarias COLOG 166, 167 e 260 foram incorporadas por determinacao do usuario, mas nao foram localizadas nesta rodada em fonte publica oficial indexada com o mesmo grau de confirmacao obtido na pagina de legislacao da PF.
2. O Oficio Circular nº 08/DELEARM foi incorporado por determinacao do usuario; recomenda-se anexar uma copia/URL oficial interna ao repositorio documental do projeto, se houver.
3. O sistema ainda contem textos editoriais agressivos na Home por decisao de produto. Eles nao foram alterados nesta auditoria.
4. Checklist e documentos obrigatorios parecem aderentes aos servicos Gov.br principais, mas uma matriz completa item-a-item por tipo de servico deve ser feita antes de tratar como auditoria juridica final.

## Conclusao

O sistema ficou melhor alinhado a base juridica vigente e ao modelo oficial PF de separacao entre Sinarm - Defesa Pessoal e Sinarm-CAC. A principal correcao tecnica foi centralizar a base juridica para contrato e detalhes tecnicos dos servicos, preservando a HomePage conforme texto comercial aprovado. A principal pendencia e documental: guardar fonte oficial ou copia controlada das Portarias COLOG 166/167/260 e do Oficio Circular 08/DELEARM para auditoria futura.
