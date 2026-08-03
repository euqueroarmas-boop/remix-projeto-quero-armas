import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Sparkles } from "lucide-react";

interface Persona {
  humor: number;
  seriedade: number;
  preocupacao: number;
  min_caracteres: number;
  max_caracteres: number;
  regras_extras: string;
}

const PADRAO: Persona = {
  humor: 50,
  seriedade: 75,
  preocupacao: 90,
  min_caracteres: 180,
  max_caracteres: 400,
  regras_extras: "",
};

const SLIDERS: { key: keyof Persona; label: string; ajuda: string }[] = [
  { key: "humor", label: "Senso de humor", ajuda: "Leveza e descontração nas respostas." },
  { key: "seriedade", label: "Senso de seriedade", ajuda: "Firmeza e responsabilidade no tom." },
  { key: "preocupacao", label: "Preocupação com o cliente", ajuda: "Acolhimento da dor e da urgência." },
];

export default function QAKlalPersonaAdmin() {
  const [dados, setDados] = useState<Persona>(PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("qa_klal_persona")
        .select("humor,seriedade,preocupacao,min_caracteres,max_caracteres,regras_extras")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setDados({
          humor: data.humor ?? PADRAO.humor,
          seriedade: data.seriedade ?? PADRAO.seriedade,
          preocupacao: data.preocupacao ?? PADRAO.preocupacao,
          min_caracteres: data.min_caracteres ?? PADRAO.min_caracteres,
          max_caracteres: data.max_caracteres ?? PADRAO.max_caracteres,
          regras_extras: data.regras_extras ?? "",
        });
      }
      setCarregando(false);
    })();
  }, []);

  async function salvar() {
    if (dados.min_caracteres >= dados.max_caracteres) {
      toast.error("O mínimo de caracteres deve ser menor que o máximo.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("qa_klal_persona")
      .upsert({ id: 1, ...dados, atualizado_em: new Date().toISOString() });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar a personalidade do Klal.");
      return;
    }
    toast.success("Personalidade do Klal atualizada.");
  }

  if (carregando) {
    return (
      <div className="qa-card p-5 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando personalidade do Klal…
      </div>
    );
  }

  return (
    <div className="qa-card p-5 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
          Personalidade do Klal
        </span>
      </div>
      <p className="text-sm text-slate-500 -mt-3">
        Ajuste como o Klal conversa com o cliente. As mudanças valem para as próximas respostas, sem alterar as travas jurídicas.
      </p>

      <div className="space-y-5">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] font-semibold text-slate-800">{s.label}</label>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: "hsl(352 60% 30%)" }}>
                {dados[s.key] as number}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={dados[s.key] as number}
              onChange={(e) => setDados((d) => ({ ...d, [s.key]: Number(e.target.value) }))}
              className="w-full accent-[#7A1F2B]"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">{s.ajuda}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[13px] font-semibold text-slate-800">Mínimo de caracteres</label>
          <input
            type="number"
            min={80}
            max={2000}
            value={dados.min_caracteres}
            onChange={(e) => setDados((d) => ({ ...d, min_caracteres: Number(e.target.value) }))}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-slate-800">Máximo de caracteres</label>
          <input
            type="number"
            min={120}
            max={4000}
            value={dados.max_caracteres}
            onChange={(e) => setDados((d) => ({ ...d, max_caracteres: Number(e.target.value) }))}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-[13px] font-semibold text-slate-800">Regras adicionais de tom (opcional)</label>
        <textarea
          rows={5}
          value={dados.regras_extras}
          onChange={(e) => setDados((d) => ({ ...d, regras_extras: e.target.value }))}
          placeholder="Ex.: sempre chamar o cliente pelo primeiro nome; nunca prometer prazo de deferimento."
          className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[12px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-60"
        style={{ background: "#7A1F2B" }}
      >
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar personalidade
      </button>
    </div>
  );
}