import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, Loader2, RefreshCw, Trash2, Unlock, ShieldOff,
  CheckCircle2, XCircle, KeyRound, Link2Off,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  cliente: { id: number; nome_completo: string; cpf: string; email: string };
}

type Diag = {
  vendas: any[];
  contratos: any[];
  link: any;
  cadastros_publicos: any[];
  auth_user_existe: boolean;
  auth_user_email: string | null;
  venda_paga: boolean;
  venda_pendente: boolean;
  contrato_assinado: boolean;
  reset_total_bloqueado: boolean;
  bloqueio_motivo: string | null;
};

const fmtDT = (iso?: string | null) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return iso; }
};

export default function ClienteDestravarCadastro({ cliente }: Props) {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [confirmCpf, setConfirmCpf] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const call = useCallback(async (action: string, extra: any = {}) => {
    const { data, error } = await supabase.functions.invoke("qa-admin-destravar-cadastro", {
      body: { action, cliente_id: cliente.id, motivo, ...extra },
    });
    if (error) {
      const m = (data as any)?.message || (data as any)?.error || error.message;
      throw new Error(m);
    }
    if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
    return data;
  }, [cliente.id, motivo]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await call("diagnose");
      setDiag(data as any);
    } catch (e: any) {
      toast.error("Falha ao diagnosticar: " + e.message);
    } finally { setLoading(false); }
  }, [call]);

  useEffect(() => { void carregar(); }, [carregar]);

  const run = async (action: string, extra: any = {}, label: string) => {
    if (!motivo || motivo.trim().length < 6) {
      toast.error("Informe o motivo (mín. 6 caracteres).");
      return;
    }
    if (!confirm(`Confirmar: ${label}?`)) return;
    setBusy(action);
    try {
      await call(action, extra);
      toast.success(`${label} concluído.`);
      await carregar();
      if (action === "reset_total") {
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    } finally { setBusy(null); }
  };

  if (loading || !diag) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Diagnosticando cadastro…
      </div>
    );
  }

  const cpfNorm = (cliente.cpf || "").replace(/\D/g, "");
  const cpfConfirmOk = confirmCpf.replace(/\D/g, "") === cpfNorm && cpfNorm.length === 11;

  return (
    <div className="space-y-4">
      {/* DIAGNÓSTICO */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#7A1F2B]">
            Diagnóstico do cadastro
          </h3>
          <Button size="sm" variant="ghost" onClick={carregar} className="h-7">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <Stat label="Vendas" value={diag.vendas.length} tone={diag.venda_paga ? "danger" : diag.venda_pendente ? "warn" : "ok"} />
          <Stat label="Contratos" value={diag.contratos.length} tone={diag.contrato_assinado ? "danger" : "ok"} />
          <Stat label="Auth user" value={diag.auth_user_existe ? "Sim" : "Não"} tone={diag.auth_user_existe ? "warn" : "ok"} />
          <Stat label="Vínculo portal" value={diag.link ? diag.link.status : "Nenhum"} tone={diag.link ? "warn" : "ok"} />
        </div>
        {diag.vendas.length > 0 && (
          <div className="mt-3 space-y-1">
            {diag.vendas.slice(0, 5).map((v: any) => (
              <div key={v.id} className="text-[11px] flex items-center gap-2">
                {v.cobranca_confirmada_em
                  ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  : <XCircle className="h-3 w-3 text-amber-600" />}
                <span className="font-mono">#{v.id}</span>
                <span className="text-slate-500">{v.cobranca_status || v.status || "—"}</span>
                <span className="text-slate-400">{fmtDT(v.created_at)}</span>
                {v.cobranca_confirmada_em && <span className="text-emerald-700 font-bold">PAGA</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MOTIVO */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600 block mb-1">
          Motivo (obrigatório, registrado em auditoria)
        </label>
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.toUpperCase())}
          placeholder="EX.: CLIENTE SOLICITOU REINICIAR CADASTRO ANTES DE PAGAR"
          rows={2}
          className="text-[12px] uppercase"
        />
      </div>

      {/* AÇÕES GRANULARES */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#7A1F2B]">
          Ações cirúrgicas
        </h3>

        <ActionRow
          icon={Trash2}
          title="Cancelar vendas pendentes"
          desc="Remove vendas SEM pagamento confirmado, itens, contratos não assinados e eventos."
          disabled={!diag.venda_pendente}
          busy={busy === "cancel_pending_sale"}
          onClick={() => run("cancel_pending_sale", {}, "Cancelar vendas pendentes")}
        />

        <ActionRow
          icon={KeyRound}
          title="Resetar Auth (login do cliente)"
          desc="Apaga usuário de autenticação, sessões e perfil. Cliente continua existindo."
          disabled={!diag.auth_user_existe}
          busy={busy === "reset_auth"}
          onClick={() => run("reset_auth", {}, "Resetar Auth")}
        />

        <ActionRow
          icon={Link2Off}
          title="Remover vínculo do portal"
          desc="Apaga apenas cliente_auth_links. Cliente e Auth user permanecem."
          disabled={!diag.link}
          busy={busy === "reset_link"}
          onClick={() => run("reset_link", {}, "Remover vínculo")}
        />
      </div>

      {/* RESET TOTAL */}
      <div className={`rounded-xl border p-4 space-y-3 ${
        diag.reset_total_bloqueado ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}>
        <div className="flex items-start gap-2">
          <ShieldOff className={`h-5 w-5 mt-0.5 ${diag.reset_total_bloqueado ? "text-emerald-700" : "text-red-700"}`} />
          <div className="flex-1">
            <h3 className="text-[13px] font-bold uppercase tracking-wide">
              Reset total do cadastro
            </h3>
            <p className="text-[11px] text-slate-700 mt-0.5">
              Apaga vendas, contratos, vínculos, Auth e o próprio cliente. Preserva 100% da base de IA.
            </p>
          </div>
        </div>

        {diag.reset_total_bloqueado ? (
          <div className="flex items-center gap-2 text-[12px] text-emerald-800 bg-white border border-emerald-200 rounded-lg p-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              <strong>BLOQUEADO POR SEGURANÇA</strong> — cliente possui{" "}
              {diag.bloqueio_motivo === "venda_paga" ? "venda paga" : "contrato assinado"}.
              Use as ações cirúrgicas acima.
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 text-[11px] text-red-900 bg-white border border-red-200 rounded-lg p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Ação irreversível. Para confirmar, digite o CPF completo do cliente abaixo.</span>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600 block mb-1">
                Digite o CPF de {cliente.nome_completo} para confirmar
              </label>
              <Input
                value={confirmCpf}
                onChange={(e) => setConfirmCpf(e.target.value)}
                placeholder="Apenas números"
                className="text-[12px] font-mono"
              />
            </div>
            <Button
              variant="destructive"
              disabled={!cpfConfirmOk || !motivo.trim() || motivo.trim().length < 6 || busy === "reset_total"}
              onClick={() => run("reset_total", { confirm_cpf: confirmCpf }, "RESET TOTAL DO CADASTRO")}
              className="w-full bg-red-700 hover:bg-red-800"
            >
              {busy === "reset_total"
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Executando…</>
                : <><Unlock className="h-4 w-4 mr-2" />Destravar e apagar cadastro</>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone: "ok" | "warn" | "danger" }) {
  const colors = {
    ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-800 border-red-200",
  }[tone];
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${colors}`}>
      <div className="text-[9px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, desc, disabled, busy, onClick }: any) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      disabled ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-300"
    }`}>
      <Icon className="h-4 w-4 mt-0.5 text-[#7A1F2B] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-600">{desc}</div>
      </div>
      <Button size="sm" variant="outline" disabled={disabled || busy} onClick={onClick}
        className="h-7 text-[11px] flex-shrink-0">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Executar"}
      </Button>
    </div>
  );
}