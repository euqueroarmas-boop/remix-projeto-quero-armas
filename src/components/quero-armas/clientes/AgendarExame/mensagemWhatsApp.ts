// ============================================================================
// mensagemWhatsApp — texto que já vai preenchido quando o cliente clica no
// botão WhatsApp de um credenciado da PF. O cliente pede o agendamento sem
// precisar digitar nada, e o profissional entende de cara de onde veio o
// contato: pelo Arsenal Inteligente, no endereço do site.
//
// A mensagem é só a voz do cliente — nenhum convite ou recado da Quero Armas
// enxertado nela. O profissional que se interessar entra no site e procura a
// gente; texto de propaganda na boca do cliente ele apagaria antes de enviar
// (o WhatsApp deixa editar) e o profissional trataria como spam.
// ============================================================================

const SITE = "https://www.euqueroarmas.com.br";

/** O que se agenda com cada tipo de credenciado. Psicólogo faz laudo; instrutor
 *  aplica o exame de capacidade técnica — chamar os dois de "exame" fazia o
 *  instrutor receber um pedido que não é o serviço dele. */
const AGENDAMENTO: Record<"psicologo" | "instrutor_tiro", string> = {
  psicologo: "meu laudo psicológico",
  instrutor_tiro: "meu exame de capacidade técnica e manuseio",
};

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "d'"]);

/** Normaliza o que estiver salvo no campo sexo para "M" ou "F". O padrão é a
 *  inicial (o gatilho de sincronia dos documentos guarda UPPER(LEFT(...,1))),
 *  mas cadastro antigo e leitura de documento já trouxeram a palavra inteira.
 *  "MULHER" é testado antes de "M": pela inicial ela cairia em masculino.
 *  Devolve null só quando não dá para saber — campo vazio ou "Outro". */
export function normalizarSexo(sexo?: string | null): "M" | "F" | null {
  const s = String(sexo || "").trim().toUpperCase();
  if (!s) return null;
  if (s.startsWith("MULH") || s === "F" || s.startsWith("FEM")) return "F";
  if (s === "M" || s.startsWith("MASC") || s === "H" || s.startsWith("HOM")) return "M";
  return null;
}

/** Fecho concordando com o sexo do cliente: só existem duas formas, "obrigado"
 *  e "obrigada". Não havendo como saber (cadastro ainda sem o campo), a frase
 *  termina sem a palavra — em vez de inventar uma terceira forma ou chutar um
 *  gênero e chamar a cliente de "obrigado". */
function agradecimento(sexo?: string | null) {
  const s = normalizarSexo(sexo);
  if (s === "M") return ", obrigado";
  if (s === "F") return ", obrigada";
  return "";
}

/** Cadastro chega quase sempre em caixa alta ("SÃO JOSÉ DOS CAMPOS"). */
function capitalizar(texto: string) {
  return texto
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, i) =>
      i > 0 && MINUSCULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1),
    )
    .join(" ");
}

/** "WILLIAN RODRIGUES DA SILVA" → "Willian". Só o primeiro nome: o cliente está
 *  se apresentando, não preenchendo formulário. */
function primeiroNome(nome?: string | null) {
  const limpo = String(nome || "").trim();
  if (!limpo) return "";
  return capitalizar(limpo.split(/\s+/)[0] || "");
}

/** "GOIANIA" + "go" → "Goiânia/GO" (o acento é o que estiver salvo no cadastro). */
function cidadeUf(cidade?: string | null, uf?: string | null) {
  const c = String(cidade || "").trim();
  const u = String(uf || "").trim().toUpperCase();
  if (c && u) return `${capitalizar(c)}/${u}`;
  return c ? capitalizar(c) : u;
}

export type DadosMensagem = {
  tipo: "psicologo" | "instrutor_tiro";
  nome?: string | null;
  cidade?: string | null;
  uf?: string | null;
  sexo?: string | null;
};

export function mensagemAgendamento({ tipo, nome, cidade, uf, sexo }: DadosMensagem) {
  const quem = primeiroNome(nome);
  const onde = cidadeUf(cidade, uf);

  // Cliente sem cadastro completo ainda usa a busca (pode chegar sem nome, sem
  // cidade ou sem os dois) — a abertura se ajusta para não sobrar vírgula solta
  // nem "Sou de /". Sem artigo antes do nome ("Sou Willian", não "Sou o
  // Willian"): serve para cliente de qualquer gênero.
  let abertura: string;
  if (quem && onde) abertura = `Sou ${quem}, de ${onde}, e encontrei você`;
  else if (quem) abertura = `Sou ${quem} e encontrei você`;
  else if (onde) abertura = `Sou de ${onde} e encontrei você`;
  else abertura = "Encontrei você";

  return (
    `Olá! ${abertura} pelo Arsenal Inteligente da Quero Armas em ${SITE}, ` +
    `que me mostrou os credenciados mais perto de mim. ` +
    `Gostaria de agendar ${AGENDAMENTO[tipo]} para adquirir uma arma de fogo${agradecimento(sexo)}.`
  );
}
