# Efetiva Necessidade — Etapa 2: texto para o cliente registrar o BO

## Como eu entendi a sua ideia

Hoje o fluxo termina no relato em primeira pessoa. O que você quer é reconhecer que **o que o cliente conta quase nunca cabe no BO que ele já tem**: ou o BO é antigo, ou trata de outro fato, ou surgiram fatos novos depois. Nesse caso, mesmo com "tenho BO = sim", falta prova do fato atual.

Então, depois de aprovar/gerar o relato, aparecem **dois textos**:

1. **Relato em primeira pessoa** (o que já existe) — base da defesa perante a PF.
2. **Texto para registrar o BO** (novo) — até 500 caracteres, linguagem simples e humana, sem cara de texto de IA. Ele formaliza uma situação de risco atual e iminente (medo, pânico, temor pela vida própria ou de terceiros), escrita como quem comunica à delegacia para que sejam tomadas as providências. Não é peça jurídica, não cita lei, não pede nada — é comunicação de fato.

Além disso: se o cliente lembrar de um fato novo, ele abre **mais um campo** e escreve. O que ele já escreveu vira **histórico**, e esse histórico entra na próxima consulta à IA, que reescreve o relato **acrescentando** os fatos novos (nunca apagando os anteriores) e gera um novo texto de BO. Isso pode repetir quantas vezes ele quiser. Quando não houver mais nada a acrescentar, **tudo é salvo junto**: respostas, provas, histórico de acréscimos, relato final e o texto do BO que ele vai levar à delegacia.

Por fim, no mesmo padrão do pop-up guiado, mostramos **como ele abre o BO** em SP (link oficial), **como acompanha o andamento** e **o que precisa ter em mãos**.

---

## O que seria construído

### 1. Segundo texto (BO) gerado junto com o relato
- A função `qa-efetiva-narrativa` passa a devolver dois blocos: `narrativa` e `texto_bo`.
- Novo trecho de prompt, separado e com regras próprias: máximo 500 caracteres, primeira pessoa, frases curtas, vocabulário comum, sem jargão jurídico, sem "outrossim/venho por meio desta", sem citar artigos, sem pedir deferimento. Estrutura: quem sou → o que aconteceu/está acontecendo → por que temo pela minha vida (ou da minha família) → estou comunicando para que sejam tomadas as providências.
- Corte rígido em 500 caracteres validado no servidor (se estourar, a IA reescreve uma vez; se ainda estourar, corta na última frase completa).

### 2. Detecção de "os fatos não batem com o BO"
- Comparação entre o que o cliente respondeu/relatou e o que foi lido das provas anexadas (datas, naturezas, trechos).
- Quando houver fato relatado sem cobertura documental (ou BO com data muito anterior), o bloco do texto de BO aparece em destaque, com o motivo em uma linha: "seu relato traz fatos que não constam no BO enviado".
- Quando o cliente não tem BO nenhum, o bloco também aparece — só que como caminho principal.

### 3. Fatos novos e histórico acumulado
- Botão "Aconteceu mais alguma coisa" abre um campo novo em branco.
- Cada acréscimo vira uma linha em uma nova tabela de histórico (texto, data, origem), nunca sobrescrevendo o anterior.
- Ao reprocessar, a IA recebe: relato original + todos os acréscimos em ordem cronológica + provas, e devolve relato reescrito **incorporando** tudo, mais um novo texto de BO.
- O relato e o texto de BO anteriores ficam versionados, para auditoria e para o admin.

### 4. Fechamento e salvamento
- "Não tenho mais nada a acrescentar" consolida: respostas, provas, histórico completo de acréscimos, relato final aprovado e o texto de BO.
- O dossiê assinado gerado no aprovar passa a incluir o texto do BO e o histórico de acréscimos.
- A aba "Efetiva Necessidade" no painel do cliente (admin) mostra os dois textos, o histórico e as versões.

### 5. Guia "como abrir o BO" (padrão pop-up guiado)
Bloco instrucional com o mesmo visual dos pop-ups guiados, exibido junto do texto do BO:
- Copiar o texto com um toque.
- **Registrar (SP):** delegacia eletrônica da Polícia Civil de SP — comunicar ocorrência.
- **Acompanhar (SP):** página de acompanhamento, avisando que precisa ter em mãos **número do protocolo ou do BO, ano do registro e CPF do declarante**.
- Aviso de que ele deve **enviar o BO de volta** ao Arsenal quando sair, e o item de prova fica marcado como "aguardando o BO novo".
- Se o cliente não for de SP, mostramos orientação genérica ("procure a delegacia eletrônica do seu estado") até termos os demais links.

### 6. Pendência registrada
Fica anotado como pendência: **reunir os links de abertura e acompanhamento de BO de todas as unidades federativas** e transformar em uma tabela de links por UF, para que o guia mostre o link certo automaticamente pelo estado do cliente.

---

## Detalhes técnicos

- **Banco:** novas colunas em `qa_efetiva_necessidade` (`texto_bo`, `texto_bo_gerado_em`, `texto_bo_editado_pelo_cliente`, `bo_pendente_registro`, `versao`); nova tabela de histórico de acréscimos (`efetiva_necessidade_id`, `texto`, `ordem`, `created_at`) com GRANTs e RLS iguais às tabelas irmãs; nova tabela de links de BO por UF (`uf`, `url_abrir`, `url_acompanhar`), populada inicialmente só com SP.
- **Edge function `qa-efetiva-narrativa`:** dois prompts em uma chamada com saída em duas seções delimitadas, mantendo `google/gemini-3.6-flash` e o mesmo tratamento de 429/402/502; passa a receber o histórico de acréscimos.
- **Front `EfetivaNecessidadeModal.tsx`:** nova sub-etapa após a narrativa com os dois cartões (relato + texto de BO), botão de copiar, campo de acréscimo, botão de reprocessar e o bloco guiado de instruções. Contador de caracteres do texto de BO com limite de 500 também na edição manual.
- **Edge function `qa-efetiva-aprovar`:** inclui texto de BO e histórico no PDF do dossiê.
- **Admin `ClienteEfetivaNecessidade.tsx`:** blocos novos para texto de BO, histórico e status de "BO novo pendente".
- Nenhuma regra existente é removida; tudo é acréscimo ao fluxo atual.
