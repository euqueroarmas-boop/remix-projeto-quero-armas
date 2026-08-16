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
// Renderizada como `corpo` de uma pendência do PendenciasGuiadasPopup, igual à
// Efetiva Necessidade: nada de segundo pop-up por cima do guiado.
// ============================================================================

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink } from "lucide-react";

/** Endereço oficial de entrada dos serviços de arma da PF. */
const URL_PF_ARMAS = "https://www.gov.br/pf/pt-br/assuntos/armas";

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
}

interface SecaoSinarm {
  titulo: string;
  descricao?: string;
  campos: CampoSinarm[];
}

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
    {
      titulo: "Identificação",
      descricao:
        "É o primeiro bloco do formulário. Confira campo a campo — o que você digitar aqui precisa bater com o RG e o CPF que você já nos enviou.",
      campos: [
        {
          label: "Tipo de Formulário",
          valor: "Requerimento de Aquisição de Arma de Fogo",
          fixo: true,
          ajuda: "Você escolhe numa lista, não digita.",
        },
        { label: "Categoria", valor: "Cidadão", fixo: true, ajuda: "Escolha na lista." },
        { label: "CPF", valor: fmtCPF(c.cpf), obrigatorio: true },
        { label: "Nome", valor: titulo(c.nome_completo), obrigatorio: true },
        { label: "Nome da Mãe", valor: titulo(c.nome_mae), obrigatorio: true },
        {
          label: "Nome do Pai",
          valor: titulo(c.nome_pai),
          ajuda: "Deixe em branco se não constar no seu registro de nascimento.",
        },
        { label: "Data de Nascimento", valor: fmtData(c.data_nascimento), obrigatorio: true },
        { label: "Sexo", valor: titulo(c.sexo), obrigatorio: true, fixo: true },
        { label: "País de Nascimento", valor: titulo(c.naturalidade_pais) || "Brasil", obrigatorio: true, fixo: true },
        { label: "UF de Nascimento", valor: titulo(c.naturalidade_uf), obrigatorio: true, fixo: true },
        {
          label: "Município de Nascimento",
          valor: titulo(c.naturalidade_municipio) || titulo(c.naturalidade),
          obrigatorio: true,
        },
        { label: "Numero do RG", valor: numeroIdentidade, obrigatorio: true },
        { label: "Data de Expedição", valor: fmtData(c.expedicao_rg), obrigatorio: true },
        { label: "Órgão Exp. RG", valor: titulo(c.emissor_rg), obrigatorio: true },
        { label: "UF de Exp. RG", valor: titulo(c.uf_emissor_rg), obrigatorio: true, fixo: true },
        { label: "Estado Civil", valor: titulo(c.estado_civil), obrigatorio: true, fixo: true },
        { label: "Profissão", valor: titulo(c.profissao), obrigatorio: true },
        {
          label: "Aposentado",
          valor: "Não",
          fixo: true,
          ajuda: "Se você é aposentado, marque Sim.",
        },
        { label: "Titulo de Eleitor", valor: soDigitos(c.titulo_eleitor) },
        { label: "Email", valor: titulo(c.email), obrigatorio: true },
      ],
    },
    {
      titulo: "Endereço residencial",
      descricao:
        "Tem que ser o mesmo endereço do comprovante de residência que você nos enviou. Divergência aqui vira exigência.",
      campos: [
        { label: "CEP", valor: fmtCEP(c.cep), obrigatorio: true },
        { label: "Tipo", valor: "Residencial", fixo: true },
        { label: "Logradouro", valor: titulo(c.endereco), obrigatorio: true },
        { label: "Numero", valor: titulo(c.numero), obrigatorio: true },
        { label: "Complemento", valor: titulo(c.complemento) },
        { label: "Bairro", valor: titulo(c.bairro), obrigatorio: true },
        { label: "UF", valor: titulo(c.estado), obrigatorio: true, fixo: true },
        { label: "Município", valor: titulo(c.cidade), obrigatorio: true },
        { label: "Telefone Celular", valor: fmtTelefone(c.celular), obrigatorio: true },
      ],
    },
    {
      titulo: "Ocupação lícita (empresa)",
      descricao:
        "Este é o bloco que mais derruba processo. O endereço aqui precisa ser IDÊNTICO ao do cartão CNPJ que você anexou — se divergir uma vírgula, a Polícia Federal considera o requisito não cumprido.",
      campos: [
        { label: "CNPJ Empresa", valor: fmtCNPJ(c.ocupacao_licita_cnpj), obrigatorio: true },
        { label: "Razão Social", valor: titulo(c.ocupacao_licita_razao_social), obrigatorio: true },
        { label: "CEP", valor: fmtCEP(c.ocupacao_licita_cep), obrigatorio: true },
        { label: "Tipo", valor: "Comercial", fixo: true },
        { label: "Logradouro", valor: titulo(c.ocupacao_licita_logradouro), obrigatorio: true },
        { label: "Numero", valor: titulo(c.ocupacao_licita_numero), obrigatorio: true },
        { label: "Complemento", valor: titulo(c.ocupacao_licita_complemento) },
        { label: "Bairro", valor: titulo(c.ocupacao_licita_bairro), obrigatorio: true },
        { label: "UF", valor: titulo(c.ocupacao_licita_estado), obrigatorio: true, fixo: true },
        { label: "Município", valor: titulo(c.ocupacao_licita_cidade), obrigatorio: true },
        { label: "Telefone Comercial", valor: fmtTelefone(c.ocupacao_licita_telefone) },
      ],
    },
    {
      titulo: "Dados da arma",
      descricao: "O que você pretende adquirir. Se ainda não decidiu, fale com a nossa equipe antes de preencher.",
      campos: [
        { label: "Espécie", valor: titulo(especieArma), obrigatorio: true, fixo: true },
        { label: "Calibre", valor: titulo(calibreArma), obrigatorio: true, fixo: true },
      ],
    },
    {
      titulo: "Declaração de efetiva necessidade",
      descricao:
        "O site abre um campo de texto livre. NÃO escreva a sua história aqui — ela vai inteira, com as provas, na petição que nós montamos. Cole exatamente esta frase:",
      campos: [
        {
          label: "Motivos da efetiva necessidade",
          valor:
            "Declaro os motivos da efetiva necessidade para aquisição de arma de fogo na juntada de documentos.",
          obrigatorio: true,
          ajuda:
            "Esta frase remete a análise à petição anexada, que é onde a fundamentação tem força. Texto curto e genérico digitado no formulário é o que a PF chama de justificativa vaga.",
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
  const faltando = vazio && campo.obrigatorio;

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
          {campo.fixo && (
            <span className="ml-1 font-semibold normal-case tracking-normal text-slate-400">
              · escolha na lista
            </span>
          )}
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
      <BotaoCopiar valor={campo.valor} rotulo={campo.label} />
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
        {secao.campos.map((campo) => (
          <LinhaCampo key={`${secao.titulo}:${campo.label}`} campo={campo} />
        ))}
      </div>
    </section>
  );
}

const PASSOS: string[] = [
  "Abra o site de armas da Polícia Federal e entre com o seu gov.br. É a sua conta, no seu nome — nós não preenchemos por você.",
  'Escolha "Requerimento de Aquisição de Arma de Fogo".',
  "Preencha o formulário com os dados desta tela. Cada campo abaixo tem um botão de copiar, e estão na mesma ordem em que aparecem no site da PF.",
  "Ao terminar, clique em Imprimir Requerimento e baixe o arquivo. São 3 páginas — a via da Polícia Federal. É esse arquivo que você envia aqui.",
  "PARE aqui. Não pague a taxa ainda. A nossa equipe confere o que você digitou contra o seu cadastro e libera o pagamento.",
];

export default function RequerimentoSinarmRoteiro({
  cliente,
  especieArma,
  calibreArma,
  statusDocumento,
  onEntregar,
}: RequerimentoSinarmRoteiroProps) {
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
