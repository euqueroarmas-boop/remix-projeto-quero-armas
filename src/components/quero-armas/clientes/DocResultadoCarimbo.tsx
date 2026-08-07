/**
 * DocResultadoCarimbo — carimbo discreto exibido ao concluir o envio de um
 * documento no Hub Documental. Mantém as variantes APROVADO, EM ANÁLISE e
 * REPROVADO, porém em escala reduzida e sem estourar a tela.
 */
import { AlertTriangle, Check, Clock } from "lucide-react";
import { corStatusDocumento, labelStatusDocumento } from "@/lib/quero-armas/statusDocumento";

export type DocResultadoTipo = "aprovado" | "analise" | "reprovado";

/** BLOCO 5 — título e cor vêm do dicionário canônico; aqui só o subtítulo. */
const CANONICO: Record<DocResultadoTipo, string> = {
  aprovado: "aprovado",
  analise: "em_analise",
  reprovado: "reprovado",
};
const SUBTITULOS: Record<DocResultadoTipo, string> = {
  aprovado: "PARABÉNS · VAMOS PARA A PRÓXIMA EXIGÊNCIA",
  analise: "SERÁ ANALISADO PELO NOSSO TIME",
  reprovado: "NÃO PODE SER ACEITO",
};
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
const CORES: Record<DocResultadoTipo, { cor: string; bg: string; titulo: string; sub: string }> =
  (Object.keys(CANONICO) as DocResultadoTipo[]).reduce((acc, tipo) => {
    const cor = corStatusDocumento(CANONICO[tipo]);
    acc[tipo] = { cor, bg: hexToRgba(cor, 0.1), titulo: labelStatusDocumento(CANONICO[tipo]), sub: SUBTITULOS[tipo] };
    return acc;
  }, {} as Record<DocResultadoTipo, { cor: string; bg: string; titulo: string; sub: string }>);

function quebrarMensagem(msg: string): string[] {
  if (!msg) return [];
  // Prioriza quebrar em em-dash, depois no marcador "mais recente", e por
  // fim divide por frase para manter a leitura confortável em carimbos pequenos.
  if (msg.includes(" — ")) return msg.split(" — ");
  if (msg.includes("mais recente")) {
    const idx = msg.indexOf("mais recente");
    return [msg.slice(0, idx + "mais recente".length).trim(), msg.slice(idx + "mais recente".length).trim()];
  }
  return [msg];
}

export default function DocResultadoCarimbo({
  tipo,
  percentual,
  mensagem,
  onDone,
}: {
  tipo: DocResultadoTipo;
  percentual?: number | null;
  mensagem?: string | null;
  onDone: () => void;
}) {
  const c = CORES[tipo];
  const Icone = tipo === "aprovado" ? Check : tipo === "analise" ? Clock : AlertTriangle;
  const linhas = quebrarMensagem(mensagem || c.sub);

  return (
    <div
      style={{ pointerEvents: "auto" }}
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45 p-4"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onDone();
      }}
      role="status"
      aria-live="polite"
    >
      <style>{`@keyframes qaCarimboIn{0%{opacity:0;transform:scale(1.25) rotate(-6deg)}60%{opacity:1;transform:scale(.96) rotate(-3deg)}100%{opacity:1;transform:scale(1) rotate(-4deg)}}`}</style>
      <div
        className="flex flex-col items-center gap-3 bg-white px-8 py-6 text-center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: 510,
          width: "100%",
          border: `6px solid ${c.cor}`,
          borderRadius: 10,
          color: c.cor,
          fontFamily: "'Oswald', sans-serif",
          boxShadow: "0 18px 44px rgba(0,0,0,.35)",
          animation: "qaCarimboIn .35s cubic-bezier(.2,.9,.3,1) both",
          background: `linear-gradient(${c.bg}, ${c.bg}), #fff`,
        }}
      >
        <Icone className="h-12 w-12" strokeWidth={2.5} />
        <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, letterSpacing: ".08em" }}>
          {c.titulo}
        </div>
        {tipo === "aprovado" && percentual != null && (
          <div style={{ fontSize: 63, fontWeight: 700, lineHeight: 0.9, letterSpacing: "-.02em" }}>
            {percentual}%
          </div>
        )}
        <div className="flex flex-col gap-1" style={{ fontSize: 18, letterSpacing: ".08em", fontWeight: 600, lineHeight: 1.35 }}>
          {linhas.map((linha, i) => (
            <span key={i}>{linha.toUpperCase()}</span>
          ))}
        </div>
      </div>

    </div>
  );
}

