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

import { AlertTriangle, CheckCircle2, Clock, FileText, Mail, MapPin } from "lucide-react";

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

/** O que a Polícia Federal escreveu, copiado do SINARM pela equipe. */
export interface ManifestacaoPF {
  tipo?: string | null;
  /**
   * Para onde o processo foi com este documento. É o campo que distingue
   * "indeferido no pedido" de `recurso_indeferido` — e é essa distinção que
   * decide se ainda cabe recurso ou se o caminho que resta é o juiz.
   */
  status_processo?: string | null;
  texto: string;
  delegado_nome?: string | null;
  delegado_cargo?: string | null;
  unidade_pf?: string | null;
  data_documento?: string | null;
  prazo_dias?: number | null;
  prazo_limite?: string | null;
  canal_resposta?: string | null;
  contato?: string | null;
  created_at?: string | null;
  /**
   * Leitura da IA sobre este documento: o que a PF disse, os riscos concretos
   * de não cumprir e o que precisa ser juntado de novo. Ausente enquanto a
   * análise não roda — e o painel funciona sem ela.
   */
  analise_ia_json?: {
    resumo_para_cliente?: string;
    o_que_a_pf_disse?: string[];
    riscos?: string[];
    natureza?: string;
  } | null;
}

const TIPO_ROTULO: Record<string, string> = {
  notificacao: "Notificação da Polícia Federal",
  parecer: "Parecer do delegado",
  manifestacao: "Manifestação da Polícia Federal",
  decisao: "Decisão da Polícia Federal",
};

const CANAL_ROTULO: Record<string, string> = {
  sistema: "pelo próprio site da Polícia Federal",
  email: "por e-mail para a delegacia",
  presencial: "presencialmente, na delegacia",
};

export interface ProtocoloStatusPanelProps {
  numeroProtocolo?: string | null;
  dataProtocolo?: string | null;
  /** Nome/sigla da delegacia que recebeu o processo. */
  delegacia?: string | null;
  /** Status atual do processo, no vocabulário do sistema. */
  status?: string | null;
  /**
   * Textos da PF, do mais recente para o mais antigo. Vêm do SINARM, copiados
   * pela equipe com o acesso do próprio cliente.
   */
  manifestacoes?: ManifestacaoPF[];
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
  manifestacoes = [],
}: ProtocoloStatusPanelProps) {
  const atual = etapaAtual(status);
  const ultima = manifestacoes[0] ?? null;

  return (
    <div className="space-y-3">
      {/* Cabeçalho: o estado em uma frase */}
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-sky-900">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {rotuloStatus(status)}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-sky-900">
          {ultima
            ? "A Polícia Federal se manifestou no seu processo. O texto dela está logo abaixo, na íntegra."
            : "O seu processo já está na Polícia Federal. Não há nada pendente com você agora — a análise é deles."}
        </p>
      </div>

      {/*
        O QUE A PF ESCREVEU — só aparece quando a equipe já copiou do SINARM.
        Vem antes de tudo porque, existindo, é a informação que importa: é o
        texto do delegado, palavra por palavra, e é dele que sai o prazo.
      */}
      {ultima && (
        <section className="overflow-hidden rounded-lg border-2 border-[#8A1224] bg-white">
          <header className="border-b border-[#E5C2C6] bg-[#FBF3F4] px-3 py-2">
            <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B]">
              <FileText className="h-3.5 w-3.5" />
              {TIPO_ROTULO[String(ultima.tipo ?? "").toLowerCase()] ?? "Documento da Polícia Federal"}
            </h4>
            <p className="mt-0.5 text-[10px] text-[#7A1F2B]">
              {ultima.data_documento ? `Emitido em ${fmtData(ultima.data_documento)}. ` : ""}
              Copiado do sistema da Polícia Federal pela nossa equipe.
            </p>
          </header>

          {(ultima.prazo_limite || ultima.prazo_dias) && (
            <div className="border-b border-slate-100 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-bold leading-snug text-amber-900">
                Prazo para responder
                {ultima.prazo_dias ? `: ${ultima.prazo_dias} dias` : ""}
                {ultima.prazo_limite ? ` — até ${fmtData(ultima.prazo_limite)}` : ""}
                {ultima.canal_resposta
                  ? `, ${CANAL_ROTULO[String(ultima.canal_resposta).toLowerCase()] ?? String(ultima.canal_resposta)}`
                  : ""}
                .
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-900">
                Não precisa fazer nada sozinho — nós preparamos a resposta. Perder este prazo faz
                o requerimento ser arquivado.
              </p>
            </div>
          )}

          {/*
            TRADUÇÃO ANTES DO ORIGINAL. O texto do delegado é juridiquês denso:
            o cliente lê duas linhas, não entende, e liga para a equipe
            perguntando "isso é ruim?". O resumo responde essa pergunta em
            três frases. Ele vem ANTES, e não no lugar — o original continua
            logo abaixo, inteiro, porque é ele que vale como prova.
          */}
          {ultima.analise_ia_json?.resumo_para_cliente && (
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Em poucas palavras
              </p>
              <p className="mt-1 text-[12px] font-semibold leading-snug text-slate-800">
                {ultima.analise_ia_json.resumo_para_cliente}
              </p>
              {(ultima.analise_ia_json.o_que_a_pf_disse ?? []).length > 0 && (
                <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-slate-700">
                  {(ultima.analise_ia_json.o_que_a_pf_disse ?? []).slice(0, 5).map((x, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-[10px] text-slate-500">
                Resumo automático. O texto oficial, na íntegra, está logo abaixo.
              </p>
            </div>
          )}

          {/*
            `whitespace-pre-wrap` de propósito: o texto é colado como veio do
            SINARM, com as quebras de linha do delegado. Reformatar mudaria a
            leitura de um documento que é prova.
          */}
          <p className="whitespace-pre-wrap px-3 py-2.5 text-[12px] leading-relaxed text-slate-800">
            {ultima.texto}
          </p>

          {(ultima.delegado_nome || ultima.unidade_pf) && (
            <p className="border-t border-slate-100 px-3 py-2 text-[10px] leading-snug text-slate-500">
              {ultima.delegado_nome}
              {ultima.delegado_cargo ? ` · ${ultima.delegado_cargo}` : ""}
              {ultima.unidade_pf ? ` · ${ultima.unidade_pf}` : ""}
            </p>
          )}

          {manifestacoes.length > 1 && (
            <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
              Há {manifestacoes.length - 1} documento(s) anterior(es) neste processo.
            </p>
          )}
        </section>
      )}

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
