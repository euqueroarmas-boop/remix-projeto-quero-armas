import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, FileText, RefreshCw, X } from "lucide-react";

/**
 * Seção "Dados recebidos pelo formulário público" (item 6 da Fase 22).
 * Mostra na ficha do cliente o cadastro público de origem, todos os campos
 * preenchidos, divergências detectadas com o cadastro oficial e os botões
 * para aplicar dados pendentes, ignorar divergência e marcar como conferido.
 * Apenas leitura/aplicação seletiva — nunca sobrescreve dado oficial sem comando.
 */

const norm = (v?: string | null) => (v || "").replace(/\D/g, "");
const filled = (v: any) => v != null && String(v).trim() !== "";

type Cad = Record<string, any>;
type Cli = Record<string, any>;

type Diferenca = {
  campo: string;
  label: string;
  valorForm: string;
  valorCli: string;
  // true quando o cliente não tem o dado preenchido — pode ser aplicado sem sobrescrever
  aplicavelDireto: boolean;
  // mapeia o nome do campo no formulário -> coluna em qa_clientes
  colunaCliente: string;
};

const MAPA: Array<{ campoForm: string; colunaCli: string; label: string }> = [
  { campoForm: "email", colunaCli: "email", label: "E-mail" },
  { campoForm: "telefone_principal", colunaCli: "celular", label: "Telefone / WhatsApp" },
  { campoForm: "end1_cep", colunaCli: "cep", label: "CEP" },
  { campoForm: "end1_logradouro", colunaCli: "endereco", label: "Endereço" },
  { campoForm: "end1_numero", colunaCli: "numero", label: "Número" },
  { campoForm: "end1_bairro", colunaCli: "bairro", label: "Bairro" },
  { campoForm: "end1_cidade", colunaCli: "cidade", label: "Cidade" },
  { campoForm: "end1_estado", colunaCli: "estado", label: "UF" },
  { campoForm: "end1_complemento", colunaCli: "complemento", label: "Complemento" },
  { campoForm: "profissao", colunaCli: "profissao", label: "Profissão" },
  { campoForm: "estado_civil", colunaCli: "estado_civil", label: "Estado civil" },
  { campoForm: "nome_mae", colunaCli: "nome_mae", label: "Nome da mãe" },
  { campoForm: "nome_pai", colunaCli: "nome_pai", label: "Nome do pai" },
  { campoForm: "rg", colunaCli: "rg", label: "RG" },
  { campoForm: "emissor_rg", colunaCli: "emissor_rg", label: "Órgão emissor RG" },
];

function diff(form: Cad, cli: Cli): { aplicaveis: Diferenca[]; divergentes: Diferenca[] } {
  const aplicaveis: Diferenca[] = [];
  const divergentes: Diferenca[] = [];

  for (const m of MAPA) {
    const vf = form?.[m.campoForm];
    const vc = cli?.[m.colunaCli];
    if (!filled(vf)) continue;

    if (!filled(vc)) {
      aplicaveis.push({
        campo: m.campoForm,
        label: m.label,
        valorForm: String(vf),
        valorCli: "—",
        aplicavelDireto: true,
        colunaCliente: m.colunaCli,
      });
    } else {
      const a = String(vf).trim().toUpperCase();
      const b = String(vc).trim().toUpperCase();
      if (a !== b) {
        divergentes.push({
          campo: m.campoForm,
          label: m.label,
          valorForm: String(vf),
          valorCli: String(vc),
          aplicavelDireto: false,
          colunaCliente: m.colunaCli,
        });
      }
    }
  }

  // CPF é tratado à parte (oficial não pode ser sobrescrito automaticamente).
  if (filled(form?.cpf) && filled(cli?.cpf) && norm(form.cpf) !== norm(cli.cpf)) {
    divergentes.unshift({
      campo: "cpf",
      label: "CPF (CRÍTICO)",
      valorForm: String(form.cpf),
      valorCli: String(cli.cpf),
      aplicavelDireto: false,
      colunaCliente: "cpf",
    });
  }

  return { aplicaveis, divergentes };
}

