// ============================================================================
// AvisoExigenciaPF — por que este passo apareceu, e o que acontece se falhar
// ----------------------------------------------------------------------------
// Quando a Polícia Federal notifica ou indefere, a IA lê o texto do delegado e
// abre exigências novas no checklist. Sem contexto, o cliente vê passos que ele
// jurava ter concluído voltarem do nada — e a reação é ligar para a equipe
// perguntando se o sistema quebrou.
//
// Este aviso responde as três perguntas dele, nesta ordem: quem pediu, o que
// acontece se não cumprir, e até quando.
//
// ── SOBRE O TOM ─────────────────────────────────────────────────────────────
// O risco é dito com todas as letras porque é verdadeiro: perder o prazo faz o
// requerimento ser arquivado e a taxa paga não volta. Amaciar isso para "não
// assustar" produz cliente que perde prazo achando que dava para deixar para a
// semana que vem. O que NÃO se faz é inventar urgência onde não há — por isso
// o prazo só aparece quando a PF de fato escreveu um.
//
// ── O NOME DO DELEGADO ──────────────────────────────────────────────────────
// Aparece quando o texto traz. "O delegado Fulano pediu" é lido como uma pessoa
// tendo pedido algo; "a autoridade determinou" é lido como formulário. A
// diferença aparece na taxa de resposta.
// ============================================================================

import { AlertTriangle, Clock } from "lucide-react";

export interface AvisoExigenciaPFProps {
  /** Nome de quem assinou o documento na PF, quando o texto traz. */
  delegadoNome?: string | null;
  /** Data limite para responder (ISO), quando a PF escreveu prazo. */
  prazoLimite?: string | null;
  /** Dias restantes até o prazo. Negativo = já passou. */
  diasRestantes?: number | null;
  /** Riscos concretos, extraídos pela IA do próprio texto do delegado. */
  riscos?: string[];
  /** O documento é uma decisão de indeferimento (muda a frase de abertura). */
  indeferido?: boolean;
}

function fmt(v?: string | null): string {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export default function AvisoExigenciaPF({
  delegadoNome,
  prazoLimite,
  diasRestantes,
  riscos = [],
  indeferido = false,
}: AvisoExigenciaPFProps) {
  const quem = delegadoNome?.trim()
    ? `O delegado ${delegadoNome.trim()}`
    : "A Polícia Federal";

  // Vermelho quando o prazo aperta ou o pedido já foi negado; âmbar no resto.
  const urgente = indeferido || (typeof diasRestantes === "number" && diasRestantes <= 4);
  const cor = urgente
    ? { borda: "border-[#8A1224]", fundo: "bg-[#FBF3F4]", texto: "text-[#7A1F2B]" }
    : { borda: "border-amber-400", fundo: "bg-amber-50", texto: "text-amber-900" };

  return (
    <div className={`mt-3 rounded-lg border-2 ${cor.borda} ${cor.fundo} p-3`}>
      <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${cor.texto}`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {indeferido ? "Este passo veio do indeferimento" : "Este passo veio da Polícia Federal"}
      </p>

      <p className={`mt-1 text-[12px] font-semibold leading-snug ${cor.texto}`}>
        {quem}{" "}
        {indeferido
          ? "negou o seu pedido e apontou o que faltou. Para recorrer, precisamos disto — um recurso que só repete o que já foi entregue é negado de novo."
          : "analisou o seu processo e pediu isto. Enquanto não enviar, a análise fica parada."}
      </p>

      {riscos.length > 0 && (
        <ul className={`mt-2 space-y-1 text-[11px] leading-snug ${cor.texto}`}>
          {riscos.slice(0, 3).map((r, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/*
        O prazo só aparece quando existe. Inventar contagem onde a PF não deu
        prazo treinaria o cliente a desconfiar do número quando ele for real.
      */}
      {prazoLimite && (
        <p className={`mt-2 flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold ${cor.texto}`}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {typeof diasRestantes === "number" && diasRestantes < 0 ? (
            <span>O prazo venceu em {fmt(prazoLimite)}. Envie assim mesmo e fale com a equipe hoje.</span>
          ) : (
            <span>
              Prazo até {fmt(prazoLimite)}
              {typeof diasRestantes === "number" ? ` — faltam ${diasRestantes} dia(s)` : ""}. Perder o
              prazo faz o requerimento ser arquivado, e a taxa paga não volta.
            </span>
          )}
        </p>
      )}

      <p className={`mt-1.5 text-[11px] leading-snug ${cor.texto}`}>
        Você só precisa enviar o arquivo — a resposta à Polícia Federal quem escreve somos nós.
      </p>
    </div>
  );
}
