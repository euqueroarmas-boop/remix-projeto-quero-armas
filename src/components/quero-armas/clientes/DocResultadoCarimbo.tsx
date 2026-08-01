/**
 * DocResultadoCarimbo — carimbo grande e escandaloso exibido no centro da tela
 * ao concluir o envio de um documento no Hub Documental.
 *
 * Substitui o toast discreto: APROVADO (verde, com %), EM ANÁLISE (âmbar)
 * e REPROVADO (vermelho).
 */
import { useEffect } from "react";
import { AlertTriangle, Check, Clock } from "lucide-react";

export type DocResultadoTipo = "aprovado" | "analise" | "reprovado";

const CORES: Record<DocResultadoTipo, { cor: string; bg: string; titulo: string; sub: string }> = {
  aprovado: { cor: "#15803D", bg: "rgba(21,128,61,0.10)", titulo: "APROVADO", sub: "ADICIONADO AO SEU HUB" },
  analise: { cor: "#B45309", bg: "rgba(180,83,9,0.10)", titulo: "EM ANÁLISE", sub: "AGUARDANDO A EQUIPE" },
  reprovado: { cor: "#B91C1C", bg: "rgba(185,28,28,0.10)", titulo: "REPROVADO", sub: "NÃO PODE SER ACEITO" },
};

export default function DocResultadoCarimbo({
  tipo,
  percentual,
  mensagem,
  onDone,
  duracaoMs = 2200,
}: {
  tipo: DocResultadoTipo;
  percentual?: number | null;
  mensagem?: string | null;
  onDone: () => void;
  duracaoMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duracaoMs);
    return () => clearTimeout(t);
  }, [onDone, duracaoMs]);

  const c = CORES[tipo];
  const Icone = tipo === "aprovado" ? Check : tipo === "analise" ? Clock : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-6"
      onClick={onDone}
      role="status"
      aria-live="polite"
    >
      <style>{`@keyframes qaCarimboIn{0%{opacity:0;transform:scale(1.6) rotate(-18deg)}60%{opacity:1;transform:scale(.94) rotate(-9deg)}100%{opacity:1;transform:scale(1) rotate(-11deg)}}`}</style>
      <div
        className="flex flex-col items-center gap-3 bg-white px-10 py-8 text-center"
        style={{
          border: `10px solid ${c.cor}`,
          borderRadius: 10,
          color: c.cor,
          fontFamily: "'Oswald', sans-serif",
          boxShadow: `0 24px 60px rgba(0,0,0,.45)`,
          animation: "qaCarimboIn .45s cubic-bezier(.2,.9,.3,1) both",
          background: `linear-gradient(${c.bg}, ${c.bg}), #fff`,
        }}
      >
        <Icone className="h-14 w-14" strokeWidth={3} />
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 0.9, letterSpacing: ".04em" }}>
          {c.titulo}
        </div>
        {tipo === "aprovado" && percentual != null && (
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 0.85, letterSpacing: "-.02em" }}>
            {percentual}%
          </div>
        )}
        <div style={{ fontSize: 13, letterSpacing: ".3em", fontWeight: 600 }}>
          {(mensagem || c.sub).toUpperCase()}
        </div>
      </div>
    </div>
  );
}
