import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Palette, Monitor, LayoutTemplate } from "lucide-react";

// Dimensões exatas das colunas em pixels
const SIDEBAR_LEFT_EXPANDED_PX = 190;
const SIDEBAR_LEFT_COLLAPSED_PX = 68;
const RAIL_RIGHT_PX = 56;

// Paleta CMYK-inspirada para os ícones do rail direito
const RAIL_COLOR_PALETTE = [
  // Linha 1 — Neutros e base
  { label: "Branco", hex: "#FFFFFF" },
  { label: "Prata", hex: "#C0C0C0" },
  { label: "Cinza médio", hex: "#9a9a9a" },
  { label: "Chumbo", hex: "#555555" },
  { label: "Preto", hex: "#1a1a1a" },
  // Linha 2 — Ciano (C)
  { label: "Ciano claro", hex: "#A8E6EF" },
  { label: "Ciano", hex: "#00BCD4" },
  { label: "Ciano escuro", hex: "#0097A7" },
  { label: "Azul ciano", hex: "#006E8C" },
  { label: "Azul petróleo", hex: "#004B5A" },
  // Linha 3 — Magenta (M)
  { label: "Rosa claro", hex: "#F8BBD0" },
  { label: "Rosa", hex: "#E91E8C" },
  { label: "Magenta", hex: "#C2185B" },
  { label: "Bordô", hex: "#7A1F2B" },
  { label: "Bordô escuro", hex: "#4E0B14" },
  // Linha 4 — Amarelo (Y)
  { label: "Amarelo claro", hex: "#FFF9C4" },
  { label: "Amarelo", hex: "#FFEB3B" },
  { label: "Dourado", hex: "#D6A64B" },
  { label: "Laranja", hex: "#FF6F00" },
  { label: "Âmbar escuro", hex: "#E65100" },
  // Linha 5 — Chave/Preto (K) + tons frios
  { label: "Verde menta", hex: "#A5D6A7" },
  { label: "Verde", hex: "#4CAF50" },
  { label: "Verde escuro", hex: "#1B5E20" },
  { label: "Roxo", hex: "#7E57C2" },
  { label: "Índigo", hex: "#3F51B5" },
];

const RAIL_COLOR_KEY = "__rail_icon_color__";

