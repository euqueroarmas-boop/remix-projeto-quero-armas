import { useState, useRef, useCallback, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Camera, CheckCircle2, Loader2, FileText, IdCard, UserCircle2,
  Sparkles, ChevronRight, RotateCcw, AlertCircle, ArrowLeft, Shield, Info, Search,
} from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";

/* =========================================================================
 * Cadastro do Cliente — Fluxo guiado em 4 etapas
 * 1) DOCUMENTOS  → 2) EXTRAÇÃO  → 3) REVISÃO  → 4) CONCLUSÃO
 * Premium, mobile-first, alta UX.
 * ========================================================================= */

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Documentos" },
  { id: 2, label: "Extração" },
  { id: 3, label: "Revisão" },
  { id: 4, label: "Conclusão" },
];

interface DocSlot {
  key: "identity" | "address" | "selfie";
  label: string;
  description: string;
  icon: typeof IdCard;
  capture?: "user" | "environment";
}

const SLOTS: DocSlot[] = [
  { key: "identity", label: "Documento com CPF", description: "RG, CNH ou CIN — frente e verso se possível", icon: IdCard },
  { key: "address",  label: "Comprovante de endereço", description: "Conta de luz, água, internet ou telefone", icon: FileText },
  { key: "selfie",   label: "Selfie de identificação",  description: "Foto sua segurando o documento", icon: UserCircle2, capture: "user" },
];

interface Extracted {
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  rg: string;
  emissor_rg: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  email: string;
  telefone_principal: string;
}

const emptyExtracted: Extracted = {
  nome_completo: "", cpf: "", data_nascimento: "", rg: "", emissor_rg: "",
  cep: "", logradouro: "", numero: "", bairro: "", cidade: "", estado: "",
  email: "", telefone_principal: "",
};

/* ─── helpers ─── */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function maskTel(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function brDateToIso(v: string): string {
  // dd/mm/aaaa → aaaa-mm-dd
  const m = v.trim().match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta || "")?.[1] || "image/jpeg";
  const ext = mime.split("/")[1]?.split(";")[0] || "jpg";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext };
}

/* ============================================================== */

