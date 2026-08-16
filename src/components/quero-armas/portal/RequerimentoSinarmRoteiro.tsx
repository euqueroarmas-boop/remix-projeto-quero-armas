// ============================================================================
// RequerimentoSinarmRoteiro — Bloco 1 do requerimento gerado pelo cliente
// ----------------------------------------------------------------------------
// O requerimento NÃO é um formulário que a gente preenche e manda: ele é
// preenchido DENTRO do SINARM, com o gov.br do próprio cliente. Não existe API
// pública, então geração automática é impossível — o que dá para automatizar é
// tirar a digitação do caminho.
//
// Esta tela é o "0. Dados Básicos - NOME.txt" que a equipe monta na mão hoje,
// virando página: os campos do formulário da PF, na ORDEM em que aparecem lá,
// cada um com botão de copiar, puxados do cadastro já conferido.
//
// POR QUE A ORDEM E A ORIGEM DOS DADOS IMPORTAM (não é capricho de UI):
// nos indeferimentos reais que analisamos, dois dos motivos não tinham nada a
// ver com mérito — "certidões com nome divergente do documento apresentado" e
// "comprovante de CNPJ com endereço divergente do preenchido no formulário
// SINARM". Ou seja: o cliente digitou no site da PF um endereço diferente do
// que consta no cartão CNPJ que ele mesmo anexou, e isso derrubou um requisito
// legal inteiro (art. 10, §1º, II da Lei 10.826/03). Copiando do cadastro, o
// dado que vai para a PF é o MESMO que está no documento — não tem como
// divergir.
//
// A ORDEM E OS RÓTULOS SAEM DO FORMULÁRIO REAL, não do PDF impresso: os prints
// do SINARM (16/08/2026) mostraram que a tela tem 4 abas, que UF e Município de
// Nascimento só aparecem depois de escolher "Brasil", que CPF/Nome/E-mail já
// vêm preenchidos do gov.br, e que Profissão é lista fechada — nada disso dá
// para deduzir do requerimento impresso.
//
// Renderizada como `corpo` de uma pendência do PendenciasGuiadasPopup, igual à
// Efetiva Necessidade: nada de segundo pop-up por cima do guiado.
// ============================================================================

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, Copy, ExternalLink } from "lucide-react";
import { hojeISOBRT } from "@/lib/quero-armas/validadeDocumento";
import {
  dataEmissaoDoNumero,
  prazoEntregaRequerimento,
  PRAZO_ENTREGA_DOCUMENTACAO_DIAS,
} from "@/lib/quero-armas/requerimentoSinarm";

/**
 * Entrada oficial do serviço, com o botão verde "Iniciar" que leva ao login
 * gov.br. Apontar para a página geral de armas da PF obrigava o cliente a
 * caçar o link no meio da página.
 */
const URL_PF_ARMAS = "https://www.gov.br/pt-br/servicos/adquirir-arma-de-fogo";

