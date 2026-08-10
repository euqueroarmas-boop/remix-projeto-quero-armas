// ============================================================================
// QARegrasCategoriaAdmin
// ----------------------------------------------------------------------------
// Matriz "Categoria × Exigência" (public.qa_regras_categoria).
//
// Cada linha responde: para esta CATEGORIA de titular (e, opcionalmente, para
// esta corporação e/ou este serviço), o que acontece com este GRUPO de
// exigências — ou com um tipo de documento específico dentro dele?
//
//   EXIGIDO      → nada muda, o cliente entrega
//   ALTERNATIVO  → aceita a via institucional (laudo da própria corporação)
//   DISPENSADO   → o passo aparece já cumprido, carimbado com a base legal
//
// A base legal é OBRIGATÓRIA em dispensa/alternativo: é ela que o cliente lê
// no carimbo e que sustenta a decisão numa auditoria.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { PENDENCIA_GRUPOS } from "@/lib/quero-armas/pendenciasGrupos";
import { MODOS, type ModoExigencia, type RegraCategoria } from "@/lib/quero-armas/regrasCategoria";

const CATEGORIAS: { valor: string; label: string }[] = [
  { valor: "pessoa_fisica", label: "Pessoa física (cidadão comum)" },
  { valor: "pessoa_juridica", label: "Pessoa jurídica" },
  { valor: "seguranca_publica", label: "Segurança pública (PC, PP, PM, GCM…)" },
  { valor: "magistrado_mp", label: "Magistrado / Ministério Público" },
  { valor: "militar", label: "Militar das Forças Armadas" },
];

const GRUPOS = Object.values(PENDENCIA_GRUPOS).sort((a, b) => a.ordem - b.ordem);

const inputCls =
  "h-9 w-full rounded-sm border border-[#E4E4E4] bg-white px-2 text-[13px] uppercase text-[#0A0A0A] outline-none focus:border-[#7A1F2B]";

