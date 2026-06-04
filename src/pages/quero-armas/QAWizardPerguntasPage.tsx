// ============================================================================
// QAWizardPerguntasPage
// ----------------------------------------------------------------------------
// Tela admin para editar os TEXTOS das perguntas do Wizard KYC sem mexer no
// catálogo técnico (templatePlaceholders.ts). Apenas staff (RLS validado pela
// função qa_is_active_staff). Persiste em qa_template_placeholder_config.
// "Restaurar padrão" desativa a linha (ativo=false) → wizard volta ao fallback.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RotateCcw, Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TEMPLATE_PLACEHOLDERS, PlaceholderDef } from "@/lib/quero-armas/templatePlaceholders";
import {
  loadPlaceholderOverrides,
  PlaceholderOverride,
} from "@/lib/quero-armas/templatePlaceholderOverrides";

interface Draft {
  label_cliente: string;
  pergunta_cliente: string;
  texto_ajuda: string;
  exemplo_placeholder: string;
  grupo_visual: string;
  ordem: string; // string p/ input
  obrigatorio_override: boolean | null;
}

function defToDraft(def: PlaceholderDef, ov?: PlaceholderOverride | null): Draft {
  return {
    label_cliente: ov?.label_cliente ?? "",
    pergunta_cliente: ov?.pergunta_cliente ?? "",
    texto_ajuda: ov?.texto_ajuda ?? "",
    exemplo_placeholder: ov?.exemplo_placeholder ?? "",
    grupo_visual: ov?.grupo_visual ?? "",
    ordem: ov?.ordem != null ? String(ov.ordem) : "",
    obrigatorio_override: ov?.obrigatorio_override ?? null,
  };
}

const SOURCE_LABEL: Record<string, string> = {
  cliente: "CLIENTE",
  processo: "PROCESSO",
  sistema: "SISTEMA",
};