export default function DadosFormularioPublicoSection({
  cliente,
  onApplied,
}: {
  cliente: { id: number; cadastro_publico_id?: string | null; customer_id?: string | null; user_id?: string | null } & Cli;
  onApplied?: () => void;
}) {
  const [cad, setCad] = useState<Cad | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Busca o cadastro público mais recente vinculado a este cliente.
      const { data } = await supabase
        .from("qa_cadastro_publico" as any)
        .select("*")
        .eq("cliente_id_vinculado", cliente.id)
        .order("created_at", { ascending: false })
        .limit(1);
      setCad((data as any[])?.[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [cliente.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-500">
        Verificando vínculo com formulário público...
      </div>
    );
  }
  if (!cad) return null;

  const { aplicaveis, divergentes } = diff(cad, cliente);
  const total = aplicaveis.length + divergentes.length;
  const isConferido = ["conferido", "formulario_conferido", "aprovado"].includes(
    String(cad.status || "").toLowerCase(),
  );

  const audit = async (acao: string, extra: Partial<Record<string, any>> = {}) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("qa_cadastro_publico_audit" as any).insert({
        cadastro_publico_id: cad.id,
        cliente_id: cliente.id,
        cpf_normalizado: norm(cad.cpf) || null,
        acao,
        user_id: u?.user?.id ?? null,
        ...extra,
      });
    } catch (e) {
      console.warn("[DadosFormularioPublicoSection] audit falhou:", e);
    }
  };

  const aplicarPendentes = async () => {
    if (aplicaveis.length === 0) return;
    setBusy(true);
    try {
      const update: Record<string, any> = {
        cadastro_publico_id: cliente.cadastro_publico_id ?? cad.id,
        cadastro_publico_aplicado_em: new Date().toISOString(),
      };
      for (const d of aplicaveis) {
        update[d.colunaCliente] = cad[d.campo];
      }
      const { error } = await supabase
        .from("qa_clientes" as any)
        .update(update)
        .eq("id", cliente.id);
      if (error) throw error;

      for (const d of aplicaveis) {
        await audit("aplicar_dado", {
          campo: d.colunaCliente,
          valor_anterior: null,
          valor_novo: String(cad[d.campo] ?? ""),
        });
      }
      toast.success(`${aplicaveis.length} dado(s) do formulário aplicado(s).`);
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aplicar dados.");
    } finally {
      setBusy(false);
    }
  };

  const syncPortalDocs = async () => {
    const cpfDigits = norm(cad.cpf || cliente.cpf);
    const email = String(cad.email || cliente.email || "").trim().toLowerCase();
    let customer: any = null;

    if (cliente.customer_id) {
      const { data } = await supabase
        .from("customers" as any)
        .select("id,user_id,email,cnpj_ou_cpf")
        .eq("id", cliente.customer_id)
        .maybeSingle();
      customer = data || null;
    }
    if (!customer && email) {
      const { data } = await supabase
        .from("customers" as any)
        .select("id,user_id,email,cnpj_ou_cpf")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      customer = data || null;
    }
    if (!customer && cpfDigits) {
      const { data } = await supabase
        .from("customers" as any)
        .select("id,user_id,email,cnpj_ou_cpf")
        .limit(100);
      customer = ((data as any[]) || []).find((r) => norm(r.cnpj_ou_cpf) === cpfDigits) || null;
    }

    if (customer?.id) {
      await supabase
        .from("qa_documentos_cliente" as any)
        .update({ qa_cliente_id: cliente.id, cadastro_publico_id: cad.id })
        .eq("customer_id", customer.id)
        .is("qa_cliente_id", null);
    }

    await supabase
      .from("qa_documentos_cliente" as any)
      .update({ qa_cliente_id: cliente.id })
      .eq("cadastro_publico_id", cad.id)
      .is("qa_cliente_id", null);

    return customer as { id?: string; user_id?: string | null } | null;
  };

  const aprovarCadastro = async () => {
    setBusy(true);
    try {
      const customer = await syncPortalDocs();
      const clientePatch: Record<string, any> = {
        cadastro_publico_id: cad.id,
        cadastro_publico_aplicado_em: new Date().toISOString(),
      };
      if (customer?.id) clientePatch.customer_id = customer.id;
      if (customer?.user_id && !cliente.user_id) clientePatch.user_id = customer.user_id;

      const { error: cliErr } = await supabase
        .from("qa_clientes" as any)
        .update(clientePatch)
        .eq("id", cliente.id);
      if (cliErr) throw cliErr;

      const { error: cadErr } = await supabase
        .from("qa_cadastro_publico" as any)
        .update({
          status: "aprovado",
          cliente_id_vinculado: cliente.id,
          processado_em: new Date().toISOString(),
          notas_processamento: `Aprovado e sincronizado na ficha do cliente #${cliente.id}.`,
        })
        .eq("id", cad.id);
      if (cadErr) throw cadErr;

      await audit("aprovar_cadastro", { valor_novo: "aprovado" });
      toast.success("Cadastro aprovado, vínculo e documentos sincronizados.");
      void load();
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aprovar cadastro.");
    } finally {
      setBusy(false);
    }
  };

  const ignorarDivergencia = async (d: Diferenca) => {
    setBusy(true);
    try {
      await audit("ignorar_divergencia", {
        campo: d.colunaCliente,
        valor_anterior: d.valorCli,
        valor_novo: d.valorForm,
        divergencia: true,
      });
      toast.success(`Divergência em ${d.label} marcada como ignorada.`);
    } finally {
      setBusy(false);
    }
  };

  const marcarConferido = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("qa_cadastro_publico" as any)
        .update({ status: "conferido" })
        .eq("id", cad.id);
      if (error) throw error;
      await audit("marcar_conferido");
      toast.success("Formulário marcado como conferido.");
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao marcar como conferido.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-blue-700 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800">
            Dados recebidos pelo formulário público
          </span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] mb-2">
        <div>
          <div className="text-slate-500">Enviado em</div>
          <div className="font-mono text-slate-800">
            {cad.created_at ? new Date(cad.created_at).toLocaleString("pt-BR") : "—"}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Origem</div>
          <div className="font-semibold text-slate-800">Formulário público</div>
        </div>
        <div>
          <div className="text-slate-500">Serviço solicitado</div>
          <div className="font-semibold text-slate-800 uppercase">{cad.servico_interesse || "—"}</div>
        </div>
        <div>
          <div className="text-slate-500">Status formulário</div>
          <div className="font-semibold text-slate-800 uppercase">{cad.status || "—"}</div>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Todos os dados do formulário já estão refletidos na ficha do cliente.
        </div>
      ) : (
        <>
          {aplicaveis.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-amber-800">
                  Dados pendentes de aplicação ({aplicaveis.length})
                </span>
                <Button
                  size="sm"
                  className="h-7 text-[10px]"
                  disabled={busy}
                  onClick={() => void aplicarPendentes()}
                >
                  Aplicar todos
                </Button>
              </div>
              <ul className="space-y-0.5">
                {aplicaveis.map((d) => (
                  <li key={d.campo} className="text-[11px] text-slate-700">
                    <span className="font-semibold uppercase">{d.label}:</span>{" "}
                    <span className="font-mono">{d.valorForm}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {divergentes.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-2 mb-2">
              <div className="flex items-center gap-1.5 mb-1.5 text-red-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold">
                  Divergência entre formulário público e cadastro interno ({divergentes.length})
                </span>
              </div>
              <ul className="space-y-1">
                {divergentes.map((d) => (
                  <li key={d.campo} className="text-[11px]">
                    <div className="font-semibold uppercase text-slate-800">{d.label}</div>
                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <div>
                        <span className="text-slate-500">Formulário: </span>
                        <span className="font-mono">{d.valorForm}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Cadastro oficial: </span>
                        <span className="font-mono">{d.valorCli}</span>
                      </div>
                    </div>
                    <div className="mt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-slate-600"
                        disabled={busy}
                        onClick={() => void ignorarDivergencia(d)}
                      >
                        <X className="h-3 w-3 mr-1" /> Ignorar divergência
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-end pt-1">
        {!isConferido && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={busy} onClick={() => void marcarConferido()}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar formulário como conferido
          </Button>
        )}
      </div>
    </div>
  );
}