export default function QACadastroPublicoPage() {
  const [step, setStep] = useState<StepId>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // arquivos / data URLs
  const [files, setFiles] = useState<Record<string, string>>({});
  const identityRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const selfieRef = useRef<HTMLInputElement | null>(null);
  const fileRefs = {
    identity: identityRef,
    address: addressRef,
    selfie: selfieRef,
  };

  // extração
  const [extractStage, setExtractStage] = useState<Record<string, "pending" | "processing" | "ok" | "fail">>({
    identity: "pending", address: "pending", selfie: "pending",
  });
  const [extracted, setExtracted] = useState<Extracted>(emptyExtracted);

  // submit
  const [savedId, setSavedId] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    status: string;
    created_at: string;
    existing: Record<string, any>;
    incoming: Record<string, any>;
  } | null>(null);
  const [updateExistingId, setUpdateExistingId] = useState<string | null>(null);

  /* ─── upload handler ─── */
  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Envie um arquivo de imagem"); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Imagem deve ter no máximo 10MB"); return; }
    setError(null);
    const url = await fileToDataUrl(f);
    setFiles(p => ({ ...p, [key]: url }));
  };

  const allUploaded = SLOTS.every(s => files[s.key]);

  /* ─── extração via IA ─── */
  const startExtraction = useCallback(async () => {
    setStep(2);
    setError(null);
    setExtractStage({ identity: "processing", address: "processing", selfie: "processing" });

    try {
      const { data, error } = await supabase.functions.invoke("qa-extract-documents", {
        body: {
          identity_image: files.identity,
          address_image: files.address,
        },
      });

      if (error) throw new Error(error.message || "Falha na extração");

      const id = data?.identity || {};
      const ad = data?.address || {};

      setExtracted(prev => ({
        ...prev,
        nome_completo: id.nome_completo || prev.nome_completo,
        cpf: id.cpf ? maskCpf(id.cpf) : prev.cpf,
        rg: id.rg || prev.rg,
        emissor_rg: id.emissor_rg && id.uf_emissor_rg
          ? `${id.emissor_rg}/${id.uf_emissor_rg}` : (id.emissor_rg || prev.emissor_rg),
        data_nascimento: id.data_nascimento || prev.data_nascimento,
        cep: ad.cep ? maskCep(ad.cep) : prev.cep,
        logradouro: ad.logradouro || prev.logradouro,
        numero: ad.numero || prev.numero,
        bairro: ad.bairro || prev.bairro,
        cidade: ad.cidade || prev.cidade,
        estado: ad.estado || prev.estado,
      }));

      setExtractStage({
        identity: data?.identity ? "ok" : "fail",
        address: data?.address ? "ok" : "fail",
        selfie: "ok", // selfie não passa por IA aqui — apenas confirma envio
      });

      // pequena pausa para o usuário ver "concluído"
      setTimeout(() => setStep(3), 700);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Não foi possível ler os documentos. Você pode preencher manualmente.");
      setExtractStage({ identity: "fail", address: "fail", selfie: "fail" });
    }
  }, [files]);

  /* ─── submissão final ─── */
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const cpfDigits = extracted.cpf.replace(/\D/g, "");
      if (cpfDigits.length !== 11) throw new Error("CPF inválido");
      if (!extracted.nome_completo.trim()) throw new Error("Informe o nome completo");
      if (!extracted.email.trim()) throw new Error("Informe o e-mail");
      if (!extracted.telefone_principal.replace(/\D/g, "")) throw new Error("Informe o telefone");

      // upload dos arquivos
      const uploaded: { key: string; path: string }[] = [];
      for (const slot of SLOTS) {
        const dataUrl = files[slot.key];
        if (!dataUrl) continue;
        const { blob, ext } = dataUrlToBlob(dataUrl);
        const key = `cadastro-publico/${cpfDigits}-${slot.key}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("qa-cadastro-selfies")
          .upload(key, blob, { contentType: blob.type, upsert: true });
        if (upErr) throw new Error(`Falha ao enviar ${slot.label}: ${upErr.message}`);
        uploaded.push({ key: slot.key, path: key });
      }

      const pathOf = (k: string) => uploaded.find(u => u.key === k)?.path || null;

      const payload = {
        nome_completo: extracted.nome_completo.trim(),
        cpf: cpfDigits,
        rg: extracted.rg || null,
        emissor_rg: extracted.emissor_rg || null,
        data_nascimento: brDateToIso(extracted.data_nascimento) || null,
        telefone_principal: extracted.telefone_principal.replace(/\D/g, ""),
        email: extracted.email.trim(),
        end1_cep: extracted.cep.replace(/\D/g, "") || null,
        end1_logradouro: extracted.logradouro || null,
        end1_numero: extracted.numero || null,
        end1_bairro: extracted.bairro || null,
        end1_cidade: extracted.cidade || null,
        end1_estado: (extracted.estado || "").slice(0, 2).toUpperCase() || null,
        consentimento_dados_verdadeiros: true as const,
        consentimento_tratamento_dados: true as const,
        documento_identidade_path: pathOf("identity"),
        comprovante_endereco_path: pathOf("address"),
        selfie_path: pathOf("selfie"),
      };

      const { data, error } = await supabase.functions.invoke("qa-cadastro-publico", {
        body: updateExistingId ? { ...payload, update_existing_id: updateExistingId } : payload,
      });
      // Tenta extrair o body mesmo em erros HTTP (ex.: 409 duplicate_cpf)
      let body: any = data;
      if (error && (error as any).context?.json) {
        try { body = await (error as any).context.json(); } catch { /* ignore */ }
      } else if (error && (error as any).context?.text) {
        try { body = JSON.parse(await (error as any).context.text()); } catch { /* ignore */ }
      }

      if (body?.error === "duplicate_cpf" && body.existing_id) {
        setDuplicate({
          id: body.existing_id,
          status: body.existing_status || "—",
          created_at: body.existing_created_at || "",
          existing: body.existing_data || {},
          incoming: payload as Record<string, any>,
        });
        return;
      }
      if (error) throw new Error(error.message || "Erro ao enviar cadastro");
      if (body?.error) throw new Error(body.message || body.error);

      setSavedId(body?.id || null);
      setStep(4);
    } catch (e: any) {
      setError(e?.message || "Erro ao concluir cadastro");
    } finally {
      setBusy(false);
    }
  };

  /* ─── render ─── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, hsl(220 25% 97%) 0%, hsl(225 30% 94%) 100%)" }}>
      <div className="max-w-md w-full mx-auto px-4 py-6 flex-1">
        <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.06)] border border-slate-200/60 overflow-hidden">
          {/* Cabeçalho + stepper */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-[22px] font-bold leading-tight" style={{ color: "hsl(220 25% 15%)" }}>
                  Cadastro do Cliente
                </h1>
                <p className="text-xs mt-1" style={{ color: "hsl(220 10% 50%)" }}>
                  {step === 1 && "Envie seus documentos para iniciar"}
                  {step === 2 && "Estamos lendo suas informações"}
                  {step === 3 && "Revise as informações extraídas"}
                  {step === 4 && "Tudo pronto!"}
                </p>
              </div>
              <QALogo className="h-10 w-auto shrink-0" />
            </div>
            <Stepper current={step} />
          </div>

          {/* Conteúdo */}
          <div className="px-6 pb-6">
            {step === 1 && (
              <Step1Documents
                files={files}
                fileRefs={fileRefs}
                onPick={handlePick}
                onContinue={startExtraction}
                onManual={() => { setExtracted(emptyExtracted); setStep(3); }}
                allUploaded={allUploaded}
                error={error}
              />
            )}

            {step === 2 && <Step2Extracting stages={extractStage} error={error} />}

            {step === 3 && (
              <Step3Review
                data={extracted}
                onChange={setExtracted}
                onContinue={submit}
                onBack={() => setStep(1)}
                busy={busy}
                error={error}
              />
            )}

            {step === 4 && <Step4Done firstName={extracted.nome_completo.split(" ")[0] || ""} />}
          </div>
        </div>

        {duplicate && (
          <DuplicateModal
            info={duplicate}
            busy={busy}
            onCancel={() => setDuplicate(null)}
            onConfirm={async () => {
              setUpdateExistingId(duplicate.id);
              setDuplicate(null);
              // Re-submete imediatamente como atualização
              setTimeout(() => submit(), 0);
            }}
          />
        )}

        {/* Selo LGPD */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "hsl(220 10% 50%)" }}>
          <Shield className="w-3 h-3" style={{ color: "hsl(230 80% 56%)" }} />
          Dados protegidos conforme a LGPD
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Stepper ─────────────────────── */
function DuplicateModal({
  info, busy, onCancel, onConfirm,
}: {
  info: { id: string; status: string; created_at: string; existing: Record<string, any>; incoming: Record<string, any> };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dt = info.created_at ? new Date(info.created_at).toLocaleDateString("pt-BR") : "";

  // Campos comparados (rótulo + chave no objeto persistido)
  const FIELDS: { label: string; key: string; format?: (v: any) => string }[] = [
    { label: "Nome completo", key: "nome_completo" },
    { label: "CPF", key: "cpf", format: (v) => v ? maskCpf(String(v)) : "" },
    { label: "RG", key: "rg" },
    { label: "Emissor", key: "emissor_rg" },
    { label: "Data de nascimento", key: "data_nascimento", format: (v) => {
        if (!v) return "";
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          const [y, m, d] = s.slice(0, 10).split("-");
          return `${d}/${m}/${y}`;
        }
        return s;
      } },
    { label: "Telefone", key: "telefone_principal", format: (v) => v ? maskTel(String(v)) : "" },
    { label: "E-mail", key: "email" },
    { label: "CEP", key: "end1_cep", format: (v) => v ? maskCep(String(v)) : "" },
    { label: "Logradouro", key: "end1_logradouro" },
    { label: "Número", key: "end1_numero" },
    { label: "Bairro", key: "end1_bairro" },
    { label: "Cidade", key: "end1_cidade" },
    { label: "UF", key: "end1_estado" },
  ];

  const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
  const rows = FIELDS.map((f) => {
    const oldRaw = info.existing?.[f.key];
    const newRaw = info.incoming?.[f.key];
    const oldVal = f.format ? f.format(oldRaw) : norm(oldRaw);
    const newVal = f.format ? f.format(newRaw) : norm(newRaw);
    const changed = norm(oldRaw) !== norm(newRaw) && norm(newRaw) !== "";
    return { label: f.label, oldVal, newVal, changed };
  });
  const changedRows = rows.filter((r) => r.changed);
  const hasChanges = changedRows.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 overflow-hidden"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
        paddingLeft: "max(env(safe-area-inset-left), 12px)",
        paddingRight: "max(env(safe-area-inset-right), 12px)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.18)] border border-slate-200/60 overflow-hidden max-h-full flex flex-col min-w-0">
        {/* Cabeçalho */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-start gap-2 mb-1.5">
            <Info className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
            <h3 className="text-base font-bold leading-snug break-words min-w-0 flex-1" style={{ color: "hsl(220 25% 15%)" }}>
              Cadastro já existe
            </h3>
          </div>
          <p className="text-[11px] leading-relaxed break-words" style={{ color: "hsl(220 10% 45%)" }}>
            Já encontramos um cadastro com este CPF{dt ? ` (criado em ${dt})` : ""}.
            Status atual: <strong>{info.status}</strong>.
            {hasChanges
              ? " Confira abaixo as alterações que serão aplicadas:"
              : " Não detectamos alterações nos dados enviados."}
          </p>
        </div>

        {/* Diff lado a lado */}
        {hasChanges && (
          <div className="px-4 sm:px-5 py-3 overflow-y-auto overflow-x-hidden flex-1 qa-diff-scroll min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 mb-2 px-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                Atual
              </span>
              <span className="w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-right" style={{ color: "hsl(230 80% 56%)" }}>
                Novo
              </span>
            </div>

            <div className="space-y-2.5">
              {changedRows.map((r) => (
                <div
                  key={r.label}
                  className="rounded-lg border p-2.5 min-w-0"
                  style={{ borderColor: "hsl(230 80% 92%)", background: "hsl(230 90% 98%)" }}
                >
                  <div className="text-[9px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "hsl(220 15% 45%)" }}>
                    {r.label}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div
                      className="text-[12px] font-medium px-2 py-1.5 rounded-md line-through min-w-0 break-all"
                      style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 55%)", overflowWrap: "anywhere" }}
                    >
                      {r.oldVal || <span className="italic opacity-60">vazio</span>}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
                    <div
                      className="text-[12px] font-semibold px-2 py-1.5 rounded-md min-w-0 break-all"
                      style={{ background: "white", color: "hsl(230 70% 35%)", border: "1px solid hsl(230 80% 80%)", overflowWrap: "anywhere" }}
                    >
                      {r.newVal || <span className="italic opacity-60">vazio</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-[10px] text-center" style={{ color: "hsl(220 10% 50%)" }}>
              {changedRows.length} {changedRows.length === 1 ? "campo será alterado" : "campos serão alterados"}
            </div>
          </div>
        )}

        {/* Ações — sticky bar */}
        <div
          className="px-4 sm:px-5 pt-3 pb-3 border-t border-slate-100 flex gap-2 shrink-0 bg-white"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          <button
            onClick={onCancel}
            disabled={busy}
            className="shrink-0 px-4 h-11 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-50"
            style={{ color: "hsl(220 25% 25%)" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 min-w-0 h-11 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5 px-3"
            style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))" }}
          >
            {busy ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span className="truncate">{hasChanges ? "Confirmar atualização" : "Atualizar mesmo assim"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: StepId }) {
  return (
    <div className="mt-5 px-2">
      {/* Linha de círculos + conectores */}
      <div className="flex items-start">
        {STEPS.map((s, i) => {
          const done = current > s.id;
          const active = current === s.id;
          const nextReached = current > s.id;
          const isLast = i === STEPS.length - 1;
          return (
            <Fragment key={s.id}>
              <div className="flex flex-col items-center shrink-0" style={{ width: 56 }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold"
                  style={{
                    background: done
                      ? "hsl(152 65% 45%)"
                      : active
                        ? "hsl(222 89% 55%)"
                        : "hsl(220 15% 90%)",
                    color: done || active ? "white" : "hsl(220 10% 55%)",
                    boxShadow: active ? "0 0 0 4px hsl(222 89% 55% / 0.15)" : "none",
                  }}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : s.id}
                </div>
                <span
                  className="mt-1.5 text-[11px] font-medium text-center leading-tight"
                  style={{ color: active ? "hsl(220 25% 20%)" : "hsl(220 10% 55%)" }}
                >
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className="flex-1 h-[3px] rounded-full mt-[14px]"
                  style={{ background: nextReached ? "hsl(222 89% 55%)" : "hsl(220 13% 88%)" }}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── Step 1 — Documentos ─────────────────────── */
function Step1Documents({
  files, fileRefs, onPick, onContinue, onManual, allUploaded, error,
}: any) {
  return (
    <div className="space-y-3">
      {SLOTS.map(slot => {
        const Icon = slot.icon;
        const sent = !!files[slot.key];
        return (
          <button
            key={slot.key}
            type="button"
            onClick={() => fileRefs[slot.key].current?.click()}
            className="w-full text-left rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-all hover:border-slate-300 shadow-[0_3px_12px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md border border-slate-200 flex items-center justify-center" style={{ background: "hsl(220 20% 97%)" }}>
                <Icon className="w-3.5 h-3.5" style={{ color: "hsl(220 25% 25%)" }} />
              </div>
              <span className="text-[15px] font-semibold leading-none" style={{ color: "hsl(220 25% 15%)" }}>
                {slot.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {sent ? (
                <div
                  className={slot.key === "selfie"
                    ? "rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block"
                    : "rounded-md overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block"}
                  style={slot.key === "selfie"
                    ? { width: 90, height: 90, minWidth: 90, maxWidth: 90, minHeight: 90, maxHeight: 90 }
                    : { width: 140, height: 90, minWidth: 140, maxWidth: 140, minHeight: 90, maxHeight: 90 }}
                >
                  <img
                    src={files[slot.key]}
                    alt=""
                    className="w-full h-full object-cover block"
                    style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
                  />
                </div>
              ) : (
                <div className={slot.key === "selfie"
                  ? "w-[90px] h-[90px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 rounded-full"
                  : "w-[140px] h-[90px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 rounded-md"}>
                  {slot.key === "selfie"
                    ? <Camera className="w-6 h-6" style={{ color: "hsl(220 10% 55%)" }} />
                    : <Upload className="w-6 h-6" style={{ color: "hsl(220 10% 55%)" }} />}
                </div>
              )}
              <span
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold"
                style={sent
                  ? { background: "hsl(152 65% 93%)", color: "hsl(152 65% 34%)" }
                  : { background: "hsl(220 20% 96%)", color: "hsl(220 10% 48%)" }}
              >
                {sent ? <CheckCircle2 className="w-3.5 h-3.5" /> : (slot.key === "selfie" ? <Camera className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />)}
                {sent ? "Enviado" : "Enviar"}
              </span>
            </div>
            <input
              ref={fileRefs[slot.key]}
              type="file"
              accept="image/*"
              capture={slot.capture}
              hidden
              onChange={(e) => onPick(e, slot.key)}
            />
          </button>
        );
      })}

      {error && (
        <div className="p-3 rounded-lg flex gap-2 text-xs"
          style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 40%)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={!allUploaded}
        className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        style={{ background: "linear-gradient(135deg, hsl(219 90% 56%), hsl(225 88% 54%))", boxShadow: "0 6px 18px hsl(222 89% 55% / 0.28)" }}
      >
        Extrair dados
      </button>

      <button
        onClick={onManual}
        className="w-full h-9 text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: "hsl(220 15% 45%)" }}
      >
        Preencher manualmente
      </button>
    </div>
  );
}

/* ─────────────────────── Step 2 — Extração ─────────────────────── */
function Step2Extracting({ stages, error }: { stages: Record<string, string>; error: string | null }) {
  return (
    <div className="py-3">
      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-5 shadow-[0_3px_12px_rgba(15,23,42,0.06)]">
        <div className="mx-auto w-32 h-32 rounded-full flex items-center justify-center mb-5"
          style={{ background: "hsl(220 95% 96%)" }}>
          <div className="relative">
            <FileText className="w-16 h-16" strokeWidth={1.6} style={{ color: "hsl(217 82% 58%)" }} />
            <Search className="w-7 h-7 absolute -bottom-1 -right-1" strokeWidth={2} style={{ color: "hsl(217 82% 58%)" }} />
            <Sparkles className="w-4 h-4 absolute -top-1 right-1 animate-pulse" style={{ color: "hsl(217 82% 68%)" }} />
          </div>
        </div>
        <h2 className="text-center text-[17px] leading-tight font-bold mb-3" style={{ color: "hsl(220 25% 15%)" }}>
          Extraindo dados dos<br />documentos...
        </h2>

        <div className="h-1.5 rounded-full overflow-hidden mb-2 mx-2" style={{ background: "hsl(220 20% 92%)" }}>
          <div className="h-full animate-[progress_2.5s_ease-in-out_infinite]"
            style={{ background: "hsl(217 82% 58%)", width: "66%" }} />
        </div>
        <p className="text-center text-xs mb-4" style={{ color: "hsl(220 10% 50%)" }}>Aguarde um momento...</p>

        <div className="border-t border-slate-100 pt-3 space-y-2">
        {SLOTS.map(s => {
          const Icon = s.icon;
          const st = stages[s.key];
          const chipStyle = s.key === "selfie"
            ? { background: "hsl(217 95% 96%)", color: "hsl(217 82% 58%)" }
            : { background: "hsl(152 65% 95%)", color: "hsl(152 55% 42%)" };
          return (
            <div key={s.key} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={chipStyle}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium truncate" style={{ color: "hsl(220 25% 20%)" }}>{s.label}</span>
              </div>
              {st === "ok" && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "hsl(152 65% 45%)" }}>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </span>
              )}
              {st === "processing" && (
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(222 89% 55%)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> processando
                </span>
              )}
              {st === "fail" && <AlertCircle className="w-4 h-4" style={{ color: "hsl(0 70% 55%)" }} />}
            </div>
          );
        })}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg flex gap-2 text-xs" style={{ background: "hsl(40 90% 96%)", color: "hsl(30 70% 35%)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(20%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────── Step 3 — Revisão ─────────────────────── */
function Step3Review({
  data, onChange, onContinue, onBack, busy, error,
}: {
  data: Extracted; onChange: (v: Extracted) => void;
  onContinue: () => void; onBack: () => void; busy: boolean; error: string | null;
}) {
  const set = (k: keyof Extracted, v: string) => onChange({ ...data, [k]: v });

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "hsl(220 10% 50%)" }}>
        <ArrowLeft className="w-3 h-3" /> Voltar
      </button>

      <div className="rounded-xl p-3 flex items-center gap-2"
        style={{ background: "hsl(230 90% 97%)", border: "1px solid hsl(230 80% 92%)" }}>
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
        <span className="text-[11px] font-medium" style={{ color: "hsl(230 50% 35%)" }}>
          Dados extraídos automaticamente — revise e ajuste
        </span>
      </div>

      <ReviewField label="Nome completo" value={data.nome_completo} onChange={(v) => set("nome_completo", v)} required />
      <ReviewField label="CPF" value={data.cpf} onChange={(v) => set("cpf", maskCpf(v))} placeholder="000.000.000-00" required />
      <ReviewField label="Data de nascimento" value={data.data_nascimento} onChange={(v) => set("data_nascimento", v)} placeholder="DD/MM/AAAA" />

      <div className="grid grid-cols-2 gap-2">
        <ReviewField label="RG" value={data.rg} onChange={(v) => set("rg", v)} />
        <ReviewField label="Emissor" value={data.emissor_rg} onChange={(v) => set("emissor_rg", v)} placeholder="SSP/SP" />
      </div>

      <ReviewField label="E-mail" value={data.email} onChange={(v) => set("email", v)} placeholder="seu@email.com" required />
      <ReviewField label="Telefone" value={data.telefone_principal} onChange={(v) => set("telefone_principal", maskTel(v))} placeholder="(11) 99999-9999" required />

      <div className="pt-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "hsl(220 15% 40%)" }}>
          Endereço
        </div>
        <ReviewField label="CEP" value={data.cep} onChange={(v) => set("cep", maskCep(v))} placeholder="00000-000" />
        <div className="grid grid-cols-[1fr_80px] gap-2 mt-2">
          <ReviewField label="Logradouro" value={data.logradouro} onChange={(v) => set("logradouro", v)} />
          <ReviewField label="Número" value={data.numero} onChange={(v) => set("numero", v)} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <ReviewField label="Bairro" value={data.bairro} onChange={(v) => set("bairro", v)} />
          <ReviewField label="Cidade" value={data.cidade} onChange={(v) => set("cidade", v)} />
        </div>
        <ReviewField label="UF" value={data.estado} onChange={(v) => set("estado", v.toUpperCase().slice(0, 2))} placeholder="SP" />
      </div>

      {error && (
        <div className="p-3 rounded-lg flex gap-2 text-xs" style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 40%)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={busy}
        className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))", boxShadow: "0 4px 14px hsl(230 80% 56% / 0.35)" }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        Continuar
      </button>
    </div>
  );
}

function ReviewField({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
        style={{ color: "hsl(220 15% 45%)" }}>
        {label}{required && <span style={{ color: "hsl(0 70% 55%)" }}>*</span>}
        {value && <Sparkles className="w-2.5 h-2.5 ml-auto" style={{ color: "hsl(230 80% 60%)" }} />}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full h-10 px-3 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-[hsl(230_80%_70%)] transition"
        style={{ border: "1px solid hsl(220 13% 88%)", background: "white", color: "hsl(220 25% 18%)" }}
      />
    </label>
  );
}

/* ─────────────────────── Step 4 — Conclusão ─────────────────────── */
function Step4Done({ firstName }: { firstName: string }) {
  return (
    <div className="text-center py-4">
      <div className="relative w-24 h-24 mx-auto mb-5">
        {/* confetti pontos */}
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          const r = 50 + (i % 3) * 8;
          const colors = ["hsl(152 60% 50%)", "hsl(45 90% 55%)", "hsl(230 80% 60%)", "hsl(280 60% 60%)"];
          return (
            <span key={i} className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                top: `calc(50% + ${Math.sin(angle) * r}px)`,
                left: `calc(50% + ${Math.cos(angle) * r}px)`,
                background: colors[i % colors.length], opacity: 0.7,
              }} />
          );
        })}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_24px_hsl(152_60%_50%/0.4)]"
            style={{ background: "linear-gradient(135deg, hsl(152 60% 45%), hsl(160 65% 42%))" }}>
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-1.5" style={{ color: "hsl(220 25% 18%)" }}>Cadastro completo!</h2>
      <p className="text-xs mb-4" style={{ color: "hsl(220 10% 50%)" }}>
        Suas informações foram extraídas, revisadas e enviadas com sucesso.
      </p>

      <div className="rounded-xl p-3 text-left flex gap-2 mb-5"
        style={{ background: "hsl(230 90% 97%)", border: "1px solid hsl(230 80% 92%)" }}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(230 80% 56%)" }} />
        <div className="text-[11px] leading-relaxed" style={{ color: "hsl(220 25% 25%)" }}>
          <strong>Tudo certo{firstName ? `, ${firstName}` : ""}.</strong> Seu acesso ao sistema será liberado após validação pela nossa equipe. Você receberá um e-mail quando estiver tudo pronto.
        </div>
      </div>

      <a
        href="/quero-armas/area-do-cliente/login"
        className="block w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))", boxShadow: "0 4px 14px hsl(230 80% 56% / 0.35)" }}
      >
        Acessar sistema
      </a>

      <a href="https://wa.me/5511963166915" target="_blank" rel="noreferrer"
        className="block mt-2 text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: "hsl(220 15% 45%)" }}>
        Quero tirar dúvidas
      </a>
    </div>
  );
}
