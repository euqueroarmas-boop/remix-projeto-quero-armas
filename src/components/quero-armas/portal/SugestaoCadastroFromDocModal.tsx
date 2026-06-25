// ============================================================================
// SugestaoCadastroFromDocModal — Fase 5
// Após validação de um documento, compara `dados_extraidos_json` com o
// cadastro atual (qa_clientes) e propõe um diff/merge ao cliente. As
// alterações vão para a edge `qa-cliente-atualizar-cadastro` (já existente).
// Camada 100% aditiva — não toca nas edges existentes.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, MapPin, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MARROM = "#7A1F2B";

function Campo({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-slate-400"
      />
    </label>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (n: boolean) => void;
  cliente: any;
  dadosExtraidos: Record<string, any> | null | undefined;
  nomeDoc?: string | null;
  onApplied?: () => void;
  /**
   * Restringe quais COLUNAS de qa_clientes podem aparecer no modal. Quando
   * informado, só as colunas listadas são consideradas — útil para abrir o
   * modal "escopado" (ex.: só endereço, só RG) a partir do painel de
   * divergências.
   */
  filtroCampos?: string[] | null;
  /** Título customizado no header. */
  tituloCustomizado?: string | null;
  /**
   * Quando true, o formulário de endereço é pré-preenchido com os dados
   * atuais do cadastro (modo "editar manualmente") em vez de propor os
   * valores extraídos do documento. O cliente pode editar livremente.
   */
  iniciarComCadastroAtual?: boolean;
}

interface Suggestion {
  campo: string;
  label: string;
  valorAtual: string;
  valorNovo: string;
}

// IA pode emitir várias variantes de chave para o mesmo dado.
// Mapeamos múltiplas chaves de origem → 1 coluna em qa_clientes.
const MAPA: { src: string[]; col: string; label: string }[] = [
  { src: ["nome", "nome_titular", "titular", "nome_completo", "titular_comprovante_nome"], col: "nome_completo", label: "Nome completo" },
  { src: ["data_nascimento"], col: "data_nascimento", label: "Data de nascimento" },
  { src: ["naturalidade_municipio", "naturalidade"], col: "naturalidade_municipio", label: "Naturalidade (município)" },
  { src: ["naturalidade_uf"], col: "naturalidade_uf", label: "Naturalidade (UF)" },
  { src: ["nacionalidade"], col: "nacionalidade", label: "Nacionalidade" },
  { src: ["nome_mae"], col: "nome_mae", label: "Nome da mãe" },
  { src: ["nome_pai"], col: "nome_pai", label: "Nome do pai" },
  { src: ["rg"], col: "rg", label: "RG" },
  { src: ["emissor_rg", "orgao_emissor", "emissor"], col: "emissor_rg", label: "Órgão emissor do RG" },
  { src: ["uf_emissor_rg", "uf_emissor", "uf_emissao", "estado_emissao", "estado_orgao_emissor"], col: "uf_emissor_rg", label: "UF emissora do RG" },
  { src: ["data_emissao"], col: "expedicao_rg", label: "Data de expedição do RG" },
  { src: ["logradouro", "endereco", "endereco_logradouro"], col: "endereco", label: "Endereço" },
  { src: ["numero", "endereco_numero"], col: "numero", label: "Número" },
  { src: ["complemento", "endereco_complemento"], col: "complemento", label: "Complemento" },
  { src: ["bairro", "endereco_bairro"], col: "bairro", label: "Bairro" },
  { src: ["cidade", "endereco_cidade", "municipio"], col: "cidade", label: "Cidade" },
  { src: ["uf", "estado", "endereco_uf", "endereco_estado"], col: "estado", label: "UF" },
  { src: ["cep", "endereco_cep"], col: "cep", label: "CEP" },
  { src: ["celular", "telefone"], col: "celular", label: "Celular" },
];

const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
const normCmp = (v: any) => norm(v).toLowerCase().replace(/[\s.\-/()]/g, "");

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function inferUfEmissor(extraidos: Record<string, any>): string {
  const candidatos = [
    extraidos?.uf_emissor_rg,
    extraidos?.uf_emissor,
    extraidos?.uf_emissao,
    extraidos?.estado_emissao,
    extraidos?.estado_orgao_emissor,
    extraidos?.emissor_rg,
    extraidos?.orgao_emissor,
    extraidos?.emissor,
  ];
  for (const c of candidatos) {
    const tokens = Array.from(String(c ?? "").toUpperCase().matchAll(/\b([A-Z]{2})\b/g)).map((m) => m[1]);
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (UFS.has(tokens[i])) return tokens[i];
    }
  }
  return "";
}

