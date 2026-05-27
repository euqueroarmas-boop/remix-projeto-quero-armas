// ============================================================================
// ClienteCadastroProgressivoModal
// ----------------------------------------------------------------------------
// Modal "Completar cadastro" com dois caminhos:
//   1) Preencher manualmente — salva campo a campo via debounce (qa-cliente-
//      atualizar-cadastro), persistindo o progresso para o cliente.
//   2) Enviar documento e usar IA — faz upload e chama qa-cliente-prefill;
//      o cliente revisa os campos extraídos antes de salvar.
// Mantém Arsenal UI (papel + bordô #7A1F2B). Sem fundo preto.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, Loader2, Pencil, Sparkles, Upload, X,
} from "lucide-react";
import {
  CAMPOS_CADASTRO, CampoCadastro, CadastroGrupo, GRUPO_LABELS,
  calcularProgressoCadastro, getCamposFaltantesCadastro,
} from "@/lib/quero-armas/cadastroCompleteness";
import {
  listarProcessosElegiveisGuia, carregarProcessoGuia,
  itensObrigatoriosGuia, itemPendenteAcaoGuia, enviarDocumentoGuia,
  type GuiaProcesso, type GuiaDoc,
} from "@/lib/quero-armas/checklistGuiadoEngine";

const MARROM = "#7A1F2B";

type Modo = "escolher" | "manual" | "ia_upload" | "ia_revisao";
type SaveState = "idle" | "saving" | "saved" | "error";

// Match entre documento extraído pela IA e itens pendentes do checklist.
interface ChecklistMatch {
  processo: GuiaProcesso;
  doc: GuiaDoc;
  label: string;
}

// Classifica o documento enviado a partir dos campos retornados pela IA.
function tiposCanditatosDoDoc(fields: Record<string, string>): string[] {
  const tipos: string[] = [];
  const hasEnd = !!(fields.cep || fields.endereco || fields.cidade || fields.bairro);
  const hasId = !!(fields.rg || fields.emissor_rg || fields.data_expedicao_rg);
  const idTipo = (fields.tipo_documento_identidade || "").toLowerCase();
  if (hasEnd) tipos.push("comprovante_residencia", "residencia", "endereco");
  if (hasId || idTipo) {
    if (idTipo === "cnh") tipos.push("cnh");
    else tipos.push("rg", "identidade", "cnh");
  }
  return tipos;
}

function tipoDocBate(tipoChecklist: string, candidatos: string[]): boolean {
  const t = (tipoChecklist || "").toLowerCase();
  return candidatos.some((c) => t.includes(c));
}

interface Props {
  open: boolean;
  onClose: () => void;
  cliente: any;
  onUpdated?: () => void;
}

const DEBOUNCE_MS = 800;

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
function maskTel(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && "-", c].filter(Boolean).join(""));
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}
function maskDate(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function formatBr(value: any, tipo?: string): string {
  const s = value == null ? "" : String(value);
  if (!s) return "";
  if (tipo === "cep") return maskCep(s);
  if (tipo === "tel") return maskTel(s);
  if (tipo === "date") {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.slice(0, 10).split("-");
      return `${d}/${m}/${y}`;
    }
    return maskDate(s);
  }
  if (tipo === "uf") return s.toUpperCase().slice(0, 2);
  return s;
}