export default function QAWizardPerguntasPage() {
  const [overrides, setOverrides] = useState<Record<string, PlaceholderOverride>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const loadedRef = useRef(false);

  const grupos = useMemo(
    () => Array.from(new Set(TEMPLATE_PLACEHOLDERS.map((p) => p.group))).sort(),
    []
  );

  const recarregar = async () => {
    setLoading(true);
    const ov = await loadPlaceholderOverrides();
    setOverrides(ov);
    const next: Record<string, Draft> = {};
    for (const def of TEMPLATE_PLACEHOLDERS) {
      next[def.placeholder] = defToDraft(def, ov[def.placeholder]);
    }
    setDrafts(next);
    setLoading(false);
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void recarregar();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return TEMPLATE_PLACEHOLDERS.filter((def) => {
      if (groupFilter && def.group !== groupFilter) return false;
      if (!s) return true;
      const d = drafts[def.placeholder];
      const blob = [
        def.placeholder,
        def.label,
        def.key,
        def.group,
        def.question || "",
        d?.pergunta_cliente || "",
        d?.label_cliente || "",
      ].join(" ").toLowerCase();
      return blob.includes(s);
    });
  }, [search, groupFilter, drafts]);

  const updateDraft = (placeholder: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [placeholder]: { ...prev[placeholder], ...patch } }));
  };

  const salvar = async (def: PlaceholderDef) => {
    const d = drafts[def.placeholder];
    if (!d) return;
    setSavingKey(def.placeholder);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id ?? null;
      const ordemNum = d.ordem.trim() ? Number(d.ordem) : null;
      const payload: any = {
        placeholder: def.placeholder,
        label_cliente: d.label_cliente.trim() || null,
        pergunta_cliente: d.pergunta_cliente.trim() || null,
        texto_ajuda: d.texto_ajuda.trim() || null,
        exemplo_placeholder: d.exemplo_placeholder.trim() || null,
        grupo_visual: d.grupo_visual.trim() || null,
        ordem: ordemNum != null && Number.isFinite(ordemNum) ? ordemNum : null,
        obrigatorio_override: d.obrigatorio_override,
        ativo: true,
        updated_by: uid,
      };
      const { error } = await supabase
        .from("qa_template_placeholder_config" as any)
        .upsert(payload, { onConflict: "placeholder" });
      if (error) throw error;
      toast.success("Alteração salva ✓");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      setSavingKey(null);
    }
  };

  const restaurarPadrao = async (def: PlaceholderDef) => {
    setSavingKey(def.placeholder);
    try {
      const { error } = await supabase
        .from("qa_template_placeholder_config" as any)
        .update({ ativo: false })
        .eq("placeholder", def.placeholder);
      if (error) throw error;
      toast.success("Restaurado ao padrão do sistema.");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Falhou ao restaurar.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 uppercase">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">PERGUNTAS DO WIZARD KYC</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Edite os textos exibidos ao cliente no Assistente de Cadastro Documental. Campos técnicos
            (placeholder, key, source, máscara) permanecem fixos no código por segurança.
          </p>
        </div>
        <button
          onClick={recarregar}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
        >
          RECARREGAR
        </button>
      </header>

      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="BUSCAR PLACEHOLDER, LABEL OU TEXTO..."
            className="h-9 pl-9 uppercase"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-bold uppercase text-slate-700"
        >
          <option value="">TODOS OS GRUPOS</option>
          {grupos.map((g) => (
            <option key={g} value={g}>{g.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((def) => {
            const ov = overrides[def.placeholder];
            const d = drafts[def.placeholder];
            if (!d) return null;
            const hasOverride = !!ov;
            const obrigatorioEfetivo = d.obrigatorio_override ?? def.required;
            const isSaving = savingKey === def.placeholder;

            return (
              <article
                key={def.placeholder}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <header className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                    {def.placeholder}
                  </span>
                  <span className="rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {SOURCE_LABEL[def.source] || def.source.toUpperCase()}
                  </span>
                  <span className="rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                    key={def.key}
                  </span>
                  <span className="rounded-md border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {def.input.toUpperCase()}
                  </span>
                  {hasOverride && (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      OVERRIDE ATIVO
                    </span>
                  )}
                </header>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">LABEL EXIBIDO</label>
                    <Input
                      className="h-9 uppercase"
                      placeholder={def.label}
                      value={d.label_cliente}
                      onChange={(e) => updateDraft(def.placeholder, { label_cliente: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">GRUPO VISUAL</label>
                    <Input
                      className="h-9 uppercase"
                      placeholder={def.group}
                      value={d.grupo_visual}
                      onChange={(e) => updateDraft(def.placeholder, { grupo_visual: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500">PERGUNTA EXIBIDA AO CLIENTE</label>
                    <Textarea
                      className="min-h-[60px] uppercase"
                      placeholder={def.question || `INFORME ${def.label.toUpperCase()}`}
                      value={d.pergunta_cliente}
                      onChange={(e) => updateDraft(def.placeholder, { pergunta_cliente: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500">TEXTO DE AJUDA</label>
                    <Textarea
                      className="min-h-[50px] uppercase"
                      placeholder={def.helper || "OPCIONAL"}
                      value={d.texto_ajuda}
                      onChange={(e) => updateDraft(def.placeholder, { texto_ajuda: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">EXEMPLO/PLACEHOLDER DO INPUT</label>
                    <Input
                      className="h-9 uppercase"
                      placeholder={def.inputPlaceholder || ""}
                      value={d.exemplo_placeholder}
                      onChange={(e) => updateDraft(def.placeholder, { exemplo_placeholder: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">ORDEM</label>
                    <Input
                      className="h-9"
                      type="number"
                      placeholder="—"
                      value={d.ordem}
                      onChange={(e) => updateDraft(def.placeholder, { ordem: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={obrigatorioEfetivo}
                      onCheckedChange={(checked) =>
                        updateDraft(def.placeholder, { obrigatorio_override: checked })
                      }
                    />
                    <div>
                      <div className="text-[11px] font-bold text-slate-700">
                        OBRIGATÓRIO: {obrigatorioEfetivo ? "SIM" : "NÃO"}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500">
                        PADRÃO DO SISTEMA: {def.required ? "SIM" : "NÃO"}
                      </div>
                    </div>
                  </div>
                  {def.required && d.obrigatorio_override === false && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3 w-3" />
                      CUIDADO: SE ESTE CAMPO FOR OBRIGATÓRIO NO WORD, DESLIGAR PODE QUEBRAR A GERAÇÃO.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {hasOverride && (
                    <button
                      type="button"
                      onClick={() => restaurarPadrao(def)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> RESTAURAR PADRÃO
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => salvar(def)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#7A1F2B] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#5e1721] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    SALVAR
                  </button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-[12px] text-slate-500">
              NENHUM PLACEHOLDER CORRESPONDE AOS FILTROS.
            </div>
          )}
        </div>
      )}
    </div>
  );
}