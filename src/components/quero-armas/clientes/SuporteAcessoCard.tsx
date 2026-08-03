import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

type Props = { clienteId: string; clienteNome?: string | null; clienteEmail?: string | null };

/**
 * ACESSO DE SUPORTE (IMPERSONAÇÃO AUDITADA)
 * Não existe senha master. O operador entra com a própria conta admin e o
 * servidor emite uma sessão temporária na conta do cliente, registrando
 * quem entrou, motivo, processo, IP e horário — e avisando o cliente por e-mail.
 */
export default function SuporteAcessoCard({ clienteId, clienteNome, clienteEmail }: Props) {
  const [motivo, setMotivo] = useState("");
  const [processo, setProcesso] = useState("");
  const [loading, setLoading] = useState(false);

  async function iniciar() {
    if (motivo.trim().length < 5) { toast.error("Descreva o motivo do acesso."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-suporte-acesso", {
        body: {
          action: "iniciar",
          cliente_id: clienteId,
          motivo: motivo.trim(),
          processo_ref: processo.trim(),
          origin: window.location.origin,
        },
      });
      if (error || !data?.ok) { toast.error((data as any)?.error || error?.message || "Não foi possível abrir a sessão."); return; }
      toast.success("Sessão de suporte aberta. O cliente foi avisado por e-mail.");
      window.open(String(data.action_link), "_blank", "noopener");
      setMotivo(""); setProcesso("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#7A1F2B]" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Acesso de Suporte (auditado)</h4>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Abre uma sessão temporária na conta de <strong>{clienteNome || "este cliente"}</strong>
        {clienteEmail ? ` (${clienteEmail})` : ""}. O acesso fica registrado com seu e-mail, motivo, IP e horário,
        e o cliente recebe aviso imediato + resumo ao encerrar. Escopo: leitura e envio de documentos.
      </p>
      <Input
        value={processo}
        onChange={(e) => setProcesso(e.target.value.toUpperCase())}
        placeholder="PROCESSO / SERVIÇO (EX.: AUTORIZAÇÃO DE COMPRA)"
        className="h-9 text-xs"
      />
      <Textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo do acesso (obrigatório e registrado em auditoria)"
        className="text-xs min-h-[64px]"
      />
      <Button
        onClick={iniciar}
        disabled={loading || !clienteEmail}
        className="w-full bg-[#7A1F2B] hover:bg-[#641722] text-white text-xs font-bold h-10 rounded-xl uppercase tracking-wider"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
        Entrar como cliente
      </Button>
      {!clienteEmail && <p className="text-[10px] text-red-500">⚠ Cliente sem e-mail cadastrado.</p>}
    </div>
  );
}