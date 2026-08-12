# Certidão cível do TRF3 passou: o detector não conhece a redação do TRF

## O que realmente aconteceu

Não foi falta de treinamento nem falha de leitura. O PDF foi lido corretamente — o texto extraído traz, em letras garrafais, "CERTIDÃO JUDICIAL CÍVEL" e "PROCESSOS de classes CÍVEIS".

O problema é a lista de marcadores do detector de escopo (`src/lib/quero-armas/escopoCertidao.ts`). Ela reconhece as redações do TJSP e da Justiça Militar ("CERTIDÃO CÍVEL", "CARTÓRIO CÍVEL", "AÇÕES CÍVEIS"...), mas nenhuma delas casa com a redação do TRF:

- "CERTIDÃO **JUDICIAL** CÍVEL" — a palavra "JUDICIAL" no meio quebra o padrão "CERTIDÃO CÍVEL"
- "processos de **classes** CÍVEIS" — padrão não previsto

Resultado: escopo = indefinido → a trava não dispara → a certidão segue para a conferência normal, bate nome e CPF, e recebe o carimbo verde "APROVADO". Verifiquei rodando os marcadores atuais contra o texto real do PDF enviado: zero acertos, tanto na lista criminal quanto na cível.

Detalhe adicional: o rodapé do TRF contém a URL `.../CertidaoCivelEleitoralCriminal/...`. Ela hoje não é lida como "criminal" (fica colada em outras palavras), mas qualquer regra nova precisa ignorar URLs de propósito, senão toda certidão cível do TRF passará a se declarar criminal.

## Correção

1. **Ampliar os marcadores cíveis** para cobrir a família TRF e variações equivalentes:
   - "CERTIDÃO ... CÍVEL" com palavras intermediárias (JUDICIAL, NEGATIVA, DE DISTRIBUIÇÃO)
   - "CLASSES CÍVEIS", "NATUREZA CÍVEL", "MATÉRIA CÍVEL", "PROCESSOS CÍVEIS"

2. **Higienizar o texto antes de detectar**: remover URLs e códigos concatenados do texto analisado, para que nomes de rota como `CertidaoCivelEleitoralCriminal` nunca influenciem o veredicto (nem para cível nem para criminal).

3. **Título manda mais que o corpo**: quando o cabeçalho do documento (primeiras linhas) declarar explicitamente CÍVEL, esse é o escopo — mesmo que "criminal" apareça depois em observações. Hoje qualquer menção a "criminal" no corpo vence e anula a trava.

4. **Aplicar nos três pontos de entrada**, que hoje repetem a mesma lista: o motor compartilhado, a conferência do Hub e a cópia embutida na função de classificação no backend. A cópia do backend passa a usar a mesma lista, para não voltarem a divergir.

5. **Testes de regressão** com o texto real desta certidão do TRF3 (deve ser rejeitada) e com certidões criminais legítimas do TRF, TJSP, TJM/SP e STM (devem continuar aprovadas).

6. **Reprocessar o caso do Fábio**: marcar a certidão cível aprovada por engano como rejeitada, com o motivo correto, e reabrir a exigência no checklist dele.

## Detalhes técnicos

- `src/lib/quero-armas/escopoCertidao.ts`: normalizador ganha remoção de URLs/tokens colados; novos padrões cíveis; nova regra de precedência por cabeçalho.
- `supabase/functions/qa-classificar-documento-arma/index.ts` (~linha 905): substituir a regex duplicada pelo mesmo conjunto, via cópia espelhada em `supabase/functions/_shared/`.
- `src/lib/quero-armas/conferenciaCertidao.ts` e `ClienteDocsHubModal.tsx` já chamam o motor — nada muda além do comportamento.
- Novo caso em `src/lib/quero-armas/__tests__/escopoCertidaoCivel.test.ts`.
