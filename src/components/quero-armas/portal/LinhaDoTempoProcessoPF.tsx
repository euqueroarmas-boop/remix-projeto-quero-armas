// ============================================================================
// LinhaDoTempoProcessoPF — o espaço do processo que está na Polícia Federal
// ----------------------------------------------------------------------------
// "Em processos deve criar um espaço só para o processo que está em análise."
//
// O cockpit de Meus Processos lista TODOS os serviços do cliente, do orçamento
// ao concluído. Enquanto ele está juntando documento isso é o que ele quer ver.
// Depois de protocolado, não: existe um processo só que importa, e a pergunta
// vira "onde ele está e o que já aconteceu". Este painel responde essa
// pergunta e fica acima da lista, sem mexer nela.
//
// A LINHA DO TEMPO É HISTÓRICO REAL, não régua fixa. Cada degrau é um documento
// que a Polícia Federal de fato escreveu, na data em que escreveu, com o texto
// do delegado por baixo. A régua do que ainda vem pela frente já existe no
// painel do protocolo — repetir aqui seria encher a tela com o que ele já viu.
//
// A ORDEM É CRONOLÓGICA CRESCENTE, ao contrário do resto do portal. Uma linha
// do tempo lida de baixo para cima não é linha do tempo; é feed.
//
// O MANDADO DE SEGURANÇA aparece só depois que o RECURSO é negado, e aparece
// como convite — não como pendência. O cliente acabou de ser negado duas vezes;
// uma tela que pareça cobrar mais uma contratação nesse momento é a pior tela
// possível. Antes disso a via administrativa não se esgotou (Lei 9.784/99) e
// oferecer o juiz seria vender um caminho que ele ainda não precisa.
// ============================================================================

import { AlertTriangle, FileText, Gavel, MessageCircle, Scale } from "lucide-react";
import {
  FRASES_MS,
  janelaMandadoSeguranca,
  linkWhatsAppMS,
} from "@/lib/quero-armas/mandadoSeguranca";
import RecursoAprovacaoPanel, { type RecursoParaAprovar } from "./RecursoAprovacaoPanel";
import type { ManifestacaoPF } from "./ProtocoloStatusPanel";

export interface LinhaDoTempoProcessoPFProps {
  /** Nome do serviço — "Posse de arma de fogo". */
  servico?: string | null;
  numeroProtocolo?: string | null;
  dataProtocolo?: string | null;
  delegacia?: string | null;
  /** Status atual do processo, no vocabulário do sistema. */
  status?: string | null;
  /** Nome do cliente, usado só para identificar a conversa no WhatsApp. */
  nomeCliente?: string | null;
  /** Manifestações da PF, do MAIS RECENTE para o mais antigo (como vêm do banco). */
  manifestacoes?: ManifestacaoPF[];
  /** Abre o painel completo do protocolo. */
  onAbrirDetalhe?: () => void;
  /**
   * Recurso aguardando a leitura e a confirmação do cliente. Ausente quando
   * ainda não há recurso nesta rodada.
   */
  recurso?: RecursoParaAprovar | null;
  onRecursoAprovado?: () => void;
}

const TIPO_ROTULO: Record<string, string> = {
  notificacao: "A Polícia Federal pediu algo",
  parecer: "Parecer do delegado",
  manifestacao: "Manifestação da Polícia Federal",
  decisao: "Decisão da Polícia Federal",
};

const STATUS_ROTULO: Record<string, string> = {
  protocolado: "Protocolado — na fila da delegacia",
  em_analise_orgao: "Em análise pela Polícia Federal",
  em_analise: "Em análise pela Polícia Federal",
  notificado: "Notificado — a PF pediu algo a mais",
  recurso_administrativo: "Recurso protocolado, em análise",
  indeferido: "Indeferido",
  deferido: "Deferido",
};

function fmtData(v?: string | null): string {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}

function hojeISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** A data que vale para ordenar: a do documento; na falta, a do registro. */
function dataDoDegrau(m: ManifestacaoPF): string {
  return String(m.data_documento || m.created_at || "").slice(0, 10);
}

export default function LinhaDoTempoProcessoPF({
  servico,
  numeroProtocolo,
  dataProtocolo,
  delegacia,
  status,
  nomeCliente,
  manifestacoes = [],
  onAbrirDetalhe,
  recurso,
  onRecursoAprovado,
}: LinhaDoTempoProcessoPFProps) {
  // Do mais ANTIGO para o mais recente — é o que "linha do tempo" quer dizer.
  const cronologica = [...manifestacoes].sort((a, b) =>
    dataDoDegrau(a).localeCompare(dataDoDegrau(b)),
  );

  // A janela do MS nasce da própria manifestação que negou o recurso. Ler daqui
  // (e não da venda) mantém o painel do cliente independente do que a equipe
  // ainda não tenha lançado do outro lado.
  const negouRecurso = cronologica.find(
    (m) => String(m.status_processo ?? "").toLowerCase() === "recurso_indeferido",
  );
  const janelaMS = janelaMandadoSeguranca(
    negouRecurso ? dataDoDegrau(negouRecurso) : null,
    hojeISO(),
  );

  const contexto = {
    nome: nomeCliente ?? null,
    servico: servico ?? null,
    protocolo: numeroProtocolo ?? null,
  };

  return (
    <section className="mb-4 overflow-hidden rounded-sm border border-[#E5C2C6] bg-white">
      <header className="border-b border-[#E5C2C6] bg-[#FBF3F4] px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
          Processo na Polícia Federal
        </p>
        <h3 className="mt-0.5 text-[14px] font-bold text-[#7A1F2B]">
          {servico || "Processo administrativo"}
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-[#7A1F2B]">
          {STATUS_ROTULO[String(status ?? "").toLowerCase()] ?? "Protocolado — em análise"}
          {numeroProtocolo ? ` · protocolo ${numeroProtocolo}` : ""}
          {delegacia ? ` · ${delegacia}` : ""}
        </p>
      </header>

      <ol className="px-4 py-3">
        {/* Degrau zero: o protocolo. Sempre existe — é o que abre este painel. */}
        <Degrau
          titulo="Protocolado"
          data={dataProtocolo}
          corpo="Entregamos o seu processo na Polícia Federal. A partir daqui a análise é deles."
          ultimo={cronologica.length === 0}
          tom="feito"
        />

        {cronologica.map((m, i) => {
          const negativa = String(m.status_processo ?? "").toLowerCase().includes("indeferido");
          return (
            <Degrau
              key={`${dataDoDegrau(m)}-${i}`}
              titulo={TIPO_ROTULO[String(m.tipo ?? "").toLowerCase()] ?? "Documento da Polícia Federal"}
              data={dataDoDegrau(m)}
              corpo={m.texto}
              // O texto do delegado é longo. Aqui vai um trecho; o painel do
              // protocolo mostra na íntegra, e é para lá que o botão leva.
              truncar
              prazo={
                m.prazo_limite || m.prazo_dias
                  ? `Prazo para responder${m.prazo_dias ? `: ${m.prazo_dias} dias` : ""}${m.prazo_limite ? ` — até ${fmtData(m.prazo_limite)}` : ""}`
                  : null
              }
              assinatura={
                m.delegado_nome
                  ? `${m.delegado_nome}${m.delegado_cargo ? ` · ${m.delegado_cargo}` : ""}`
                  : null
              }
              ultimo={i === cronologica.length - 1}
              tom={negativa ? "ruim" : "feito"}
            />
          );
        })}
      </ol>

      {/*
        O RECURSO VEM ANTES DO RESTO. Existindo texto para o cliente aprovar,
        isso é a coisa mais importante da tela — corre prazo de 10 dias, e a
        peça não é escrita enquanto ele não confirmar que os fatos são dele.
      */}
      {recurso && (
        <div className="px-4 pb-1">
          <RecursoAprovacaoPanel
            recurso={recurso}
            delegadoNome={negouRecurso?.delegado_nome ?? cronologica[cronologica.length - 1]?.delegado_nome ?? null}
            onAprovado={onRecursoAprovado}
          />
        </div>
      )}

      {onAbrirDetalhe && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button
            type="button"
            onClick={onAbrirDetalhe}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8A1224] hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Ver o texto completo da Polícia Federal
          </button>
        </div>
      )}

      {/*
        MANDADO DE SEGURANÇA — só depois do recurso negado, e só enquanto os 120
        dias correm. Vencido o prazo, o convite some: manter um botão que já não
        leva a lugar nenhum é pior do que não ter botão.
      */}
      {janelaMS?.aberta && (
        <div className="border-t-2 border-[#8A1224] bg-[#FBF3F4] px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B]">
            <Scale className="h-3.5 w-3.5" />
            Ainda existe um caminho: o juiz
          </p>
          <p className="mt-1 text-[12px] leading-snug text-slate-800">
            O seu recurso foi negado, e com isso a via administrativa se encerrou. A partir daqui
            quem pode rever a decisão da Polícia Federal é o Poder Judiciário, por{" "}
            <strong>mandado de segurança</strong> — uma ação redigida e assinada pelo nosso
            advogado, que leva a decisão do delegado para análise de um juiz.
          </p>
          <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-white px-2.5 py-2 text-[11px] leading-snug text-slate-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              São <strong>120 dias</strong> contados do dia em que o recurso foi negado, e este
              prazo não para nem se estende. Vence em <strong>{fmtData(janelaMS.dataLimite)}</strong>
              {" — faltam "}
              <strong>{janelaMS.diasRestantes} dias</strong>. Passado o prazo, essa porta fecha em
              definitivo.
            </span>
          </p>
          <p className="mt-2 text-[11px] leading-snug text-slate-600">
            Não é obrigatório e não é automático — é uma decisão sua. Se quiser conversar, é só
            escolher uma frase abaixo:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FRASES_MS.map((frase, i) => (
              <a
                key={frase}
                href={linkWhatsAppMS(frase, contexto)}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-bold",
                  i === 0
                    ? "bg-[#8A1224] text-white hover:bg-[#6f0f1e]"
                    : "border border-[#E5C2C6] bg-white text-[#7A1F2B] hover:bg-[#FBF3F4]",
                ].join(" ")}
              >
                {i === 0 ? <Gavel className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                {frase}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Degrau({
  titulo,
  data,
  corpo,
  prazo,
  assinatura,
  ultimo,
  tom,
  truncar,
}: {
  titulo: string;
  data?: string | null;
  corpo: string;
  prazo?: string | null;
  assinatura?: string | null;
  ultimo: boolean;
  tom: "feito" | "ruim";
  truncar?: boolean;
}) {
  return (
    <li className="flex gap-2.5 pb-3 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          className={[
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            tom === "ruim" ? "bg-rose-600" : "bg-emerald-600",
          ].join(" ")}
        />
        {!ultimo && <span className="mt-1 w-px flex-1 bg-slate-200" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
          {titulo}
          <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-400">
            {fmtData(data)}
          </span>
        </p>
        {prazo && (
          <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold leading-snug text-amber-900">
            {prazo}. Não responda sozinho — nós preparamos a resposta.
          </p>
        )}
        <p
          className={[
            "mt-1 whitespace-pre-wrap text-[11px] leading-snug text-slate-600",
            truncar ? "line-clamp-4" : "",
          ].join(" ")}
        >
          {corpo}
        </p>
        {assinatura && <p className="mt-1 text-[10px] text-slate-400">{assinatura}</p>}
      </div>
    </li>
  );
}