export default function QAPortalLayoutAdmin() {
  const [currentColor, setCurrentColor] = useState<string>("#9a9a9a");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingColor, setPendingColor] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("qa_sidebar_temas" as any)
        .select("accent")
        .eq("key", RAIL_COLOR_KEY)
        .maybeSingle();
      setLoading(false);
      const row = data as { accent?: string } | null;
      if (row?.accent) setCurrentColor(row.accent);
    }
    load();
  }, []);

  async function saveColor(hex: string) {
    setSaving(true);
    // upsert pela key única
    const { error } = await supabase
      .from("qa_sidebar_temas" as any)
      .upsert(
        {
          key: RAIL_COLOR_KEY,
          label: "Rail — Cor dos ícones",
          descricao: "Cor global dos ícones do rail direito",
          bg: "#0A0A0A",
          accent: hex,
          stripe: null,
          top_mode: "compact",
          ativo: true,
          is_global_default: false,
          ordem: 9999,
        },
        { onConflict: "key" }
      );
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar cor: " + error.message);
      return;
    }
    setCurrentColor(hex);
    setPendingColor(null);
    toast.success("Cor dos ícones salva com sucesso!");
  }

  const displayColor = pendingColor ?? currentColor;

  return (
    <div className="space-y-6">
      {/* ── Dimensões das colunas ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 border-b border-slate-200">
          <Monitor className="h-4 w-4 text-[#7A1F2B]" />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#7A1F2B]">
            Dimensões das colunas laterais (portal do cliente)
          </span>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Use as dimensões abaixo para preparar suas artes antes de fazer upload. O portal usa layout de 3 colunas em desktop (≥ 1024 px).
          </p>

          {/* Grade de colunas visual */}
          <div className="flex gap-3 items-stretch">
            {/* Esquerda expandida */}
            <div className="flex flex-col gap-1 items-center">
              <div
                className="rounded border-2 border-[#7A1F2B] bg-[#0A0A0A] flex flex-col items-center justify-center gap-1"
                style={{ width: 80, height: 120 }}
              >
                <LayoutTemplate className="h-4 w-4 text-[#D6A64B]" />
                <span className="text-[9px] text-white font-bold tracking-wide">ESQUERDA</span>
                <span className="text-[9px] text-[#D6A64B] font-black">EXPANDIDA</span>
              </div>
              <span className="text-[11px] font-black text-slate-700">{SIDEBAR_LEFT_EXPANDED_PX} px</span>
              <span className="text-[10px] text-slate-400">largura</span>
              <span className="text-[10px] text-slate-400">100% altura</span>
            </div>

            {/* Esquerda colapsada */}
            <div className="flex flex-col gap-1 items-center">
              <div
                className="rounded border-2 border-slate-400 bg-[#141414] flex flex-col items-center justify-center gap-1"
                style={{ width: 40, height: 120 }}
              >
                <span className="text-[8px] text-slate-300 font-bold" style={{ writingMode: "vertical-rl" }}>COLAPSADA</span>
              </div>
              <span className="text-[11px] font-black text-slate-700">{SIDEBAR_LEFT_COLLAPSED_PX} px</span>
              <span className="text-[10px] text-slate-400">largura</span>
              <span className="text-[10px] text-slate-400">100% altura</span>
            </div>

            {/* Área principal */}
            <div className="flex-1 flex flex-col gap-1 items-center">
              <div
                className="rounded border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center w-full"
                style={{ height: 120 }}
              >
                <span className="text-[11px] text-slate-400 font-semibold">Conteúdo principal</span>
              </div>
              <span className="text-[11px] font-black text-slate-700">variável</span>
              <span className="text-[10px] text-slate-400">preenche o restante</span>
            </div>

            {/* Rail direito */}
            <div className="flex flex-col gap-1 items-center">
              <div
                className="rounded border-2 border-[#D6A64B] bg-[#0A0A0A] flex flex-col items-center justify-center gap-1"
                style={{ width: 32, height: 120 }}
              >
                <div className="flex flex-col gap-1.5 items-center">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-3 h-3 rounded bg-slate-600" />
                  ))}
                </div>
              </div>
              <span className="text-[11px] font-black text-slate-700">{RAIL_RIGHT_PX} px</span>
              <span className="text-[10px] text-slate-400">largura</span>
              <span className="text-[10px] text-slate-400">100% altura</span>
            </div>
          </div>

          {/* Tabela de referência */}
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-slate-600 text-[10px]">Coluna</th>
                <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-slate-600 text-[10px]">Largura</th>
                <th className="text-center px-3 py-2 font-black uppercase tracking-wider text-slate-600 text-[10px]">Altura</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-slate-600 text-[10px]">Formato recomendado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-800">Sidebar esquerda (expandida)</td>
                <td className="px-3 py-2 text-center font-black text-[#7A1F2B]">{SIDEBAR_LEFT_EXPANDED_PX} px</td>
                <td className="px-3 py-2 text-center text-slate-600">100 vh</td>
                <td className="px-3 py-2 text-slate-500">190×1080 px · PNG/JPG/WEBP · vertical</td>
              </tr>
              <tr className="border-t border-slate-100 bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-800">Sidebar esquerda (colapsada)</td>
                <td className="px-3 py-2 text-center font-black text-slate-500">{SIDEBAR_LEFT_COLLAPSED_PX} px</td>
                <td className="px-3 py-2 text-center text-slate-600">100 vh</td>
                <td className="px-3 py-2 text-slate-500">68×1080 px · PNG/JPG/WEBP · vertical</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-800">Rail direito (ícones)</td>
                <td className="px-3 py-2 text-center font-black text-[#D6A64B]">{RAIL_RIGHT_PX} px</td>
                <td className="px-3 py-2 text-center text-slate-600">100 vh</td>
                <td className="px-3 py-2 text-slate-500">56×1080 px · PNG/JPG/WEBP · vertical estreito</td>
              </tr>
            </tbody>
          </table>

          <p className="text-[11px] text-slate-400">
            Upload de imagens para a sidebar esquerda: use a seção <strong>Temas da Sidebar</strong> acima, criando ou editando um tema e anexando a arte no campo "Hero Image".
          </p>
        </div>
      </div>

      {/* ── Paleta de cores do rail direito ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 border-b border-slate-200">
          <Palette className="h-4 w-4 text-[#7A1F2B]" />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#7A1F2B]">
            Cor dos ícones — rail direito
          </span>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-[12px] text-slate-500">
            Escolha a cor dos ícones da coluna de navegação à direita. A cor ativa (item selecionado) usa um tom mais brilhante da mesma cor.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[12px]">Carregando cor atual…</span>
            </div>
          ) : (
            <>
              {/* Preview */}
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full border-4 border-slate-200 shadow-sm transition-all"
                  style={{ background: displayColor }}
                />
                <div>
                  <div className="text-[13px] font-black text-slate-800">Cor atual dos ícones</div>
                  <div className="text-[12px] text-slate-500 font-mono">{displayColor.toUpperCase()}</div>
                  {pendingColor && (
                    <div className="text-[11px] text-amber-600 font-semibold mt-0.5">● Alteração pendente — clique em Salvar</div>
                  )}
                </div>
                {/* Preview mini do rail */}
                <div
                  className="ml-auto w-10 rounded-lg flex flex-col items-center justify-center gap-2 py-3"
                  style={{ background: "#0A0A0A", minHeight: 120 }}
                >
                  {[0,1,2,3,4].map(i => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded"
                      style={{ background: i === 1 ? `${displayColor}33` : "transparent", color: i === 1 ? displayColor : displayColor + "88" }}
                    >
                      <div className="w-full h-full rounded" style={{ border: `1.5px solid ${i === 1 ? displayColor : displayColor + "55"}` }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Paleta CMYK */}
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Paleta CMYK</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {RAIL_COLOR_PALETTE.map((c) => {
                    const isSelected = displayColor.toUpperCase() === c.hex.toUpperCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        title={`${c.label} — ${c.hex}`}
                        onClick={() => setPendingColor(c.hex)}
                        className="relative rounded border-2 transition-all"
                        style={{
                          width: "100%",
                          paddingBottom: "100%",
                          background: c.hex,
                          borderColor: isSelected ? "#7A1F2B" : "transparent",
                          boxShadow: isSelected ? "0 0 0 2px #7A1F2B, 0 0 0 4px #fff" : "0 1px 3px rgba(0,0,0,0.18)",
                          outline: "1px solid rgba(0,0,0,0.08)",
                        }}
                      >
                        {isSelected && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-white font-black text-[10px]"
                            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  C = ciano · M = magenta · Y = amarelo · K = chave (preto/neutros)
                </div>
              </div>

              {/* Input hex manual */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-600 shrink-0">Hex personalizado</label>
                <div className="flex items-center gap-1.5 border border-slate-200 rounded px-2 py-1">
                  <div className="w-4 h-4 rounded border border-slate-300" style={{ background: displayColor }} />
                  <input
                    type="text"
                    value={pendingColor ?? currentColor}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPendingColor(v);
                    }}
                    className="w-24 text-[12px] font-mono border-0 outline-none bg-transparent text-slate-700"
                    maxLength={7}
                    placeholder="#9a9a9a"
                  />
                </div>
                <input
                  type="color"
                  value={displayColor}
                  onChange={(e) => setPendingColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                  title="Seletor de cor"
                />
              </div>

              {/* Botão salvar */}
              <button
                type="button"
                disabled={saving || !pendingColor}
                onClick={() => pendingColor && saveColor(pendingColor)}
                className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-black uppercase tracking-[0.14em] transition"
                style={{
                  background: pendingColor ? "#7A1F2B" : "#e5e7eb",
                  color: pendingColor ? "#fff" : "#9ca3af",
                  cursor: pendingColor ? "pointer" : "not-allowed",
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Salvando…" : "Salvar cor dos ícones"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
