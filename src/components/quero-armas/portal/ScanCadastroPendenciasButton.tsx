// ============================================================================
// ScanCadastroPendenciasButton
// ----------------------------------------------------------------------------
// CTA no Resumo do portal do cliente: dispara qa-cliente-auto-prefill para
// varrer documentos já enviados (RG, CIN, CNH, comprovante, CR…) e preencher
// automaticamente os campos pendentes do cadastro.
// Visual: "Mira Inteligente" — retículo de luneta animado durante a varredura,
// papel + bordô #7A1F2B (Cockpit Z6 Light / Arsenal UI).
// ============================================================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crosshair, Loader2 } from "lucide-react";

const MARROM = "#7A1F2B";

interface Props {
  onUpdated?: () => void;
}

export default function ScanCadastroPendenciasButton({ onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ campos: number; docs: number } | null>(null);

  const handleScan = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada — entre novamente.");
        return;
      }
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${base}/functions/v1/qa-cliente-auto-prefill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        toast.error("Falha na varredura. Tente novamente em instantes.");
        return;
      }
      const data = await resp.json();
      const applied = (data?.applied || {}) as Record<string, string>;
      const docs = Number(data?.docs_processed || 0);
      const campos = Object.keys(applied).length;
      setLast({ campos, docs });
      if (campos > 0) {
        toast.success(`Mira concluída: ${campos} campo(s) preenchido(s) a partir de ${docs} documento(s).`);
        onUpdated?.();
      } else if (docs > 0) {
        toast.info(`${docs} documento(s) varridos — nada novo a preencher.`);
      } else {
        toast.info("Nenhum documento elegível encontrado para varredura.");
      }
    } catch {
      toast.error("Erro inesperado na varredura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="qa-scope relative overflow-hidden rounded-[3px] border border-[#E5E5E5] bg-white shadow-sm"
      style={{ borderLeft: `3px solid ${MARROM}` }}
    >
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-5">
        <div className="flex items-start gap-3 md:items-center">
          {/* Retículo de luneta */}
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${
              loading ? "border-[#7A1F2B]" : "border-[#E5E5E5]"
            }`}
            style={{ background: "#FAFAFA" }}
          >
            <span
              aria-hidden
              className={`absolute inset-1 rounded-full border border-dashed ${loading ? "border-[#7A1F2B]/60 animate-spin" : "border-[#E5E5E5]"}`}
              style={loading ? { animationDuration: "2.8s" } : undefined}
            />
            <Crosshair
              className={`h-6 w-6 ${loading ? "text-[#7A1F2B]" : "text-[#0A0A0A]"}`}
              strokeWidth={1.6}
            />
            {loading && (
              <span
                aria-hidden
                className="absolute left-1 right-1 top-1/2 h-px -translate-y-1/2"
                style={{
                  background: `linear-gradient(90deg, transparent, ${MARROM}, transparent)`,
                  animation: "qa-scan-line 1.4s ease-in-out infinite",
                }}
              />
            )}
          </div>

          <div>
            <div className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-[#7A1F2B]">
              MIRA INTELIGENTE · CADASTRO
            </div>
            <h3 className="mt-0.5 font-heading text-[15px] font-black uppercase tracking-[0.04em] text-[#0A0A0A]">
              Varrer documentos e preencher pendências
            </h3>
            <p className="mt-1 text-[12.5px] leading-snug text-[#5A5A5A]">
              A IA mira nos seus RG, CIN, CNH, comprovante de residência e CR já enviados,
              extrai cada dado <strong className="text-[#0A0A0A]">e completa o cadastro por você</strong>.
            </p>
            {last && !loading && (
              <p className="mt-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-[#6A6A6A]">
                Última mira: {last.campos} campo(s) · {last.docs} doc(s) varrido(s)
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleScan}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-[2px] px-4 py-2.5 font-heading text-[11px] font-black uppercase tracking-[0.18em] text-white transition disabled:cursor-not-allowed disabled:opacity-70 md:self-auto"
          style={{ background: MARROM }}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mirando…
            </>
          ) : (
            <>
              <Crosshair className="h-3.5 w-3.5" />
              Disparar Mira
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes qa-scan-line {
          0%   { transform: translateY(-14px); opacity: 0; }
          15%  { opacity: 1; }
          50%  { transform: translateY(0); opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(14px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}