async function chamarAtualizarCadastro(fields: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { ok: false, error: "Sessão expirada." };
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const resp = await fetch(`${base}/functions/v1/qa-cliente-atualizar-cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: txt || "Falha ao salvar" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro de rede" };
  }
}

// Mapeia chaves extraídas pelo prefill → colunas qa_clientes.
const MAP_IA_TO_CLIENTE: Record<string, string> = {
  nome_completo: "nome_completo", // não atualizamos
  data_nascimento: "data_nascimento",
  sexo: "sexo",
  estado_civil: "estado_civil",
  nacionalidade: "nacionalidade",
  naturalidade_municipio: "naturalidade_municipio",
  naturalidade_uf: "naturalidade_uf",
  nome_mae: "nome_mae",
  nome_pai: "nome_pai",
  celular: "celular",
  cep: "cep",
  endereco: "endereco",
  numero: "numero",
  complemento: "complemento",
  bairro: "bairro",
  cidade: "cidade",
  estado: "estado",
  profissao: "profissao",
  escolaridade: "escolaridade",
  rg: "rg",
  emissor_rg: "emissor_rg",
  uf_emissor_rg: "uf_emissor_rg",
  data_expedicao_rg: "expedicao_rg",
  tipo_documento_identidade: "tipo_documento_identidade",
};

export default function ClienteCadastroProgressivoModal({ open, onClose, cliente, onUpdated }: Props) {
  const [modo, setModo] = useState<Modo>("escolher");
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [savingState, setSavingState] = useState<Record<string, SaveState>>({});
  const [iaProcessando, setIaProcessando] = useState(false);
  const [iaFields, setIaFields] = useState<Record<string, string>>({});
  const [iaWarnings, setIaWarnings] = useState<string[]>([]);
  const [iaSalvando, setIaSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      setModo("escolher");
      setMostrarTodos(false);
      setValores({});
      setSavingState({});
      setIaFields({});
      setIaWarnings([]);
    }
    return () => {
      Object.values(timersRef.current).forEach((t) => window.clearTimeout(t));
      timersRef.current = {};
    };
  }, [open]);

  const progresso = useMemo(() => calcularProgressoCadastro(cliente), [cliente]);
  const faltantes = useMemo(() => getCamposFaltantesCadastro(cliente), [cliente]);
  const camposVisiveis = mostrarTodos ? CAMPOS_CADASTRO : faltantes;

  const valorAtual = useCallback(
    (campo: CampoCadastro): string => {
      if (valores[campo.key] !== undefined) return valores[campo.key];
      return formatBr(cliente?.[campo.key], campo.tipo);
    },
    [valores, cliente],
  );

  const onChangeCampo = useCallback((campo: CampoCadastro, raw: string) => {
    let v = raw;
    if (campo.tipo === "cep") v = maskCep(raw);
    else if (campo.tipo === "tel") v = maskTel(raw);
    else if (campo.tipo === "date") v = maskDate(raw);
    else if (campo.tipo === "uf") v = raw.toUpperCase().slice(0, 2);
    setValores((prev) => ({ ...prev, [campo.key]: v }));
    setSavingState((prev) => ({ ...prev, [campo.key]: "idle" }));

    if (timersRef.current[campo.key]) window.clearTimeout(timersRef.current[campo.key]);
    const minLen =
      campo.tipo === "cep" ? 9 :
      campo.tipo === "tel" ? 14 :
      campo.tipo === "date" ? 10 :
      campo.tipo === "uf" ? 2 : 1;
    if (v.trim().length < minLen) return;

    timersRef.current[campo.key] = window.setTimeout(async () => {
      setSavingState((prev) => ({ ...prev, [campo.key]: "saving" }));
      const r = await chamarAtualizarCadastro({ [campo.key]: v });
      if (r.ok) {
        setSavingState((prev) => ({ ...prev, [campo.key]: "saved" }));
        onUpdated?.();
      } else {
        setSavingState((prev) => ({ ...prev, [campo.key]: "error" }));
      }
    }, DEBOUNCE_MS);
  }, [onUpdated]);

  const handleEscolherArquivo = () => fileRef.current?.click();

  const handleUploadIA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20MB).");
      return;
    }
    setIaProcessando(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(String(reader.result));
        reader.onerror = () => rej(reader.error);
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("qa-cliente-prefill", {
        body: { files: [{ data_url: dataUrl, mime: file.type, name: file.name }] },
      });
      if (error) throw new Error(error.message || "Falha na extração");
      const fields = (data as any)?.fields ?? {};
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) {
        const dest = MAP_IA_TO_CLIENTE[k];
        if (!dest || dest === "nome_completo") continue;
        if (typeof v !== "string" || !v.trim()) continue;
        mapped[dest] = v.trim();
      }
      setIaFields(mapped);
      setIaWarnings(Array.isArray(fields?.warnings) ? fields.warnings : []);
      setModo("ia_revisao");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível extrair os dados.");
    } finally {
      setIaProcessando(false);
    }
  };

  const confirmarSalvarIA = async () => {
    const toSave: Record<string, string> = {};
    for (const [k, v] of Object.entries(iaFields)) {
      if (typeof v !== "string" || !v.trim()) continue;
      // Não sobrescreve dados já existentes sem confirmação:
      // só envia campo se estiver atualmente vazio no cliente OU se o usuário
      // editou para um valor diferente do existente.
      const atual = cliente?.[k];
      if (atual && String(atual).trim() && String(atual).trim() === v.trim()) continue;
      toSave[k] = v;
    }
    if (Object.keys(toSave).length === 0) {
      toast.info("Nada novo para salvar.");
      onClose();
      return;
    }
    setIaSalvando(true);
    const r = await chamarAtualizarCadastro(toSave);
    setIaSalvando(false);
    if (!r.ok) {
      toast.error(r.error || "Erro ao salvar");
      return;
    }
    toast.success(`${Object.keys(toSave).length} campo(s) atualizado(s).`);
    onUpdated?.();
    onClose();
  };

  // ---------- render helpers ----------
  const renderInput = (campo: CampoCadastro) => {
    const v = valorAtual(campo);
    const state = savingState[campo.key] ?? "idle";
    const baseClass =
      "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#7A1F2B] focus:ring-2 focus:ring-[#7A1F2B]/15";
    return (
      <div className={campo.colSpan === 2 ? "sm:col-span-2" : ""}>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{campo.label}</label>
        <div className="relative mt-1">
          {campo.tipo === "select" ? (
            <select className={baseClass} value={v} onChange={(e) => onChangeCampo(campo, e.target.value)}>
              <option value="">Selecione…</option>
              {(campo.opcoes ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              className={baseClass}
              value={v}
              placeholder={campo.placeholder}
              inputMode={campo.tipo === "cep" || campo.tipo === "tel" || campo.tipo === "date" ? "numeric" : undefined}
              onChange={(e) => onChangeCampo(campo, e.target.value)}
            />
          )}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider">
            {state === "saving" && <span className="flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</span>}
            {state === "saved" && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Salvo</span>}
            {state === "error" && <span className="text-red-600">Erro</span>}
          </div>
        </div>
      </div>
    );
  };

  const gruposVisiveis = useMemo(() => {
    const map: Record<CadastroGrupo, CampoCadastro[]> = { pessoais: [], identidade: [], contato: [], endereco: [], profissional: [] };
    for (const c of camposVisiveis) map[c.grupo].push(c);
    return (Object.keys(map) as CadastroGrupo[]).filter((g) => map[g].length > 0).map((g) => ({ grupo: g, campos: map[g] }));
  }, [camposVisiveis]);

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="qa-scope w-[calc(100vw-1rem)] max-w-2xl rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[94dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 px-5 py-4" style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}>
          <div className="flex items-start gap-3">
            {modo !== "escolher" ? (
              <button type="button" onClick={() => setModo("escolher")} aria-label="Voltar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: MARROM }}>
                <Pencil className="h-5 w-5" strokeWidth={2.3} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Portal do cliente</div>
              <h2 className="text-[19px] font-extrabold leading-tight text-slate-900">Completar cadastro</h2>
              <p className="mt-0.5 text-[12px] text-slate-600">
                Cadastro <strong>{progresso}% completo</strong>. Salvamos seu progresso automaticamente.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progresso}%`, background: MARROM }} />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-[280px] flex-1 overflow-y-auto px-5 py-5">
          {modo === "escolher" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Você pode preencher manualmente ou enviar um documento para a IA completar os dados com você.
              </p>
              <button onClick={() => setModo("manual")}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#E5C2C6] hover:shadow-sm transition">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: MARROM }}>
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-900">Preencher manualmente</div>
                  <div className="mt-0.5 text-[12px] text-slate-600">
                    Informe apenas os campos que estão faltando. Salvamos seu progresso automaticamente.
                  </div>
                </div>
              </button>
              <button onClick={() => setModo("ia_upload")}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#E5C2C6] hover:shadow-sm transition">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: MARROM }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-slate-900">Enviar documento e usar IA</div>
                  <div className="mt-0.5 text-[12px] text-slate-600">
                    Envie um documento (RG, CNH, comprovante de residência) e a IA extrai as informações para você confirmar.
                  </div>
                </div>
              </button>
            </div>
          )}

          {modo === "manual" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-slate-500">
                  {mostrarTodos ? `${CAMPOS_CADASTRO.length} campos no total` : `${faltantes.length} campo(s) faltando`}
                </p>
                <button type="button" onClick={() => setMostrarTodos((v) => !v)}
                  className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:underline">
                  {mostrarTodos ? "Ver apenas faltantes" : "Ver todos os dados"}
                </button>
              </div>
              {camposVisiveis.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Cadastro completo!</h3>
                  <p className="text-sm text-slate-500 max-w-sm">Não há campos pendentes no momento.</p>
                </div>
              )}
              {gruposVisiveis.map(({ grupo, campos }) => (
                <section key={grupo}>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: MARROM }}>
                    {GRUPO_LABELS[grupo]}
                  </h3>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campos.map((c) => <div key={c.key}>{renderInput(c)}</div>)}
                  </div>
                </section>
              ))}
            </div>
          )}

          {modo === "ia_upload" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Envie um documento legível (RG, CNH, comprovante de residência, CR). A IA vai extrair os campos e você confirma antes de salvar.
              </p>
              <button onClick={handleEscolherArquivo} disabled={iaProcessando}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E5C2C6] bg-[#FBF3F4]/50 px-4 py-10 text-center transition hover:bg-[#FBF3F4] disabled:opacity-60">
                <div className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: MARROM }}>
                  {iaProcessando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {iaProcessando ? "Analisando documento…" : "Selecionar documento (JPG, PNG ou PDF)"}
                </span>
                <span className="text-[11px] text-slate-500">Máximo 20 MB. Seus dados não são compartilhados.</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadIA} />
            </div>
          )}

          {modo === "ia_revisao" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Revise os dados encontrados</h3>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Confira ou edite antes de salvar. Dados já existentes no seu cadastro não serão sobrescritos sem confirmação.
                </p>
              </div>
              {iaWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
                  <div className="font-bold uppercase tracking-wider mb-1">Avisos</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {iaWarnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(iaFields).length === 0 && (
                  <p className="col-span-full text-sm text-slate-500">Nenhum campo foi reconhecido com confiança. Volte e tente outro documento ou preencha manualmente.</p>
                )}
                {Object.entries(iaFields).map(([k, v]) => {
                  const def = CAMPOS_CADASTRO.find((c) => c.key === k);
                  const atual = cliente?.[k];
                  const conflito = !!atual && String(atual).trim() && String(atual).trim() !== String(v).trim();
                  return (
                    <div key={k} className={def?.colSpan === 2 ? "sm:col-span-2" : ""}>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{def?.label ?? k}</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:border-[#7A1F2B] focus:ring-2 focus:ring-[#7A1F2B]/15"
                        value={v}
                        onChange={(e) => setIaFields((prev) => ({ ...prev, [k]: e.target.value }))}
                      />
                      {conflito && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Já existe valor cadastrado — confirme para substituir.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setModo("ia_upload")}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50">
                  Enviar outro documento
                </button>
                <button type="button" onClick={confirmarSalvarIA} disabled={iaSalvando}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm disabled:opacity-60"
                  style={{ background: MARROM }}>
                  {iaSalvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : <>Confirmar e salvar</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-5 py-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Salvamento automático · Equipe Quero Armas</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}