function limparUfDoEmissor(v: string): string {
  return v.replace(/\s*(?:\/|-)\s*[A-Z]{2}\s*$/i, "").trim();
}

function buildSuggestions(
  cliente: any,
  extraidos: Record<string, any>,
  filtroCampos?: string[] | null,
): Suggestion[] {
  const out: Suggestion[] = [];
  const filtro = Array.isArray(filtroCampos) && filtroCampos.length > 0
    ? new Set(filtroCampos.map((c) => String(c).toLowerCase()))
    : null;
  for (const m of MAPA) {
    if (filtro && !filtro.has(m.col.toLowerCase())) continue;
    let novo = "";
    for (const k of m.src) {
      const v = norm(extraidos?.[k]);
      if (v) { novo = v; break; }
    }
    if (!novo && m.col === "uf_emissor_rg") novo = inferUfEmissor(extraidos);
    if (novo && m.col === "emissor_rg") novo = limparUfDoEmissor(novo);
    if (!novo) continue;
    const atual = norm(cliente?.[m.col]);
    if (normCmp(atual) === normCmp(novo)) continue;
    out.push({ campo: m.col, label: m.label, valorAtual: atual, valorNovo: novo });
  }
  return out;
}

/** Detecta rapidamente se vale a pena abrir o modal (há ao menos uma sugestão). */
export function temSugestoesDeCadastro(cliente: any, extraidos: Record<string, any> | null | undefined): boolean {
  if (!extraidos || typeof extraidos !== "object") return false;
  return buildSuggestions(cliente, extraidos).length > 0;
}

