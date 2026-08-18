# PROTEÇÃO DA PROPRIEDADE INTELECTUAL — O QUE REGISTRAR, ONDE E QUANDO

> Você perguntou se precisa registrar marca e patente no INPI. Resposta curta:
> **marca sim e com urgência; software sim e é barato; patente provavelmente
> não.** Detalhe abaixo.

---

## 1. Marca — INPI — FAÇA AGORA

**Por quê é urgente:** no Brasil vale quem **registra primeiro**, não quem usa
primeiro. Se um terceiro registrar "Arsenal Inteligente" antes de você, ele
pode te obrigar a parar de usar o nome do seu próprio produto — depois de você
ter construído a marca. E marca não registrada é o primeiro problema apontado
em qualquer due diligence de S.A. ou de investidor.

**O que registrar:**

| Marca | Titular sugerido | Classes (Nice) |
|---|---|---|
| **Arsenal Inteligente** | WMTi (é a dona do produto) | 9 (software), 42 (SaaS e desenvolvimento) |
| **Quero Armas** | Quero Armas | 35 (serviços administrativos), 45 (serviços jurídicos e regulatórios) |
| **WMTi** | WMTi | 42 |

**Como:**
1. Busca de anterioridade gratuita em `busca.inpi.gov.br` — antes de qualquer
   coisa, ver se já existe marca igual ou parecida nas mesmas classes.
2. Cadastro no e-INPI, emissão da GRU e depósito online.
3. Custo aproximado por marca por classe: **R$ 355 com desconto** (ME, EPP,
   MEI, pessoa física) ou cerca de **R$ 1.000 sem desconto**. Confira a tabela
   vigente no site.
4. Prazo até a concessão: normalmente **12 a 24 meses**. Mas a **proteção
   retroage à data do depósito** — por isso depositar hoje vale mais do que
   depositar perfeito daqui a três meses.
5. Registrar também o **logotipo** (marca mista), além do nome (marca
   nominativa), se a identidade visual importa.

---

## 2. Registro de programa de computador — INPI — FAÇA TAMBÉM

**Isto muita gente não sabe que existe.** O software já é protegido por
direito autoral desde que escrito, independentemente de registro — mas o
registro no INPI é a **prova com data oficial** de que aquele código era seu
naquele dia. É exatamente a peça que você quer ter na mão se um dia precisar
provar que um ex-colaborador copiou.

- Protege por **50 anos** contados de 1º de janeiro do ano seguinte à
  publicação ou criação.
- Você **não entrega o código**: entrega um **resumo digital hash** dos
  arquivos, o que preserva o sigilo integralmente.
- Custo baixo (dezenas a poucas centenas de reais) e processo em semanas.
- **Titular: WMTi.**
- Recomendação: registrar a versão atual agora e refazer a cada versão
  relevante ou anualmente.

**Reforço barato e imediato, para hoje:** seu repositório Git já carrega
data e autoria de cada linha. Gere um hash da versão atual e guarde-o com
data — é prova adicional que custa zero.

---

## 3. Patente — provavelmente NÃO

O art. 10, inciso V, da Lei 9.279/96 é explícito: **"programa de computador em
si" não é invenção e não é patenteável no Brasil.** Só se patenteia software
quando ele faz parte de uma solução com efeito técnico concreto sobre um
processo físico — não é o caso de um sistema de gestão de processos.

Patente também é cara (dezenas de milhares de reais com escritório
especializado), leva de 4 a 8 anos e **publica sua solução para o mundo ler**.
Para o seu caso, o par certo é **segredo de negócio + direito autoral**, não
patente. Reavalie apenas se um dia houver um método técnico realmente
inventivo, e aí converse com um agente da propriedade industrial.

---

## 4. Segredo de negócio — o que você já tem e pode perder

O art. 195, XI e XII, da Lei 9.279/96 torna **crime** divulgar ou explorar
conhecimento confidencial obtido em razão de relação contratual. Mas há uma
condição: **a informação só é segredo se você a tratou como segredo.**

Traduzindo: se você mandar o swagger por WhatsApp para alguém que não assinou
nada, aquilo deixa de ser segredo protegido — e você perde a própria base
legal da reclamação. É por isso que o NDA vem antes do acesso, e não depois.

O que sustenta o segredo: NDA assinado, acesso mínimo e nominal, logs de
auditoria, marcação de confidencialidade nos documentos, inventário de quem
recebeu o quê e quando.

---

## 5. Estados Unidos — quando abrir a WMTi lá

| Item | O que fazer | Observação |
|---|---|---|
| Marca | Depósito no **USPTO**, inclusive na modalidade *intent-to-use* (1(b)), antes mesmo de operar | Nos EUA o uso no comércio também gera direito — mas o registro é o que dá força |
| Direito autoral do software | Registro no **U.S. Copyright Office** | Nos EUA, **sem registro você não consegue processar** por violação, e só com registro há direito a indenização legal e honorários |
| Contratos | Refazer NDA e cessão sob a lei do estado escolhido | Delaware é o padrão para a holding |
| Estrutura | Discutir com advogado societário e tributarista **antes** de constituir | A estrutura errada custa caro para desfazer |

---

## 6. Green card — o que dá e o que não dá para prometer

Você mencionou ao programador a possibilidade de green card. Trate esse
assunto com cuidado: **nenhuma empresa consegue garantir visto ou residência**
— quem decide é o governo americano. Prometer isso num contrato cria
obrigação que você não pode cumprir, e vira indenização se não sair.

Os caminhos que realmente existem, em resumo:

- **L-1** (transferência dentro da mesma empresa): exige que ele tenha sido
  **empregado da empresa brasileira por pelo menos 1 ano** nos últimos 3 anos,
  e que exista uma entidade americana real e operante. É visto de trabalho,
  não é green card, mas o L-1A é a porta natural para o **EB-1C**, que é green
  card. **Consequência prática: se o plano dos EUA importa, ele precisa
  começar a contar tempo de vínculo formal com a WMTi o quanto antes.**
- **O-1A** (habilidade extraordinária): possível para perfil técnico com
  reconhecimento comprovado. Exigente.
- **EB-2 NIW / EB-3**: caminhos de green card com fila e requisitos próprios.
- **E-2** (investidor): **não se aplica** — o Brasil não tem tratado E-2 com
  os Estados Unidos.

No contrato, a Cláusula 9 do documento 02 já está redigida como **intenção sem
garantia**. Mantenha assim. E não repita a promessa por mensagem — conversa de
WhatsApp vira prova.

---

## Ordem prática

| Quando | O quê | Custo aproximado |
|---|---|---|
| Hoje | Busca de anterioridade das três marcas no INPI | R$ 0 |
| Esta semana | Depósito das marcas — pelo menos "Arsenal Inteligente" | R$ 355 a R$ 1.000 por classe |
| Esta semana | Hash da versão atual do código, guardado com data | R$ 0 |
| Este mês | Registro do programa de computador no INPI | Baixo |
| Este mês | Contrato WMTi ↔ Quero Armas assinado (documento 07) | Honorários |
| Quando abrir nos EUA | USPTO + U.S. Copyright Office | A orçar |
| Só se houver invenção técnica real | Patente | Alto — reavaliar |
