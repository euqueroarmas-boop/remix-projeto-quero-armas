// ============================================================================
// ClienteCadastroProgressivoModal
// ----------------------------------------------------------------------------
// Modal "Completar cadastro" com dois caminhos:
//   1) Preencher manualmente — salva campo a campo via debounce (qa-cliente-
//      atualizar-cadastro), persistindo o progresso para o cliente.
//   2) Enviar documento e usar IA — faz upload e chama qa-cliente-prefill;
//      o cliente revisa os campos extraídos antes de salvar.
// Mantém Cockpit Z6 Light / Arsenal UI (papel + bordô #7A1F2B). Sem fundo preto.
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
  if (tipo === "text" || tipo == null) return s.toUpperCase();
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
  const [iaFile, setIaFile] = useState<File | null>(null);
  const [checklistMatches, setChecklistMatches] = useState<ChecklistMatch[]>([]);
  const [checklistSelecionados, setChecklistSelecionados] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Record<string, number>>({});

  // Busca endereço via ViaCEP e preenche campos de endereço vazios.
  const fetchViaCep = useCallback(async (cepRaw: string) => {
    const digits = cepRaw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.erro) return;
      const candidates: Record<string, string> = {};
      if (data.logradouro) candidates.endereco = String(data.logradouro).toUpperCase();
      if (data.bairro)     candidates.bairro   = String(data.bairro).toUpperCase();
      if (data.localidade) candidates.cidade   = String(data.localidade).toUpperCase();
      if (data.uf)         candidates.estado   = String(data.uf).toUpperCase();
      const toFill: Record<string, string> = {};
      for (const [k, v] of Object.entries(candidates)) {
        if (!v) continue;
        const existing = cliente?.[k];
        if (!existing || !String(existing).trim()) toFill[k] = v;
      }
      if (!Object.keys(toFill).length) return;
      setValores((prev) => ({ ...prev, ...toFill }));
      const r = await chamarAtualizarCadastro(toFill);
      if (r.ok) onUpdated?.();
    } catch { /* ViaCEP indisponível — continua sem erro */ }
  }, [cliente, onUpdated]);

  useEffect(() => {
    if (open) {
      setModo("escolher");
      setMostrarTodos(false);
      setValores({});
      setSavingState({});
      setIaFields({});
      setIaWarnings([]);
      setIaFile(null);
      setChecklistMatches([]);
      setChecklistSelecionados({});
      // Se CEP já está salvo mas endereço está vazio, busca via ViaCEP automaticamente.
      const cepSalvo = cliente?.cep;
      if (cepSalvo && !cliente?.endereco) {
        fetchViaCep(String(cepSalvo));
      }
    }
    return () => {
      Object.values(timersRef.current).forEach((t) => window.clearTimeout(t));
      timersRef.current = {};
    };
  }, [open, fetchViaCep]);

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
    else if (campo.tipo === "text" || campo.tipo == null) v = raw.toUpperCase();
    setValores((prev) => ({ ...prev, [campo.key]: v }));
    setSavingState((prev) => ({ ...prev, [campo.key]: "idle" }));

    // CEP completo → busca endereço automaticamente
    if (campo.tipo === "cep" && raw.replace(/\D/g, "").length === 8) {
      fetchViaCep(v);
    }

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
  }, [onUpdated, fetchViaCep]);

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
      setIaFile(file);
      // Procura itens pendentes do checklist que combinem com este documento.
      try {
        const candidatos = tiposCanditatosDoDoc(mapped);
        if (candidatos.length > 0 && cliente?.id) {
          const procs = await listarProcessosElegiveisGuia(cliente.id);
          const matches: ChecklistMatch[] = [];
          for (const p of procs) {
            if (p.pendentes <= 0) continue;
            const carga = await carregarProcessoGuia(p.id);
            const pend = itensObrigatoriosGuia(carga).filter(
              (d) => itemPendenteAcaoGuia(d, carga.respostas) && tipoDocBate(d.tipo_documento, candidatos),
            );
            for (const d of pend) {
              matches.push({ processo: carga.processo, doc: d, label: `${d.nome_documento} — ${p.servico_nome}` });
            }
          }
          setChecklistMatches(matches);
          // Pré-marca todos (cliente decide se quer desmarcar).
          setChecklistSelecionados(Object.fromEntries(matches.map((m) => [m.doc.id, true])));
        }
      } catch {
        /* sem matches — não bloqueia o fluxo principal */
      }
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
    const matchesSelecionados = checklistMatches.filter((m) => checklistSelecionados[m.doc.id]);
    if (Object.keys(toSave).length === 0 && matchesSelecionados.length === 0) {
      toast.info("Nada novo para salvar.");
      onClose();
      return;
    }
    setIaSalvando(true);
    if (Object.keys(toSave).length > 0) {
      const r = await chamarAtualizarCadastro(toSave);
      if (!r.ok) {
        setIaSalvando(false);
        toast.error(r.error || "Erro ao salvar");
        return;
      }
    }
    // Encaminha o MESMO arquivo para os itens de checklist selecionados (sem novo upload pelo cliente).
    let checklistOk = 0;
    let checklistFail = 0;
    if (matchesSelecionados.length > 0 && iaFile) {
      for (const m of matchesSelecionados) {
        const r = await enviarDocumentoGuia(m.processo, m.doc, iaFile);
        if (r.ok) checklistOk++;
        else checklistFail++;
      }
    }
    setIaSalvando(false);
    const partes: string[] = [];
    if (Object.keys(toSave).length > 0) partes.push(`${Object.keys(toSave).length} campo(s) atualizado(s)`);
    if (checklistOk > 0) partes.push(`${checklistOk} documento(s) enviado(s) ao checklist`);
    if (partes.length > 0) toast.success(partes.join(" · "));
    if (checklistFail > 0) toast.error(`${checklistFail} envio(s) ao checklist falhou(aram).`);
    onUpdated?.();
    onClose();
  };

  // ---------- render helpers ----------
  const renderInput = (campo: CampoCadastro) => {
    const v = valorAtual(campo);
    const state = savingState[campo.key] ?? "idle";
    const baseClass =
      "w-full rounded-[4px] border border-[#E5E5E5] bg-white px-3 py-2.5 text-[13px] text-[#0A0A0A] placeholder:text-[#9A9A9A] focus:outline-none focus:border-[#7A1F2B] focus:ring-2 focus:ring-[#7A1F2B]/15";
    return (
      <div className={campo.colSpan === 2 ? "sm:col-span-2" : ""}>
        <label className="font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6A6A6A]">{campo.label}</label>
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

  // Microcopy motivacional por etapa do progresso.
  const motivacao =
    progresso >= 100
      ? "MISSÃO CUMPRIDA — SEU DOSSIÊ ESTÁ COMPLETO."
      : progresso >= 70
        ? "RETA FINAL. MAIS ALGUNS CAMPOS E A IA OPERA COM CARGA TOTAL."
        : progresso >= 40
          ? "BOM RITMO. CONTINUE — A IA JÁ ESTÁ TRABALHANDO PARA VOCÊ."
          : "COMECE AGORA. QUANTO MAIS DADOS, MAIS PRECISA FICA A SUA IA.";

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="qa-scope w-[calc(100vw-1rem)] max-w-[825px] rounded-[4px] border border-[#E5E5E5] bg-white p-0 text-[#0A0A0A] shadow-sm max-h-[94dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
        {/* Header — Cockpit Z6 Light */}
        <div className="shrink-0 border-b border-[#E5E5E5] bg-white px-8 py-7">
          <div className="flex items-start gap-3">
            {modo !== "escolher" ? (
              <button type="button" onClick={() => setModo("escolher")} aria-label="Voltar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#E5E5E5] bg-white text-[#6A6A6A] hover:bg-[#F2F2F2]">
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="font-heading text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7A1F2B]">
                ARSENAL INTELIGENTE · CONTROLE DE DOCUMENTOS
              </div>
              <h2 className="font-heading text-[26px] font-semibold uppercase tracking-[0.03em] leading-[0.95] text-[#0A0A0A] mt-2">
                COMPLETE SEU DOSSIÊ
              </h2>
              <p className="mt-2 text-[13px] leading-snug text-[#6A6A6A] max-w-[670px]">
                Quanto mais a IA conhece você, mais ela <strong className="text-[#0A0A0A]">antecipa vencimentos, monta peças e protege seus processos</strong>. Salvamos cada campo automaticamente.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#E5E5E5] bg-white text-[#6A6A6A] hover:bg-[#F2F2F2]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* PROGRESSO — bloco Z6 */}
          <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
            <div>
              <div className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]">
                PROGRESSO DO CADASTRO
              </div>
              <div className="mt-2 h-[7px] w-full overflow-hidden rounded-[2px] bg-[#ECECEC]">
                <div className="h-full transition-all duration-500" style={{ width: `${progresso}%`, background: MARROM }} />
              </div>
              <div className="mt-2 font-heading text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#7A1F2B]">
                {motivacao}
              </div>
            </div>
            <div className="text-right leading-none">
              <span className="font-heading text-[46px] font-semibold text-[#0A0A0A]">{progresso}</span>
              <span className="font-heading text-[18px] font-semibold text-[#6A6A6A]">%</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-[280px] flex-1 overflow-y-auto bg-[#F3F1EF] px-8 py-6">
          {modo === "escolher" && (
            <div className="space-y-3">
              <div className="rounded-[4px] border border-[#E5E5E5] border-l-[3px] border-l-[#7A1F2B] bg-white p-5 shadow-sm">
                <div className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
                  POR QUE COMPLETAR AGORA
                </div>
                <p className="mt-1 text-[13px] leading-snug text-[#0A0A0A]">
                  Com seu cadastro completo, a IA <strong>monta peças jurídicas em segundos</strong>, <strong>avisa antes de qualquer documento vencer</strong> e mantém seu acervo blindado contra erros operacionais.
                </p>
              </div>
              <button onClick={() => setModo("ia_upload")}
                className="group flex w-full items-start gap-4 rounded-[4px] border border-[#E5E5E5] bg-white p-5 text-left shadow-sm transition hover:border-[#7A1F2B]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-white" style={{ background: MARROM }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">CAMINHO RÁPIDO · RECOMENDADO</div>
                  <div className="font-heading text-[15px] font-semibold uppercase tracking-[0.02em] text-[#0A0A0A] mt-0.5">
                    DEIXE A IA LER SEU DOCUMENTO
                  </div>
                  <div className="mt-1 text-[12.5px] leading-snug text-[#6A6A6A]">
                    Envie RG, CNH ou comprovante de residência. Em segundos a IA extrai os campos, e você só confirma.
                  </div>
                </div>
              </button>
              <button onClick={() => setModo("manual")}
                className="flex w-full items-start gap-4 rounded-[4px] border border-[#E5E5E5] bg-white p-5 text-left shadow-sm transition hover:border-[#7A1F2B]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-[#E5E5E5] bg-white text-[#0A0A0A]">
                  <Pencil className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]">PREENCHIMENTO MANUAL</div>
                  <div className="font-heading text-[15px] font-semibold uppercase tracking-[0.02em] text-[#0A0A0A] mt-0.5">
                    EU DIGITO OS CAMPOS
                  </div>
                  <div className="mt-1 text-[12.5px] leading-snug text-[#6A6A6A]">
                    Aparecem só os campos faltantes. Salvamento automático a cada toque — sem botão de enviar.
                  </div>
                </div>
              </button>
            </div>
          )}

          {modo === "manual" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A]">
                  {mostrarTodos ? `${CAMPOS_CADASTRO.length} campos no total` : `${faltantes.length} campo(s) faltando`}
                </p>
                <button type="button" onClick={() => setMostrarTodos((v) => !v)}
                  className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A1F2B] hover:underline">
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
                <section key={grupo} className="rounded-[4px] border border-[#E5E5E5] bg-white p-4 shadow-sm">
                  <h3 className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MARROM }}>
                    {GRUPO_LABELS[grupo]}
                  </h3>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campos.map((c) => <div key={c.key}>{renderInput(c)}</div>)}
                  </div>
                </section>
              ))}
            </div>
          )}

          {modo === "ia_upload" && (
            <div className="space-y-4">
              <div className="rounded-[4px] border-l-[3px] border-[#7A1F2B] bg-white p-4 shadow-sm">
                <div className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
                  UM DOCUMENTO. DEZENAS DE CAMPOS.
                </div>
                <p className="mt-1 text-[13px] leading-snug text-[#0A0A0A]">
                  Envie RG, CNH, comprovante de residência ou CR. A IA extrai tudo, você só <strong>confirma e segue</strong>.
                </p>
              </div>
              <button onClick={handleEscolherArquivo} disabled={iaProcessando}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-[#E5E5E5] bg-white px-4 py-10 text-center transition hover:border-[#7A1F2B] disabled:opacity-60">
                <div className="flex h-12 w-12 items-center justify-center rounded-[4px] text-white" style={{ background: MARROM }}>
                  {iaProcessando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </div>
                <span className="font-heading text-[13px] font-semibold uppercase tracking-[0.08em] text-[#0A0A0A]">
                  {iaProcessando ? "Analisando documento…" : "Selecionar documento (JPG, PNG ou PDF)"}
                </span>
                <span className="text-[11px] text-[#6A6A6A]">Máximo 20 MB · Tratamento sigiloso e LGPD-compliant</span>
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
              {checklistMatches.length > 0 && (
                <div className="rounded-xl border border-[#E5C2C6] bg-[#FBF3F4]/50 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: MARROM }} />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: MARROM }}>
                        Aproveitar este documento no checklist?
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        O mesmo arquivo pode ser enviado para os itens pendentes do seu checklist — sem precisar fazer upload novamente.
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {checklistMatches.map((m) => (
                          <label key={m.doc.id} className="flex items-start gap-2 text-[12px] text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#7A1F2B]"
                              checked={!!checklistSelecionados[m.doc.id]}
                              onChange={(e) =>
                                setChecklistSelecionados((prev) => ({ ...prev, [m.doc.id]: e.target.checked }))
                              }
                            />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
        <div className="shrink-0 border-t border-[#E5E5E5] bg-white px-8 py-3 text-center">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]">
            SALVAMENTO AUTOMÁTICO · ARSENAL INTELIGENTE QUERO ARMAS
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}