export default function QARegrasCategoriaAdmin() {
  const [linhas, setLinhas] = useState<RegraCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<string>("");

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_regras_categoria" as any)
      .select("*")
      .order("categoria", { ascending: true });
    if (error) toast.error("Não foi possível carregar a matriz.");
    setLinhas(((data as any[]) ?? []) as RegraCategoria[]);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const visiveis = useMemo(
    () => (filtro ? linhas.filter((l) => l.categoria === filtro) : linhas),
    [linhas, filtro],
  );

  const patch = (id: string | undefined, campo: keyof RegraCategoria, valor: any) => {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  };

  const adicionar = async () => {
    const nova = {
      categoria: filtro || "seguranca_publica",
      grupo_id: "laudos",
      modo: "alternativo" as ModoExigencia,
      ativo: false,
    };
    const { data, error } = await supabase.from("qa_regras_categoria" as any).insert(nova).select().maybeSingle();
    if (error) { toast.error("Erro ao criar a linha."); return; }
    setLinhas((ls) => [...(ls ?? []), data as any]);
  };

  const remover = async (id?: string) => {
    if (!id) return;
    const { error } = await supabase.from("qa_regras_categoria" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao remover."); return; }
    setLinhas((ls) => ls.filter((l) => l.id !== id));
  };

  const salvar = async (l: RegraCategoria) => {
    if (l.modo !== "exigido" && !String(l.base_legal || "").trim()) {
      toast.error("Base legal é obrigatória para dispensa ou via alternativa.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("qa_regras_categoria" as any)
      .update({
        categoria: l.categoria,
        corporacao: l.corporacao || null,
        servico_id: l.servico_id ?? null,
        grupo_id: l.grupo_id,
        tipo_documento: l.tipo_documento ? String(l.tipo_documento).trim().toLowerCase() : null,
        modo: l.modo,
        base_legal: l.base_legal || null,
        registro: l.registro || null,
        ativo: l.ativo,
      })
      .eq("id", l.id!);
    setSalvando(false);
    if (error) { toast.error("Erro ao salvar."); return; }
    toast.success("Regra salva.");
  };

  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="font-['Oswald',sans-serif] text-[18px] font-bold uppercase tracking-[.04em] text-[#0A0A0A]">
          Dispensas e exigências por categoria
        </h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[#525252]">
          Define, por categoria profissional do titular, o que cada grupo de exigências vira no
          checklist do cliente. <strong>Dispensado</strong> mostra o passo já cumprido com o carimbo
          e a base legal; <strong>alternativo</strong> aceita a via institucional; <strong>exigido</strong>{" "}
          mantém o passo normal. Regra inativa não afeta ninguém.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} max-w-[280px]`} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">TODAS AS CATEGORIAS</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.label.toUpperCase()}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={adicionar}
          className="inline-flex h-9 items-center gap-2 rounded-sm bg-[#7A1F2B] px-3 text-[12px] font-bold uppercase tracking-[.08em] text-white hover:bg-[#63111d]"
        >
          <Plus className="h-3.5 w-3.5" /> Nova regra
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-[#737373]">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] p-4 text-[13px] text-[#525252]">
          Nenhuma regra cadastrada. Enquanto a matriz estiver vazia, todos os clientes seguem o
          checklist completo — nada é dispensado.
        </p>
      ) : (
        <div className="space-y-3">
          {visiveis.map((l) => (
            <div key={l.id} className="rounded-sm border border-[#E4E4E4] bg-white p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Categoria</span>
                  <select className={inputCls} value={l.categoria} onChange={(e) => patch(l.id, "categoria", e.target.value)}>
                    {CATEGORIAS.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.label.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Corporação (opcional)</span>
                  <input
                    className={inputCls}
                    placeholder="EX.: POLÍCIA CIVIL"
                    value={l.corporacao ?? ""}
                    onChange={(e) => patch(l.id, "corporacao", e.target.value.toUpperCase())}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Grupo de exigências</span>
                  <select className={inputCls} value={l.grupo_id} onChange={(e) => patch(l.id, "grupo_id", e.target.value)}>
                    {GRUPOS.map((g) => (
                      <option key={g.id} value={g.id}>{g.label.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Tipo específico (opcional)</span>
                  <input
                    className={inputCls}
                    placeholder="EX.: LAUDO_PSICOLOGICO"
                    value={l.tipo_documento ?? ""}
                    onChange={(e) => patch(l.id, "tipo_documento", e.target.value.toUpperCase())}
                  />
                </label>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Modo</span>
                  <select className={inputCls} value={l.modo} onChange={(e) => patch(l.id, "modo", e.target.value)}>
                    {MODOS.map((m) => (
                      <option key={m.valor} value={m.valor}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Base legal (aparece no carimbo)</span>
                  <input
                    className={`${inputCls} normal-case`}
                    placeholder="Lei 10.826/03, art. 6º, §1º-A"
                    value={l.base_legal ?? ""}
                    onChange={(e) => patch(l.id, "base_legal", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.12em] text-[#A3A3A3]">Sistema de registro</span>
                  <select className={inputCls} value={l.registro ?? ""} onChange={(e) => patch(l.id, "registro", e.target.value || null)}>
                    <option value="">NÃO SE APLICA</option>
                    <option value="sinarm">SINARM (PF)</option>
                    <option value="sigma">SIGMA (EXÉRCITO)</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.06em] text-[#0A0A0A]">
                  <input type="checkbox" checked={!!l.ativo} onChange={(e) => patch(l.id, "ativo", e.target.checked)} />
                  Regra ativa
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => remover(l.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-sm border border-[#E4E4E4] px-3 text-[12px] font-bold uppercase tracking-[.08em] text-[#7A1F2B] hover:bg-[#FFF7F8]"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => salvar(l)}
                    className="inline-flex h-9 items-center gap-2 rounded-sm bg-[#0A0A0A] px-3 text-[12px] font-bold uppercase tracking-[.08em] text-white hover:bg-[#262626] disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