export default function SugestaoCadastroFromDocModal({
  open, onOpenChange, cliente, dadosExtraidos, nomeDoc, onApplied, filtroCampos, tituloCustomizado, iniciarComCadastroAtual,
}: Props) {
  const sugestoes = useMemo(
    () => buildSuggestions(cliente, dadosExtraidos || {}, filtroCampos),
    [cliente, dadosExtraidos, filtroCampos],
  );
  // ---------------------------------------------------------------------
  // Modo "endereço editável": quando o filtro é exclusivamente de endereço,
  // renderizamos um formulário editável com os 7 campos em vez do diff em
  // checkboxes. O cliente sempre revisa/edita antes de salvar.
  // ---------------------------------------------------------------------
  const ENDERECO_COLS = ["endereco", "numero", "complemento", "bairro", "cidade", "estado", "cep"] as const;
  const ehEnderecoScope = useMemo(() => {
    const filtro = Array.isArray(filtroCampos) ? filtroCampos.map((c) => String(c).toLowerCase()) : [];
    if (filtro.length === 0) return false;
    const set = new Set<string>(ENDERECO_COLS);
    return filtro.every((c) => set.has(c));
  }, [filtroCampos]);

  function extractValor(col: string): string {
    const m = MAPA.find((x) => x.col === col);
    if (!m) return "";
    for (const k of m.src) {
      const v = norm((dadosExtraidos as any)?.[k]);
      if (v) return v;
    }
    return "";
  }
  const valoresAtuais = useMemo(() => {
    const o: Record<string, string> = {};
    for (const c of ENDERECO_COLS) o[c] = norm(cliente?.[c]);
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.endereco, cliente?.numero, cliente?.complemento, cliente?.bairro, cliente?.cidade, cliente?.estado, cliente?.cep]);
  const valoresDoc = useMemo(() => {
    const o: Record<string, string> = {};
    for (const c of ENDERECO_COLS) o[c] = extractValor(c);
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosExtraidos]);

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || !ehEnderecoScope) return;
    const inicial: Record<string, string> = {};
    for (const c of ENDERECO_COLS) {
      const docV = valoresDoc[c];
      const atual = valoresAtuais[c];
      inicial[c] = iniciarComCadastroAtual ? atual : (docV || atual);
    }
    setForm(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ehEnderecoScope, iniciarComCadastroAtual, JSON.stringify(valoresDoc), JSON.stringify(valoresAtuais)]);

  const camposExtraidosFaltantes = useMemo(
    () => ehEnderecoScope && ENDERECO_COLS.some((c) => !valoresDoc[c] && c !== "complemento"),
    [ehEnderecoScope, valoresDoc],
  );

  const composeEndereco = (v: Record<string, string>) => {
    const linha1 = [v.endereco, v.numero].filter(Boolean).join(", ");
    const linha2 = [v.complemento, v.bairro].filter(Boolean).join(" — ");
    const linha3 = [v.cidade, v.estado].filter(Boolean).join("/");
    const linha4 = v.cep ? `CEP ${v.cep}` : "";
    return [linha1, linha2, linha3, linha4].filter(Boolean).join(" • ");
  };
  const enderecoDocLinha = useMemo(() => composeEndereco(valoresDoc), [valoresDoc]);
  const enderecoAtualLinha = useMemo(() => composeEndereco(valoresAtuais), [valoresAtuais]);

  // Aviso quando o filtro é de endereço mas a IA só conseguiu extrair o
  // logradouro — usuário precisa conferir número, bairro, cidade, UF e CEP.
  const enderecoSoLogradouro = useMemo(() => {
    const filtro = Array.isArray(filtroCampos) ? filtroCampos.map((s) => String(s).toLowerCase()) : [];
    const ehFiltroEndereco =
      filtro.length > 0 && filtro.some((c) => ["endereco", "numero", "bairro", "cidade", "estado", "cep", "complemento"].includes(c));
    if (!ehFiltroEndereco) return false;
    const campos = sugestoes.map((s) => s.campo);
    return campos.length === 1 && campos[0] === "endereco";
  }, [filtroCampos, sugestoes]);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sugestoes.map((s) => [s.campo, true])),
  );
  const [salvando, setSalvando] = useState(false);

  // Recalcula seleção default quando as sugestões mudam (novo doc).
  useMemo(() => {
    // Quando filtroCampos vem informado, o cliente já escolheu resolver
    // essa divergência específica — marca todos os campos por padrão.
    setSelecionados(Object.fromEntries(sugestoes.map((s) => [s.campo, true])));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestoes.map((s) => s.campo + s.valorNovo).join("|")]);

  const toggle = (campo: string) =>
    setSelecionados((p) => ({ ...p, [campo]: !p[campo] }));

  const aplicar = async () => {
    const toSave: Record<string, string> = {};
    if (ehEnderecoScope) {
      for (const c of ENDERECO_COLS) {
        const novo = norm(form[c]);
        const atual = valoresAtuais[c];
        if (normCmp(novo) === normCmp(atual)) continue;
        toSave[c] = novo;
      }
    } else {
      for (const s of sugestoes) if (selecionados[s.campo]) toSave[s.campo] = s.valorNovo;
    }
    if (!Object.keys(toSave).length) {
      onOpenChange(false);
      return;
    }
    setSalvando(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${base}/functions/v1/qa-cliente-atualizar-cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: toSave, cliente_id: cliente?.id ?? null }),
      });
      if (!resp.ok) throw new Error((await resp.text()) || "Falha ao salvar");
      toast.success("Cadastro atualizado com os dados do documento.");
      onApplied?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar cadastro.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(n) => !n && !salvando && onOpenChange(false)}>
      <DialogContent className="qa-scope w-[calc(100vw-1rem)] max-w-lg rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[88dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 px-5 py-4" style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: MARROM }}>
              <Sparkles className="h-5 w-5" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Sugestão de atualização
              </div>
              <h2 className="text-[17px] font-extrabold leading-tight text-slate-900">
                {tituloCustomizado || "Encontramos dados no seu documento"}
              </h2>
              {nomeDoc && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Extraído de: <span className="font-semibold text-slate-700">{nomeDoc}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              aria-label="Fechar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {ehEnderecoScope ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "#FBF3F4", color: MARROM }}>
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Endereço atual no cadastro</div>
                      <div className="text-[12px] italic text-slate-600 break-words">{enderecoAtualLinha || "—"}</div>
                    </div>
                    {enderecoDocLinha && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider" style={{ color: MARROM }}>Endereço extraído do documento</div>
                        <div className="text-[12px] font-semibold text-slate-900 break-words">{enderecoDocLinha}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-slate-600">
                Confira os campos abaixo antes de salvar. Você pode editar manualmente qualquer valor.
              </p>
              {camposExtraidosFaltantes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  Extraímos apenas parte do endereço. Confira os demais campos antes de salvar.
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                <Campo className="sm:col-span-4" label="Endereço (logradouro)" value={form.endereco || ""} onChange={(v) => setForm((p) => ({ ...p, endereco: v }))} />
                <Campo className="sm:col-span-2" label="Número" value={form.numero || ""} onChange={(v) => setForm((p) => ({ ...p, numero: v }))} />
                <Campo className="sm:col-span-3" label="Complemento" value={form.complemento || ""} onChange={(v) => setForm((p) => ({ ...p, complemento: v }))} />
                <Campo className="sm:col-span-3" label="Bairro" value={form.bairro || ""} onChange={(v) => setForm((p) => ({ ...p, bairro: v }))} />
                <Campo className="sm:col-span-3" label="Cidade" value={form.cidade || ""} onChange={(v) => setForm((p) => ({ ...p, cidade: v }))} />
                <Campo className="sm:col-span-1" label="UF" value={form.estado || ""} onChange={(v) => setForm((p) => ({ ...p, estado: v.toUpperCase().slice(0, 2) }))} />
                <Campo className="sm:col-span-2" label="CEP" value={form.cep || ""} onChange={(v) => setForm((p) => ({ ...p, cep: v }))} />
              </div>
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Seu cadastro já está em sintonia com este documento — nada a atualizar.
            </div>
          ) : (
            <>
              <p className="mb-2 text-[12px] text-slate-600">
                Marque os campos que devem ser <strong>atualizados no seu cadastro</strong> com base no que extraímos do documento. Você pode desmarcar qualquer item.
              </p>
              {enderecoSoLogradouro && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  Extraímos apenas o logradouro. Confira número, bairro, cidade,
                  UF e CEP no seu cadastro antes de salvar.
                </div>
              )}
              {sugestoes.map((s) => {
                const marcado = !!selecionados[s.campo];
                return (
                  <label
                    key={s.campo}
                    className={
                      "block rounded-xl border px-3 py-2.5 cursor-pointer transition " +
                      (marcado ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50")
                    }
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={() => toggle(s.campo)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {s.label}
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase text-slate-400">Atual</div>
                            <div className="truncate text-slate-600 italic">
                              {s.valorAtual || "—"}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase" style={{ color: MARROM }}>Novo</div>
                            <div className="truncate font-semibold text-slate-900">
                              {s.valorNovo}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {sugestoes.length === 0 ? "Continuar" : "Manter cadastro atual"}
          </button>
          {(ehEnderecoScope || sugestoes.length > 0) && (
            <button
              type="button"
              onClick={aplicar}
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              style={{ background: MARROM }}
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {ehEnderecoScope ? "Salvar endereço no cadastro" : "Atualizar cadastro"}
                </>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}