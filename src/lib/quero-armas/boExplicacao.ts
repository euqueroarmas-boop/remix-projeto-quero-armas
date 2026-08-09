// ============================================================================
// boExplicacao — o que o cliente precisa entender ANTES de ir à delegacia.
//
// Regra do usuário (09/08/2026): antes de pedir o boletim, o sistema tem de
// explicar o que é (e o que não é) um BO — do jeito que ele explica no
// atendimento. E, no fim, o cliente marca ciência: o boletim é dele, feito por
// ele, com fatos que ele declara. A Quero Armas orienta; não registra e não
// responde pelo conteúdo declarado.
//
// Fonte ÚNICA do texto: a tela do portal, o termo de ciência e o comprovante
// de auditoria leem daqui. Mudou a redação? Sobe a versão.
// ============================================================================

export const TERMO_BO_CODIGO = "bo_efetiva_necessidade";
export const TERMO_BO_VERSAO = "v2-2026-08-09";
export const TERMO_BO_TITULO =
  "Ciência sobre o registro do boletim de ocorrência";

export interface BlocoExplicacao {
  titulo: string;
  texto: string;
  destaque?: boolean;
}

export const BLOCOS_EXPLICACAO_BO: BlocoExplicacao[] = [
  {
    titulo: "O boletim não envolve a outra pessoa",
    texto:
      "Registrar um boletim de ocorrência é comunicar à autoridade policial que você teme pela sua segurança ou pela da sua família. Só isso. A pessoa citada não é intimada, não é investigada e não sofre nada por causa do boletim.",
  },
  {
    titulo: "Representar é o passo seguinte — e é opcional",
    texto:
      "No rodapé do boletim consta que você tem prazo para representar. Representar é pedir à delegacia que investigue aquela pessoa; é a representação que instaura o inquérito. É por isso que se diz que “a polícia não faz nada”: sem representação, ela não pode agir. Você decide se vai representar ou não.",
    destaque: true,
  },
  {
    titulo: "Por que o boletim protege você",
    texto:
      "O boletim registra hoje, com data e diante de uma autoridade, que você está sob ameaça. Se um dia você precisar se defender, a investigação encontra esse registro anterior. É o que sustenta a legítima defesa do art. 25 do Código Penal: repelir injusta agressão, atual ou iminente, a direito seu ou de outrem, usando meios moderados. E ameaça é crime (art. 147 do Código Penal): o caminho legal contra ela é o boletim e a representação — nunca a arma.",
  },
  {
    titulo: "Envie todos os boletins que você tiver, mesmo os antigos",
    texto:
      "Boletim antigo não é boletim inútil: ele prova reiteração — que isso não é um episódio isolado, e sim uma sequência que vem se repetindo. Cada registro anterior soma. Por isso queremos todos, um por um, sem exceção.",
  },
  {
    titulo: "Boletim com menos de seis meses",
    texto:
      "Está dentro do prazo legal de representação e sustenta a ameaça atual. Nesse caso usamos o registro que você já tem e não pedimos nenhum boletim novo.",
  },
  {
    titulo: "Boletim com mais de seis meses",
    texto:
      "Continua valendo como histórico. Ele sustenta o seu pedido quando existe mais de um registro, ou quando o que você conta no seu relato tem correlação com aquele boletim e inclui fato recente, próximo da data de hoje. Aí o relato traz o fato atual e o boletim anterior comprova que o problema já vem de antes.",
  },
  {
    titulo: "Quando pedimos um registro novo",
    texto:
      "Só quando não há nada recente: um único boletim antigo e nenhum fato novo no seu relato. Nessa situação o registro de hoje é o que prova que o risco continua existindo.",
  },
  {
    titulo: "Informe nome e CPF, se você souber",
    texto:
      "Recomendamos fortemente identificar quem está te deixando preocupado. Isso não gera nada contra a pessoa e dá muito mais força ao registro — inclusive numa investigação futura, quando aquele CPF já constar de um boletim anterior.",
  },
  {
    titulo: "Por que esta etapa existe",
    texto:
      "A lei que regula armas no Brasil (Estatuto do Desarmamento) exige efetiva necessidade. Não existe, hoje, autorização concedida por “defesa pessoal” pura. Este material é exatamente o que sustenta o seu pedido perante a Polícia Federal.",
  },
];

/** O texto que o cliente marca. É ele que vai para a auditoria, na íntegra. */
export const TERMO_BO_TEXTO =
  "Li e entendi a explicação sobre o boletim de ocorrência. Declaro estar ciente de que o boletim é uma comunicação minha, feita por mim, perante a autoridade policial, com fatos que eu mesmo declaro e pelos quais respondo. A Quero Armas apenas me orientou sobre como proceder e organizou o meu relato: não registra o boletim em meu nome, não me representa perante a delegacia e não responde pelo conteúdo por mim declarado. Estou ciente também de que registrar o boletim não instaura inquérito nem acusa ninguém, e de que a representação, se eu quiser fazê-la, é ato exclusivamente meu, dentro do prazo legal. Estou ciente, ainda, de que devo enviar todos os boletins que eu possuir, inclusive os antigos, porque eles demonstram a reiteração das ameaças, e de que o registro de um boletim novo só é exigido quando não houver registro recente nem fato novo correlato no meu relato.";

/** Texto integral guardado na auditoria: explicação lida + termo aceito. */
export function montarTextoTermoBo(): string {
  const blocos = BLOCOS_EXPLICACAO_BO.map((b) => `${b.titulo}\n${b.texto}`).join("\n\n");
  return `${TERMO_BO_TITULO}\n\n${blocos}\n\n---\n\n${TERMO_BO_TEXTO}`;
}