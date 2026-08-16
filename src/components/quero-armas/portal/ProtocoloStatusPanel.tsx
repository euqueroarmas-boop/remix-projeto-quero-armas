// ============================================================================
// ProtocoloStatusPanel — "onde está o meu processo" depois de protocolado
// ----------------------------------------------------------------------------
// Protocolado o processo, o card da home deixa de convidar para tarefa e vira
// "Protocolado". Clicando, o cliente cai aqui.
//
// O que ele quer saber nesse momento é sempre a mesma coisa: qual é o número,
// quando foi, em que delegacia e o que acontece agora. Sem isso ele volta a
// perguntar no WhatsApp — que é o custo que este painel existe para eliminar.
//
// A régua de status usa o vocabulário REAL da Polícia Federal, lido no
// histórico do SINARM: "distribuído na Polícia Federal, Em Análise",
// "recebido na Polícia Federal, Notificado", "Indeferido", "Recurso". Não
// inventamos nome de etapa — o cliente que abrir o site da PF vai ver as
// mesmas palavras.
//
// AVISO DO E-MAIL: a delegacia notifica por e-mail direto ao requerente. Já
// vimos notificação real dando 10 dias para responder por e-mail, sob pena de
// arquivamento. Cliente que só olha o portal perde prazo.
// ============================================================================

import { AlertTriangle, CheckCircle2, Clock, Mail, MapPin } from "lucide-react";

/** Etapas do processo na Polícia Federal, na ordem em que acontecem. */
const REGUA: Array<{ chave: string; titulo: string; descricao: string }> = [
  {
    chave: "protocolado",
    titulo: "Protocolado",
    descricao: "Entregamos o seu processo. A partir daqui ele está na fila da Polícia Federal.",
  },
  {
    chave: "em_analise",
    titulo: "Em análise pela PF",
    descricao: "Um delegado está conferindo a sua documentação e a sua justificativa.",
  },
  {
    chave: "notificado",
    titulo: "Notificado",
    descricao:
      "A PF pediu algo a mais — documento, esclarecimento ou comparecimento. O prazo costuma ser de 10 dias.",
  },
  {
    chave: "decisao",
    titulo: "Deferido ou indeferido",
    descricao:
      "A decisão sai com a fundamentação. Se for indeferido, há 10 dias para recorrer, e nós cuidamos disso.",
  },
];

export interface ProtocoloStatusPanelProps {
  numeroProtocolo?: string | null;
  dataProtocolo?: string | null;
  /** Nome/sigla da delegacia que recebeu o processo. */
  delegacia?: string | null;
  /** Status atual do processo, no vocabulário do sistema. */
  status?: string | null;
}

function fmtData(v?: string | null): string {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}

/** Em qual degrau da régua o processo está. */
function etapaAtual(status?: string | null): number {
  const s = String(status ?? "").trim().toLowerCase();
  if (["deferido", "indeferido", "concluido"].includes(s)) return 3;
  if (s === "notificado") return 2;
  if (["em_analise_orgao", "em_analise", "recurso_administrativo"].includes(s)) return 1;
  return 0; // protocolado
}

function rotuloStatus(status?: string | null): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "deferido") return "Deferido";
  if (s === "indeferido") return "Indeferido";
  if (s === "notificado") return "Notificado — a PF pediu algo a mais";
  if (s === "recurso_administrativo") return "Recurso protocolado, em análise";
  if (s === "em_analise_orgao" || s === "em_analise") return "Em análise pela Polícia Federal";
  return "Protocolado — em análise na delegacia";
}

export default function ProtocoloStatusPanel({
  numeroProtocolo,
  dataProtocolo,
  delegacia,
  status,
}: ProtocoloStatusPanelProps) {
  const atual = etapaAtual(status);

  return (
    <div className="space-y-3">
      {/* Cabeçalho: o estado em uma frase */}
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-sky-900">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {rotuloStatus(status)}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-sky-900">
          O seu processo já está na Polícia Federal. Não há nada pendente com você agora — a
          análise é deles.
        </p>
      </div>

      {/* Os três dados que ele procura */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          <div className="px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Número do protocolo
            </p>
            <p className="break-all font-mono text-[13px] font-semibold text-slate-900">
              {numeroProtocolo || "—"}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
              <Clock className="h-3 w-3" /> Protocolado em
            </p>
            <p className="text-[13px] font-semibold text-slate-900">{fmtData(dataProtocolo)}</p>
          </div>
          <div className="px-3 py-2">
            <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
              <MapPin className="h-3 w-3" /> Delegacia
            </p>
            <p className="text-[13px] font-semibold text-slate-900">
              {delegacia || "Polícia Federal"}
            </p>
          </div>
        </div>
      </section>

      {/* Régua do que vem pela frente */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700">
            O que acontece a partir de agora
          </h4>
        </header>
        <ol className="p-3">
          {REGUA.map((etapa, i) => {
            const passado = i < atual;
            const agora = i === atual;
            return (
              <li key={etapa.chave} className="flex gap-2.5 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={[
                      "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      agora ? "bg-[#8A1224] ring-4 ring-[#8A1224]/15" : passado ? "bg-emerald-600" : "bg-slate-300",
                    ].join(" ")}
                  />
                  {i < REGUA.length - 1 && (
                    <span className={["mt-1 w-px flex-1", passado ? "bg-emerald-300" : "bg-slate-200"].join(" ")} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-[11px] font-bold uppercase tracking-[0.06em]",
                      agora ? "text-[#8A1224]" : passado ? "text-emerald-800" : "text-slate-400",
                    ].join(" ")}
                  >
                    {etapa.titulo}
                    {agora && " · você está aqui"}
                  </p>
                  <p className={["mt-0.5 text-[11px] leading-snug", agora ? "text-slate-700" : "text-slate-500"].join(" ")}>
                    {etapa.descricao}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-600">
          Qualquer mudança nós avisamos aqui: se for notificado, mostramos exatamente o que a
          Polícia Federal pediu; se for deferido ou indeferido, mostramos a decisão e o que fazer
          em seguida.
        </p>
      </section>

      {/* O aviso que evita perda de prazo */}
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900">
          <Mail className="h-3.5 w-3.5" />
          Fique de olho no seu e-mail
        </p>
        <p className="mt-1 text-[12px] font-semibold leading-snug text-amber-900">
          A Polícia Federal também escreve direto para você, no e-mail do seu cadastro. As
          notificações costumam dar <span className="underline">10 dias</span> para responder, e
          quem perde o prazo tem o requerimento arquivado. Confira a caixa de entrada e o spam,
          e nos avise assim que receber qualquer coisa da PF.
        </p>
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Não responda sozinho: mande para a gente e nós redigimos a resposta.</span>
        </p>
      </div>
    </div>
  );
}
