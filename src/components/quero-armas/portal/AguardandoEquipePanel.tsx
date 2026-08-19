import { CheckCircle2, Circle, Loader2 } from "lucide-react";

/* =============================================================================
 * "Sua parte acabou. Agora é com a gente."
 * -----------------------------------------------------------------------------
 * POR QUE ESTA TELA EXISTE
 *
 * O cliente entrega o último documento e o portal ficava mudo: ou dizia "sem
 * pendências" (e ele não sabia que ainda faltava a defesa, a aprovação dele e o
 * protocolo), ou mostrava quatro linhas amarelas escritas PENDENTE — que ele lê
 * como dívida dele, quando nenhuma delas depende de nada que ele possa fazer.
 *
 * As duas leituras terminam na mesma mensagem no WhatsApp: "e agora?".
 *
 * Aqui o processo fala. O cliente vê onde está, o que a equipe está fazendo, o
 * que vai pedir dele em seguida e quais passos ainda vão abrir — pelo nome,
 * para não parecer que sumiram.
 * ============================================================================= */

export interface PassoAguardando {
  id: string;
  nome: string;
}

export default function AguardandoEquipePanel({
  passos,
  nomeServico,
}: {
  /** Passos que ainda vão abrir, na ordem, com o nome que o cliente já viu. */
  passos: PassoAguardando[];
  nomeServico?: string | null;
}) {
  const etapas = [
    {
      estado: "agora" as const,
      titulo: "Montamos a sua defesa",
      texto:
        "A nossa equipe está escrevendo a petição que acompanha o seu processo e conferindo, uma a uma, todas as peças que você entregou.",
    },
    {
      estado: "proximo" as const,
      titulo: "Você lê e aprova",
      texto:
        "Quando a petição estiver pronta, ela aparece aqui para você ler. Nada é enviado à Polícia Federal antes de você aprovar.",
    },
    {
      estado: "depois" as const,
      titulo: "Liberamos os últimos passos",
      texto:
        "Só depois da sua aprovação abrimos os passos abaixo — inclusive o boleto da taxa. Não pague nada antes disso.",
    },
    {
      estado: "depois" as const,
      titulo: "Protocolamos na Polícia Federal",
      texto: "Com a juntada assinada por você, o processo entra na delegacia.",
    },
  ];

  return (
    <div className="rounded-sm border border-[#E5E5E5] bg-white">
      <div className="border-b border-[#EEEEEE] px-5 py-4">
        <div className="qa-eyebrow" style={{ color: "#1F6F43" }}>
          {nomeServico ? String(nomeServico).toUpperCase() : "SEU PROCESSO"}
        </div>
        <div className="qa-h3 mt-1 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          SUA PARTE ESTÁ COMPLETA
        </div>
        <p className="qa-kpi-sub mt-1.5" style={{ color: "#2F3337" }}>
          Você entregou tudo o que era com você. Agora é com a nossa equipe —
          não há nada para você fazer neste momento.
        </p>
      </div>

      <ol className="divide-y divide-[#F0F0F0]">
        {etapas.map((e, i) => (
          <li key={e.titulo} className="flex gap-3 px-5 py-3.5">
            <span className="mt-[2px] shrink-0">
              {e.estado === "agora" ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#7A1F2B]" />
              ) : (
                <Circle className="h-4 w-4 text-[#C9C9C9]" />
              )}
            </span>
            <div className="min-w-0">
              <div
                className="qa-h3"
                style={{ color: e.estado === "agora" ? "#0A0A0A" : "#6A6A6A" }}
              >
                {i + 1}. {e.titulo}
                {e.estado === "agora" ? (
                  <span
                    className="qa-eyebrow ml-2 rounded-sm px-1.5 py-[2px] align-middle"
                    style={{ background: "#7A1F2B", color: "#FFFFFF" }}
                  >
                    AGORA
                  </span>
                ) : null}
              </div>
              <p className="qa-kpi-sub mt-1" style={{ color: "#2F3337" }}>
                {e.texto}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {passos.length > 0 ? (
        <div className="border-t border-[#EEEEEE] px-5 py-4">
          <div className="qa-eyebrow">O QUE AINDA VAI ABRIR PARA VOCÊ</div>
          <ul className="mt-2 space-y-1.5">
            {passos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="qa-kpi-sub min-w-0 truncate" style={{ color: "#2F3337" }}>
                  {p.nome}
                </span>
                <span
                  className="qa-eyebrow shrink-0 rounded-sm px-2 py-1"
                  style={{ background: "#EFEFEF", color: "#4A4A4A" }}
                >
                  COM A EQUIPE
                </span>
              </li>
            ))}
          </ul>
          <p className="qa-caption mt-3" style={{ color: "#6A6A6A" }}>
            Eles continuam no seu checklist de propósito: não sumiram, só ainda
            não chegou a hora.
          </p>
        </div>
      ) : null}
    </div>
  );
}