// ---------------------------------------------------------------------------
// Formatação — o valor tem que sair daqui do jeito que o campo da PF espera,
// senão o cliente cola e o site recusa (ou pior: aceita torto).
// ---------------------------------------------------------------------------
function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function fmtCPF(v: unknown): string {
  const d = soDigitos(v);
  if (d.length !== 11) return String(v ?? "").trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtCNPJ(v: unknown): string {
  const d = soDigitos(v);
  if (d.length !== 14) return String(v ?? "").trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function fmtCEP(v: unknown): string {
  const d = soDigitos(v);
  if (d.length !== 8) return String(v ?? "").trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Aceita ISO (2026-08-16) ou já-BR e devolve sempre dd/mm/aaaa. */
function fmtData(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function fmtTelefone(v: unknown): string {
  const d = soDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(v ?? "").trim();
}

function titulo(v: unknown): string {
  return String(v ?? "").trim();
}

// ---------------------------------------------------------------------------
// Modelo de um campo do formulário da PF
// ---------------------------------------------------------------------------
interface CampoSinarm {
  /** Rótulo EXATO como aparece no formulário do SINARM. */
  label: string;
  /** Valor já formatado, pronto para colar. */
  valor: string;
  /**
   * Campo que a PF exige e que, vazio, gera exigência ou indeferimento.
   * Vazio + obrigatório = alerta no topo, com link para completar o cadastro.
   */
  obrigatorio?: boolean;
  /** Explicação curta quando o campo não é óbvio. */
  ajuda?: string;
  /** Valor fixo do formulário (o cliente escolhe numa lista, não digita). */
  fixo?: boolean;
  /**
   * O SINARM já traz o campo preenchido a partir do gov.br (aparece cinza,
   * bloqueado). Botão de copiar aqui é ruído: o cliente não digita nada.
   */
  govbr?: boolean;
}

interface SecaoSinarm {
  titulo: string;
  descricao?: string;
  campos: CampoSinarm[];
  /** Renderiza um bloco fixo extra dentro da seção. */
  destaque?: "calibre" | "cpf_divergente" | "unidade_atendimento";
}

// ---------------------------------------------------------------------------
// CALIBRE — a única escolha do formulário que reprova o pedido sozinha
// ---------------------------------------------------------------------------
// Calibre restrito só pode ser vendido a segurança pública. Se o cliente
// escolher um na lista do SINARM, o requerimento é indeferido DE OFÍCIO: a
// Polícia Federal nem abre a documentação. Todo o dossiê — certidões, laudos,
// exame de tiro, petição — vira lixo por um item de menu escolhido errado.
//
// É o erro mais caro possível neste passo, e o único que nenhuma conferência
// nossa pega depois: quando o requerimento chega aqui, a escolha já foi feita.
// Por isso o aviso é antecipado e não fica escondido no meio dos campos.
// Os rótulos abaixo são EXATAMENTE como aparecem na lista do SINARM
// (conferidos nos prints de 16/08/2026). Escrever ".22 Long Rifle" quando a
// lista diz ".22 LR" faz o cliente procurar e não achar.
const CALIBRES_PERMITIDOS: Array<{ especie: string; calibres: string[] }> = [
  { especie: "Pistola", calibres: [".22 LR", ".380 ACP", ".38 TPC"] },
  { especie: "Revolver", calibres: [".38 SPL"] },
  { especie: "Escopeta", calibres: ["12 GA"] },
];

/**
 * Entradas vizinhas na lista que parecem a certa e não são.
 *
 * A lista da PF tem `.380`, `.380 ACP` e `.380 WIN` em sequência, e `.38`,
 * `.38 SPL`, `.38 Super Auto`, `.38 TPC` coladas. Errar aqui não dá aviso
 * nenhum no site: o requerimento sai emitido e o indeferimento vem depois.
 */
const CALIBRES_PARECIDOS: string[] = [
  ".380 e .380 WIN não são .380 ACP",
  ".38 e .38 Super Auto não são .38 SPL nem .38 TPC",
  ".22 e .22 MAGNUM não são .22 LR",
];

export interface RequerimentoSinarmRoteiroProps {
  /** Linha de `qa_clientes` (o portal já carrega com `select("*")`). */
  cliente: Record<string, unknown> | null | undefined;
  /** Espécie da arma pretendida (ex.: "Pistola"), quando já definida. */
  especieArma?: string | null;
  /** Calibre pretendido (ex.: ".380 ACP"), quando já definido. */
  calibreArma?: string | null;
  /**
   * Status do documento do requerimento em `qa_documentos_cliente`.
   *
   * É ele que separa as DUAS chamadas deste passo: enquanto a equipe não
   * aprovar o requerimento gerado, o cliente não pode pagar a GRU — taxa paga
   * em requerimento com dado errado é dinheiro perdido, porque o requerimento
   * é refeito do zero.
   */
  statusDocumento?: string | null;
  /**
   * Número do requerimento (`qa_documentos_cliente.numero_documento`) — os 18
   * dígitos impressos no topo da via da PF, os mesmos do código de barras.
   *
   * É por ele que o cliente reencontra o requerimento no site da PF para gerar
   * e pagar o boleto. Sem isso ele precisa caçar no meio do PDF, e digitar 18
   * dígitos errado leva a lugar nenhum. Aparece só quando já temos o número
   * registrado na conferência.
   */
  numeroRequerimento?: string | null;
  /** Abre o envio do PDF assinado — mesmo caminho de qualquer documento. */
  onEntregar?: () => void;
}

// ---------------------------------------------------------------------------
// Montagem das seções a partir do cadastro
// ---------------------------------------------------------------------------
function montarSecoes(
  c: Record<string, unknown>,
  especieArma?: string | null,
  calibreArma?: string | null,
): SecaoSinarm[] {
  // O RG pode estar em `rg` (legado) ou em `numero_documento_identidade`
  // (cadastro novo, que aceita CIN/RG/CNH). Vale o que estiver preenchido.
  const numeroIdentidade = titulo(c.rg) || titulo(c.numero_documento_identidade);

  return [
    // ── ABA 1 ────────────────────────────────────────────────────────────
    {
      titulo: "Aba 1 · Identificação",
      descricao:
        "Deixe DESMARCADO o \"Requerimento realizado por procuração\" no topo — você está fazendo em seu próprio nome. Tipo de Formulário: Pessoa Física. Categoria: Cidadão.",
      destaque: "cpf_divergente",
      campos: [
        { label: "Tipo de Formulário", valor: "Pessoa Física", fixo: true },
        { label: "Categoria", valor: "Cidadão", fixo: true, ajuda: "Não escolha Caçador de Subsistência nem Servidor Público." },
        { label: "CPF", valor: fmtCPF(c.cpf), govbr: true },
        { label: "Nome", valor: titulo(c.nome_completo), govbr: true },
        {
          label: "Nome do Pai",
          valor: titulo(c.nome_pai),
          ajuda: "Não é obrigatório. Deixe em branco se não constar no seu registro de nascimento.",
        },
        { label: "Nome da Mãe", valor: titulo(c.nome_mae), obrigatorio: true },
        { label: "Data de Nascimento", valor: fmtData(c.data_nascimento), obrigatorio: true },
        { label: "Sexo", valor: titulo(c.sexo), obrigatorio: true, fixo: true },
        {
          label: "País de Nascimento",
          valor: titulo(c.naturalidade_pais) || "Brasil",
          obrigatorio: true,
          fixo: true,
          ajuda: "Escolhendo Brasil, o site abre mais dois campos: UF e Município de Nascimento.",
        },
        { label: "UF de Nascimento", valor: titulo(c.naturalidade_uf), obrigatorio: true, fixo: true },
        {
          label: "Município de Nascimento",
          valor: titulo(c.naturalidade_municipio) || titulo(c.naturalidade),
          obrigatorio: true,
          fixo: true,
        },
        { label: "Número do RG", valor: numeroIdentidade, obrigatorio: true },
        { label: "Data de Expedição", valor: fmtData(c.expedicao_rg), ajuda: "Não é obrigatório, mas preencha se souber." },
        { label: "Órgão Exp. RG", valor: titulo(c.emissor_rg), obrigatorio: true },
        { label: "UF Exp. RG", valor: titulo(c.uf_emissor_rg), obrigatorio: true, fixo: true },
        { label: "Estado Civil", valor: titulo(c.estado_civil), obrigatorio: true, fixo: true },
        { label: "Título de Eleitor", valor: soDigitos(c.titulo_eleitor), ajuda: "Não é obrigatório." },
        {
          label: "Profissão",
          valor: titulo(c.profissao),
          obrigatorio: true,
          fixo: true,
          ajuda:
            "É uma lista fechada. Se a sua profissão não estiver lá, escolha a mais próxima — e nos avise qual escolheu.",
        },
        { label: "Aposentado", valor: "Não", fixo: true, ajuda: "Marque a caixinha só se você for aposentado." },
        { label: "E-mail", valor: titulo(c.email), govbr: true },
      ],
    },
    {
      titulo: "Aba 1 · Dados Residenciais",
      descricao:
        "Tem que ser o mesmo endereço do comprovante de residência que você nos enviou. Divergência aqui vira exigência.",
      campos: [
        { label: "CEP", valor: fmtCEP(c.cep), obrigatorio: true },
        { label: "Tipo", valor: "Residencial", fixo: true },
        { label: "Logradouro", valor: titulo(c.endereco), obrigatorio: true },
        { label: "Número", valor: titulo(c.numero), obrigatorio: true },
        { label: "Complemento", valor: titulo(c.complemento) },
        { label: "Bairro", valor: titulo(c.bairro), obrigatorio: true },
        { label: "UF", valor: titulo(c.estado), obrigatorio: true, fixo: true },
        { label: "Município", valor: titulo(c.cidade), obrigatorio: true, fixo: true },
        { label: "Telefone Fixo", valor: "" },
        { label: "Telefone Celular", valor: fmtTelefone(c.celular), obrigatorio: true },
      ],
    },
    {
      titulo: "Aba 1 · Dados Profissionais",
      descricao:
        "O site não marca estes campos como obrigatórios — mas é aqui que processo cai. No indeferimento real que analisamos, o requisito da ocupação lícita foi julgado não cumprido porque o endereço digitado divergia do cartão CNPJ anexado. Copie daqui, não digite de cabeça.",
      campos: [
        { label: "CNPJ Empresa", valor: fmtCNPJ(c.ocupacao_licita_cnpj) },
        { label: "Razão Social", valor: titulo(c.ocupacao_licita_razao_social) },
        { label: "CEP", valor: fmtCEP(c.ocupacao_licita_cep) },
        { label: "Tipo", valor: "Comercial", fixo: true },
        { label: "Logradouro", valor: titulo(c.ocupacao_licita_logradouro) },
        { label: "Número", valor: titulo(c.ocupacao_licita_numero) },
        { label: "Complemento", valor: titulo(c.ocupacao_licita_complemento) },
        { label: "Bairro", valor: titulo(c.ocupacao_licita_bairro) },
        { label: "UF", valor: titulo(c.ocupacao_licita_estado), fixo: true },
        { label: "Município", valor: titulo(c.ocupacao_licita_cidade), fixo: true },
        { label: "Telefone Comercial", valor: fmtTelefone(c.ocupacao_licita_telefone) },
      ],
    },

    // ── ABA 2 ────────────────────────────────────────────────────────────
    {
      titulo: "Aba 2 · Dados da Arma",
      descricao:
        "Dois campos só, os dois em lista. É a parte mais perigosa do formulário inteiro — leia o aviso antes de escolher.",
      destaque: "calibre",
      campos: [
        { label: "Espécie", valor: titulo(especieArma), obrigatorio: true, fixo: true },
        { label: "Calibre", valor: titulo(calibreArma), obrigatorio: true, fixo: true },
      ],
    },

    // ── ABA 3 ────────────────────────────────────────────────────────────
    {
      titulo: "Aba 3 · Declaração de Efetiva Necessidade",
      descricao:
        "São DOIS campos de texto livre, os dois obrigatórios. NÃO escreva a sua história aqui — ela vai inteira, com as provas, na petição que nós montamos. Cole exatamente os textos abaixo.",
      campos: [
        {
          label: "1º campo — motivos da efetiva necessidade",
          valor:
            "Declaro os motivos da efetiva necessidade para aquisição de arma de fogo na juntada de documentos.",
          obrigatorio: true,
          ajuda:
            "Esta frase remete a análise à petição anexada, que é onde a fundamentação tem força. Texto curto e genérico digitado aqui é o que a PF chama de justificativa vaga — e foi o que derrubou pedidos que analisamos.",
        },
        {
          label: "2º campo — lugar seguro de armazenamento",
          valor:
            "Declaro possuir lugar seguro para armazenamento das armas de fogo das quais serei proprietário de modo a adotar as medidas necessárias para impedir que menor de dezoito anos de idade ou pessoa com deficiência mental se apodere de arma de fogo que esteja sob minha posse ou que seja de minha propriedade nos termos do disposto no art. 13 da Lei nº 10.826, de 2003.",
          obrigatorio: true,
          ajuda: "É o texto legal do art. 13 do Estatuto do Desarmamento. Cole inteiro.",
        },
      ],
    },

    // ── ABA 4 ────────────────────────────────────────────────────────────
    {
      titulo: "Aba 4 · Termo de Responsabilidade",
      descricao:
        "Marque as duas caixinhas, escolha a unidade de atendimento, digite o texto da imagem e clique em Emitir Requerimento.",
      destaque: "unidade_atendimento",
      campos: [
        {
          label: "Unidade de Atendimento — UF",
          valor: titulo(c.estado),
          obrigatorio: true,
          fixo: true,
        },
        {
          label: "Unidade de Atendimento — Município",
          valor: titulo(c.cidade),
          obrigatorio: true,
          fixo: true,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const vazio = !valor;

  const copiar = async () => {
    if (vazio) return;
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Safari em contexto não-seguro e WebViews antigas não expõem o
      // clipboard. Sem fallback o botão fica mudo e o cliente acha que quebrou.
      const ta = document.createElement("textarea");
      ta.value = valor;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* sem clipboard: resta selecionar à mão */ }
      document.body.removeChild(ta);
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copiar}
      disabled={vazio}
      aria-label={`Copiar ${rotulo}`}
      className={[
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[9.5px] font-bold uppercase tracking-[0.1em] transition-colors",
        vazio
          ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-300"
          : copiado
            ? "bg-emerald-700 text-white"
            : "border border-[#8A1224] bg-white text-[#8A1224] hover:bg-[#FFF7F8]",
      ].join(" ")}
    >
      {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

function LinhaCampo({ campo }: { campo: CampoSinarm }) {
  const vazio = !campo.valor;
  const faltando = vazio && campo.obrigatorio && !campo.govbr;

  return (
    <div
      className={[
        "flex items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0",
        faltando ? "bg-[#FBF3F4]" : "",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
          {campo.label}
          {campo.govbr ? (
            <span className="ml-1 font-semibold normal-case tracking-normal text-emerald-700">
              · já vem preenchido do gov.br
            </span>
          ) : campo.fixo ? (
            <span className="ml-1 font-semibold normal-case tracking-normal text-slate-400">
              · escolha na lista
            </span>
          ) : null}
        </p>
        {vazio ? (
          <p
            className={[
              "text-[12px] font-semibold",
              faltando ? "text-[#8A1224]" : "text-slate-400",
            ].join(" ")}
          >
            {faltando ? "Falta no seu cadastro" : "Não se aplica — deixe em branco"}
          </p>
        ) : (
          <p className="break-words text-[13px] font-semibold leading-snug text-slate-900">
            {campo.valor}
          </p>
        )}
        {campo.ajuda && (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{campo.ajuda}</p>
        )}
      </div>
      {campo.govbr ? (
        <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-800">
          Confira
        </span>
      ) : (
        <BotaoCopiar valor={campo.valor} rotulo={campo.label} />
      )}
    </div>
  );
}

function AvisoCalibre() {
  return (
    <div className="border-b border-slate-100 bg-red-50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Escolher calibre restrito reprova o pedido na hora
      </p>
      <p className="mt-1 text-[12px] font-semibold leading-snug text-red-900">
        Calibre restrito só pode ser vendido a segurança pública. Se você escolher um na lista,
        a Polícia Federal indefere <span className="underline">de ofício</span> — sem abrir a sua
        documentação. Certidões, laudos, exame de tiro e petição são perdidos por causa de um item
        de menu, e o processo recomeça do zero.
      </p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-red-800">
        Escolha um destes
      </p>
      <ul className="mt-1 space-y-1">
        {CALIBRES_PERMITIDOS.map((g) => (
          <li key={g.especie} className="text-[12px] leading-snug text-red-900">
            <span className="font-bold">{g.especie}:</span>{" "}
            {g.calibres.join(" · ")}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-red-800">
        Cuidado com os parecidos
      </p>
      <ul className="mt-1 space-y-0.5">
        {CALIBRES_PARECIDOS.map((t) => (
          <li key={t} className="text-[11px] leading-snug text-red-900">• {t}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-red-900">
        A lista da Polícia Federal mistura permitidos e restritos sem nenhuma marcação, e aceita
        qualquer escolha sem avisar. Espécie também: Fuzil, Metralhadora e Submetralhadora estão
        ali, à mão. Se a arma que você quer não estiver na lista acima, fale com a nossa equipe
        <span className="font-bold"> antes</span> de escolher — depois de emitido não dá para
        corrigir.
      </p>
    </div>
  );
}

/**
 * Alerta que o SINARM abre ao avançar da aba Identificação quando o que foi
 * digitado não bate com a base de dados do CPF. É silencioso e fácil de
 * despachar no "Sim" — e seguir com divergência conhecida é exatamente o que
 * derruba requisito depois.
 */
function AvisoCpfDivergente() {
  return (
    <div className="border-b border-slate-100 bg-amber-50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" />
        Se aparecer a caixa "informações divergentes"
      </p>
      <p className="mt-1 text-[12px] leading-snug text-amber-900">
        Ao avançar, o site pode abrir: <em>"As informações relacionadas ao CPF informado foram
        alteradas e estão divergentes daquelas cadastradas no banco de dados, deseja
        prosseguir?"</em> Isso quer dizer que algum dado que você digitou não bate com o cadastro
        oficial. <span className="font-bold">Não clique em Sim no automático.</span> Volte,
        confira campo a campo contra esta tela e, se continuar aparecendo, fale com a gente antes
        de seguir.
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-amber-900">
        Já os avisos vermelhos de CEP ("não encontrado", "não validado na base corporativa") são
        do próprio site e não são culpa sua — pode seguir.
      </p>
    </div>
  );
}

/**
 * Unidade de Atendimento: define QUAL delegacia recebe e analisa o processo.
 * Escolher errado manda o pedido para outra cidade.
 */
function AvisoUnidadeAtendimento() {
  return (
    <div className="border-b border-slate-100 bg-[#FBF3F4] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7A1F2B]">
        Escolha a delegacia mais próxima da sua casa
      </p>
      <p className="mt-1 text-[12px] leading-snug text-[#7A1F2B]">
        São três listas em sequência: UF, Município e Unidade. É essa escolha que define qual
        delegacia da Polícia Federal vai analisar o seu processo — e é onde você teria que
        comparecer, se for notificado a levar documentos originais. Escolha pela sua residência,
        não pelo trabalho.
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-[#7A1F2B]">
        Depois marque as duas declarações, digite o texto da imagem (aquele código embaralhado) e
        clique em <span className="font-bold">Emitir Requerimento</span>.
      </p>
    </div>
  );
}

function Secao({ secao }: { secao: SecaoSinarm }) {
  const preenchidos = secao.campos.filter((c) => c.valor).length;

  const copiarSecao = async () => {
    const texto = secao.campos
      .filter((c) => c.valor)
      .map((c) => `${c.label}: ${c.valor}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* o botão por campo continua sendo o caminho garantido */
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700">
            {secao.titulo}
          </h4>
          <button
            type="button"
            onClick={copiarSecao}
            className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A1224] underline underline-offset-2"
          >
            Copiar bloco ({preenchidos})
          </button>
        </div>
        {secao.descricao && (
          <p className="mt-1 text-[11px] leading-snug text-slate-600">{secao.descricao}</p>
        )}
      </header>
      <div>
        {secao.destaque === "calibre" && <AvisoCalibre />}
        {secao.destaque === "cpf_divergente" && <AvisoCpfDivergente />}
        {secao.destaque === "unidade_atendimento" && <AvisoUnidadeAtendimento />}
        {secao.campos.map((campo) => (
          <LinhaCampo key={`${secao.titulo}:${campo.label}`} campo={campo} />
        ))}
      </div>
    </section>
  );
}

const PASSOS: string[] = [
  'Abra o serviço no gov.br e clique no botão verde "Iniciar". Entre com o seu gov.br — é a sua conta, no seu nome, e nós não preenchemos por você.',
  "O formulário tem 4 abas, nesta ordem: Identificação, Dados da Arma, Declaração de Efetiva Necessidade e Termo de Responsabilidade. Você avança com o botão \"Próxima >>\".",
  "Preencha cada aba com os dados desta tela. Os campos abaixo estão na mesma ordem em que aparecem no site, aba por aba, cada um com botão de copiar.",
  "Depois dos seus dados o site pede a espécie e o CALIBRE da arma. Calibre restrito é indeferido de ofício, sem ninguém olhar a sua documentação — use só os permitidos, listados no bloco \"Dados da arma\" aqui embaixo.",
  "Ao terminar, clique em Imprimir Requerimento e baixe o arquivo. São 3 páginas — a via da Polícia Federal. É esse arquivo que você envia aqui.",
  "PARE aqui. Não pague a taxa ainda. A nossa equipe confere o que você digitou contra o seu cadastro e libera o pagamento.",
];

export default function RequerimentoSinarmRoteiro({
  cliente,
  especieArma,
  calibreArma,
  statusDocumento,
  numeroRequerimento,
  onEntregar,
}: RequerimentoSinarmRoteiroProps) {
  const numero = String(numeroRequerimento ?? "").trim();
  // O relógio de 15 dias sai do próprio número: os 8 primeiros dígitos são a
  // data em que o requerimento foi gerado no SINARM.
  const prazo = useMemo(
    () => (numero ? prazoEntregaRequerimento(dataEmissaoDoNumero(numero), hojeISOBRT()) : null),
    [numero],
  );
  const status = String(statusDocumento ?? "").trim().toLowerCase();
  /** Requerimento já saiu das nossas mãos e está sendo conferido. */
  const emConferencia = ["enviado", "em_analise", "revisao_humana"].includes(status);
  /** Conferido e liberado: agora — e só agora — pode pagar a GRU. */
  const liberadoParaPagar = ["aprovado", "entregue_pelo_hub"].includes(status);
  /** Reprovado: tem erro, e pagar agora seria jogar a taxa fora. */
  const reprovado = ["invalido", "divergente"].includes(status);
  const secoes = useMemo(
    () => (cliente ? montarSecoes(cliente, especieArma, calibreArma) : []),
    [cliente, especieArma, calibreArma],
  );

  const faltando = useMemo(
    () =>
      secoes
        .flatMap((s) => s.campos.map((c) => ({ ...c, secao: s.titulo })))
        .filter((c) => c.obrigatorio && !c.valor),
    [secoes],
  );

  if (!cliente) {
    return (
      <p className="px-1 py-4 text-[12px] text-slate-600">
        Não consegui carregar o seu cadastro agora. Atualize a página e tente de novo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#E5C2C6] bg-[#FBF3F4] p-3">
        <p className="text-[12px] font-semibold leading-snug text-[#7A1F2B]">
          O requerimento é preenchido dentro do sistema da Polícia Federal, com o seu gov.br.
          Ninguém pode gerar por você — mas você não precisa digitar nada de cabeça. Está tudo
          aqui embaixo, pronto para copiar.
        </p>
      </div>

      {/*
        AVISO DO PAGAMENTO — vem ANTES do passo a passo de propósito.
        No site da PF o botão de pagar a GRU fica na mesma tela em que o
        requerimento é gerado. Quem lê o aviso só no fim já pagou. E taxa paga
        em requerimento com dado errado não volta: o requerimento é refeito do
        zero, com nova taxa.
      */}
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" />
          Leia antes de começar: não pague a taxa ainda
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-snug text-amber-900">
          O site da Polícia Federal vai oferecer o pagamento da GRU assim que você gerar o
          requerimento. <span className="underline">Não pague nesse momento.</span> Envie o
          requerimento aqui primeiro: a nossa equipe confere cada campo contra o seu cadastro e
          libera o pagamento. Taxa paga em requerimento com erro é dinheiro perdido — o
          requerimento tem que ser refeito do zero, com taxa nova.
        </p>
      </div>

      <ol className="space-y-1.5 border-l-2 border-[#E5C2C6] pl-3">
        {PASSOS.map((passo, i) => (
          <li key={i} className="text-[12px] leading-snug text-slate-700">
            <span className="mr-1 font-bold text-[#8A1224]">{i + 1}.</span>
            {passo}
          </li>
        ))}
      </ol>

      <a
        href={URL_PF_ARMAS}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#8A1224] px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#6f0f1e]"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir o site da Polícia Federal
      </a>

      {faltando.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            {faltando.length === 1
              ? "1 dado obrigatório está faltando"
              : `${faltando.length} dados obrigatórios estão faltando`}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-amber-900">
            Preencha no site da PF mesmo assim, com a informação correta, e avise a nossa equipe
            para atualizarmos o seu cadastro. Campo em branco no formulário vira exigência da
            Polícia Federal e atrasa o processo em pelo menos 10 dias.
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {faltando.map((c) => (
              <li key={`${c.secao}:${c.label}`} className="text-[11px] text-amber-900">
                • {c.label}{" "}
                <span className="text-amber-700">({c.secao})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {secoes.map((secao) => (
        <Secao key={secao.titulo} secao={secao} />
      ))}

      {/*
        RELÓGIO DE 15 DIAS — só aparece depois que o requerimento existe.
        Feito o requerimento, a documentação completa tem 15 dias corridos para
        chegar à PF; passado o prazo o pedido é marcado como EXPIRADO e tudo
        recomeça. A data de emissão sai do próprio número do requerimento.
      */}
      {prazo && (
        <div
          className={[
            "rounded-lg border-2 p-3",
            prazo.faixa === "ok"
              ? "border-emerald-300 bg-emerald-50"
              : prazo.faixa === "warn"
                ? "border-amber-400 bg-amber-50"
                : "border-red-400 bg-red-50",
          ].join(" ")}
        >
          <p
            className={[
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]",
              prazo.faixa === "ok"
                ? "text-emerald-900"
                : prazo.faixa === "warn"
                  ? "text-amber-900"
                  : "text-red-800",
            ].join(" ")}
          >
            <Clock className="h-3.5 w-3.5" />
            {prazo.faixa === "expirado"
              ? `Prazo vencido há ${Math.abs(prazo.diasRestantes)} dia(s)`
              : prazo.diasRestantes === 0
                ? "Último dia para entregar a documentação"
                : `Faltam ${prazo.diasRestantes} dia(s) para entregar a documentação`}
          </p>
          <p
            className={[
              "mt-1 text-[11px] leading-snug",
              prazo.faixa === "ok"
                ? "text-emerald-900"
                : prazo.faixa === "warn"
                  ? "text-amber-900"
                  : "text-red-900",
            ].join(" ")}
          >
            {prazo.faixa === "expirado" ? (
              <>
                A Polícia Federal marca como expirado o requerimento que passa de{" "}
                {PRAZO_ENTREGA_DOCUMENTACAO_DIAS} dias sem a documentação completa. Fale com a
                nossa equipe para saber se ainda dá para aproveitar ou se será preciso refazer.
              </>
            ) : (
              <>
                Prazo até {fmtData(prazo.dataLimite)}. Contado do dia em que você gerou o
                requerimento: são {PRAZO_ENTREGA_DOCUMENTACAO_DIAS} dias para a documentação
                completa chegar à Polícia Federal, senão o pedido expira e recomeça do zero.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── ETAPA 1: gerar e mandar conferir ───────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700">
          Etapa 1 · Envie o requerimento para conferência
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-600">
          Clique em <strong>Imprimir Requerimento</strong> no site da PF e baixe o arquivo. São
          as <strong>3 páginas da via da Polícia Federal</strong> — é isso que a gente analisa.
          Se for fotografar em vez de baixar, garanta que dá para ler cada linha: documento
          ilegível é motivo de exigência, e já travou processo nosso por 10 dias.
        </p>

        {emConferencia && (
          <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold leading-snug text-sky-900">
            Recebemos o seu requerimento e estamos conferindo. Aguarde a nossa liberação antes de
            pagar qualquer coisa.
          </p>
        )}
        {reprovado && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold leading-snug text-red-900">
            Encontramos divergência no requerimento que você enviou. Refaça no site da PF com os
            dados desta tela e envie de novo. Ainda não pague a taxa.
          </p>
        )}

        {onEntregar && !liberadoParaPagar && (
          <button
            type="button"
            onClick={onEntregar}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#0A0A0A] px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#1a1a1a]"
          >
            {emConferencia || reprovado ? "Enviar novamente" : "Enviar o requerimento gerado"}
          </button>
        )}
      </div>

      {/* ── ETAPA 2: pagar a GRU, só depois da nossa liberação ─────────── */}
      <div
        className={[
          "rounded-lg border p-3",
          liberadoParaPagar ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white",
        ].join(" ")}
      >
        <p
          className={[
            "text-[10px] font-bold uppercase tracking-[0.1em]",
            liberadoParaPagar ? "text-emerald-900" : "text-slate-400",
          ].join(" ")}
        >
          Etapa 2 · Pague a taxa e envie o comprovante
          {!liberadoParaPagar && " · bloqueada"}
        </p>
        {liberadoParaPagar ? (
          <>
            <p className="mt-1 text-[11px] leading-snug text-emerald-900">
              Requerimento conferido e liberado. Agora sim: volte ao site da Polícia Federal, gere
              o boleto da GRU e pague. Depois envie aqui a página do boleto junto com o
              comprovante de pagamento.
            </p>
            {numero && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    Número do seu requerimento
                  </p>
                  <p className="break-all font-mono text-[13px] font-semibold text-slate-900">
                    {numero}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                    Use este número no site da PF para reabrir o requerimento e emitir o boleto.
                  </p>
                </div>
                <BotaoCopiar valor={numero} rotulo="número do requerimento" />
              </div>
            )}
            {onEntregar && (
              <button
                type="button"
                onClick={onEntregar}
                className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-emerald-700 px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-emerald-800"
              >
                Enviar boleto e comprovante
              </button>
            )}
          </>
        ) : (
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Esta etapa abre sozinha assim que a nossa equipe conferir o requerimento que você
            enviou na etapa 1. Até lá, não pague nada.
          </p>
        )}
      </div>
    </div>
  );
}
