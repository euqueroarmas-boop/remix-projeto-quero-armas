import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, FileText, RefreshCw, X, ShieldCheck, Database, ListChecks } from "lucide-react";
import { registrarStatusEvento } from "@/lib/quero-armas/registrarStatusEvento";
import {
  QAOperationalSection,
  QAInfoCard,
  QAFieldRow,
  QAFieldGrid,
  QAAlertBlock,
  QAStatusChip,
} from "@/components/quero-armas/qa-operational";

/**
 * Seção "Dados recebidos pelo formulário público" (item 6 da Fase 22).
 * Mostra na ficha do cliente o cadastro público de origem, todos os campos
 * preenchidos, divergências detectadas com o cadastro oficial e os botões
 * para aplicar dados pendentes, ignorar divergência e marcar como conferido.
 * Apenas leitura/aplicação seletiva — nunca sobrescreve dado oficial sem comando.
 */

const norm = (v?: string | null) => (v || "").replace(/\D/g, "");
const filled = (v: any) => v != null && String(v).trim() !== "";

// Campos cuja comparação deve ser feita apenas por dígitos (CEP, telefone, CPF…),
// evitando falsas divergências por causa de máscara ("05630-050" vs "05630050").
const DIGIT_ONLY_FIELDS = new Set(["cep", "celular", "telefone_principal", "cpf", "rg"]);

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
  // Comprovante / responsável terceiro
  { campoForm: "comprovante_endereco_em_nome_proprio", colunaCli: "comprovante_endereco_em_nome_proprio", label: "Comprovante em nome próprio" },
  { campoForm: "responsavel_endereco_nome", colunaCli: "responsavel_endereco_nome", label: "Responsável pelo comprovante" },
  { campoForm: "responsavel_endereco_cpf", colunaCli: "responsavel_endereco_cpf", label: "CPF do responsável" },
  { campoForm: "responsavel_endereco_rg_cin", colunaCli: "responsavel_endereco_rg_cin", label: "RG/CIN do responsável" },
  { campoForm: "responsavel_endereco_telefone", colunaCli: "responsavel_endereco_telefone", label: "Telefone do responsável" },
  { campoForm: "responsavel_endereco_email", colunaCli: "responsavel_endereco_email", label: "E-mail do responsável" },
  { campoForm: "responsavel_endereco_vinculo", colunaCli: "responsavel_endereco_vinculo", label: "Vínculo do responsável" },
  { campoForm: "responsavel_endereco_declaracao_path", colunaCli: "responsavel_endereco_declaracao_path", label: "Declaração de residência" },
  { campoForm: "responsavel_endereco_comprovante_path", colunaCli: "responsavel_endereco_comprovante_path", label: "Comprovante (responsável)" },
  { campoForm: "responsavel_endereco_data_nascimento", colunaCli: "responsavel_endereco_data_nascimento", label: "Nascimento do responsável" },
  { campoForm: "responsavel_endereco_naturalidade", colunaCli: "responsavel_endereco_naturalidade", label: "Naturalidade do responsável" },
  { campoForm: "responsavel_endereco_nacionalidade", colunaCli: "responsavel_endereco_nacionalidade", label: "Nacionalidade do responsável" },
  { campoForm: "responsavel_endereco_estado_civil", colunaCli: "responsavel_endereco_estado_civil", label: "Estado civil do responsável" },
  { campoForm: "responsavel_endereco_profissao", colunaCli: "responsavel_endereco_profissao", label: "Profissão do responsável" },
  { campoForm: "responsavel_endereco_cep", colunaCli: "responsavel_endereco_cep", label: "CEP do responsável" },
  { campoForm: "responsavel_endereco_logradouro", colunaCli: "responsavel_endereco_logradouro", label: "Logradouro do responsável" },
  { campoForm: "responsavel_endereco_numero", colunaCli: "responsavel_endereco_numero", label: "Número do responsável" },
  { campoForm: "responsavel_endereco_complemento", colunaCli: "responsavel_endereco_complemento", label: "Complemento do responsável" },
  { campoForm: "responsavel_endereco_bairro", colunaCli: "responsavel_endereco_bairro", label: "Bairro do responsável" },
  { campoForm: "responsavel_endereco_cidade", colunaCli: "responsavel_endereco_cidade", label: "Cidade do responsável" },
  { campoForm: "responsavel_endereco_estado", colunaCli: "responsavel_endereco_estado", label: "UF do responsável" },
  { campoForm: "responsavel_endereco_geolocalizacao", colunaCli: "responsavel_endereco_geolocalizacao", label: "Geolocalização do responsável" },
  { campoForm: "responsavel_endereco_reside_desde", colunaCli: "responsavel_endereco_reside_desde", label: "Reside desde (responsável)" },
  { campoForm: "responsavel_endereco_residiu_ate", colunaCli: "responsavel_endereco_residiu_ate", label: "Residiu até (responsável)" },
  // Segundo endereço
  { campoForm: "end2_cep", colunaCli: "cep2", label: "CEP (2º endereço)" },
  { campoForm: "end2_logradouro", colunaCli: "endereco2", label: "Logradouro (2º)" },
  { campoForm: "end2_numero", colunaCli: "numero2", label: "Número (2º)" },
  { campoForm: "end2_complemento", colunaCli: "complemento2", label: "Complemento (2º)" },
  { campoForm: "end2_bairro", colunaCli: "bairro2", label: "Bairro (2º)" },
  { campoForm: "end2_cidade", colunaCli: "cidade2", label: "Cidade (2º)" },
  { campoForm: "end2_estado", colunaCli: "estado2", label: "UF (2º)" },
  { campoForm: "end2_tipo", colunaCli: "end2_tipo", label: "Tipo do 2º endereço" },
  { campoForm: "end2_observacao", colunaCli: "end2_observacao", label: "Observação 2º endereço" },
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
      const digitsOnly = DIGIT_ONLY_FIELDS.has(m.colunaCli) || DIGIT_ONLY_FIELDS.has(m.campoForm);
      const a = digitsOnly ? norm(String(vf)) : String(vf).trim().toUpperCase().replace(/\s+/g, " ");
      const b = digitsOnly ? norm(String(vc)) : String(vc).trim().toUpperCase().replace(/\s+/g, " ");
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
  cadastroInterno,
  onVerPendencias,
}: {
  cliente: { id: number; cadastro_publico_id?: string | null; customer_id?: string | null; user_id?: string | null } & Cli;
  onApplied?: () => void;
  /** Completude do cadastro interno (separado da sincronização do formulário). */
  cadastroInterno?: { preenchidos: number; total: number };
  /** Callback p/ rolar/abrir pendências quando aprovado mas incompleto. */
  onVerPendencias?: () => void;
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
      <QAOperationalSection icon={Database} title="Sincronização do Cadastro Público" status="Verificando" statusTone="info">
        <QAInfoCard padding="sm">
          <div className="text-[11px] text-slate-500">Verificando vínculo com formulário público…</div>
        </QAInfoCard>
      </QAOperationalSection>
    );
  }
  if (!cad) return null;

  const { aplicaveis, divergentes } = diff(cad, cliente);
  const total = aplicaveis.length + divergentes.length;
  const statusCad = String(cad.status || "").toLowerCase();
  const isAprovado = statusCad === "aprovado";
  const isConferido = ["conferido", "formulario_conferido", "aprovado"].includes(statusCad);
  // Sincronização efetivamente concluída: aprovado e sem divergência pendente.
  const sincronizacaoConcluida = isAprovado && divergentes.length === 0 && aplicaveis.length === 0;
  const cadastroIncompleto = !!cadastroInterno && cadastroInterno.preenchidos < cadastroInterno.total;

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

  const removerConferencia = async () => {
    const statusAnterior = String(cad.status || "").toLowerCase() || null;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("qa_cadastro_publico" as any)
        .update({ status: "pendente" })
        .eq("id", cad.id);
      if (error) throw error;

      const { data: userRes } = await supabase.auth.getUser();
      await audit("remover_conferencia", {
        campo: "status",
        valor_anterior: statusAnterior,
        valor_novo: "pendente",
      });
      void registrarStatusEvento({
        origem: "equipe",
        entidade: "cadastro_publico",
        entidade_id: cad.id,
        cliente_id: cliente.id,
        campo_status: "status",
        status_anterior: statusAnterior,
        status_novo: "pendente",
        usuario_id: userRes?.user?.id ?? null,
        detalhes: { contexto: "DadosFormularioPublicoSection.removerConferencia" },
      });

      setCad((prev) => (prev ? { ...prev, status: "pendente" } : prev));
      toast.success("Conferência removida. Cadastro voltou para pendente.");
      onApplied?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover conferência.");
    } finally {
      setBusy(false);
    }
  };

  const statusTone = isConferido ? "ok" : total > 0 ? "warn" : "info";
  const statusLabel = isConferido ? "Conferido" : total > 0 ? `${total} pendência(s)` : "Pendente";

  return (
    <QAOperationalSection
      icon={Database}
      title="Sincronização do Cadastro Público"
      status={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <QAStatusChip label={statusLabel} tone={statusTone as any} />
          {cadastroInterno && (
            <>
              <QAStatusChip
                label={cadastroIncompleto ? "Incompleto" : "Completo"}
                tone={cadastroIncompleto ? "warn" : "ok"}
              />
              <QAStatusChip
                label={`${cadastroInterno.preenchidos}/${cadastroInterno.total} preenchidos`}
                tone="neutral"
              />
            </>
          )}
        </span>
      }
      actions={
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => void load()}>
          <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
        </Button>
      }
    >
      <QAInfoCard padding="md">
        <QAFieldGrid cols={2}>
          <QAFieldRow
            label="Enviado em"
            value={cad.created_at ? new Date(cad.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
          />
          <QAFieldRow label="Origem" value="Formulário público" />
          <QAFieldRow label="Serviço solicitado" value={cad.servico_interesse || "—"} />
          <QAFieldRow label="Status do formulário" value={String(cad.status || "—").toUpperCase()} />
        </QAFieldGrid>
      </QAInfoCard>

      {total === 0 && (
        <QAAlertBlock
          tone="ok"
          icon={CheckCircle2}
          title={cadastroIncompleto ? "Sincronização concluída" : "Sincronia completa"}
        >
          {cadastroIncompleto
            ? "Os dados do formulário foram sincronizados com a ficha do cliente, porém ainda existem campos obrigatórios pendentes no cadastro."
            : "Todos os dados do formulário já estão refletidos na ficha do cliente."}
        </QAAlertBlock>
      )}

      {aplicaveis.length > 0 && (
        <QAAlertBlock
          tone="warn"
          icon={AlertTriangle}
          title={`Dados pendentes de aplicação (${aplicaveis.length})`}
          actions={
            <Button
              size="sm"
              className="h-7 text-[10px] bg-[#7A1F2B] hover:bg-[#601521]"
              disabled={busy}
              onClick={() => void aplicarPendentes()}
            >
              Aplicar todos
            </Button>
          }
        >
          <ul className="space-y-0.5 mt-1">
            {aplicaveis.map((d) => (
              <li key={d.campo} className="text-[11px]">
                <span className="font-bold uppercase">{d.label}:</span>{" "}
                <span className="font-mono">{d.valorForm}</span>
              </li>
            ))}
          </ul>
        </QAAlertBlock>
      )}

      {divergentes.length > 0 && (
        <QAAlertBlock
          tone="danger"
          icon={AlertTriangle}
          title={`Divergência com cadastro interno (${divergentes.length})`}
        >
          <ul className="space-y-2 mt-1">
            {divergentes.map((d) => (
              <li key={d.campo} className="rounded-md border border-red-200 bg-white px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-red-800">{d.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1 text-[11px]">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Formulário</span>
                    <span className="font-mono text-slate-700">{d.valorForm}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Cadastro oficial</span>
                    <span className="font-mono text-slate-700">{d.valorCli}</span>
                  </div>
                </div>
                <div className="mt-1.5">
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
        </QAAlertBlock>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
        {isConferido && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px] border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            disabled={busy}
            onClick={() => void removerConferencia()}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Remover conferência
          </Button>
        )}
        {/* Aprovar e sincronizar tudo: só quando ainda há algo a sincronizar/aprovar */}
        {isConferido && !isAprovado && (
          <Button
            size="sm"
            className="h-8 text-[10px] bg-emerald-600 hover:bg-emerald-700"
            disabled={busy}
            onClick={() => void aprovarCadastro()}
          >
            <ShieldCheck className="h-3 w-3 mr-1" /> Aprovar e sincronizar tudo
          </Button>
        )}
        {/* Aprovado + cadastro interno incompleto -> CTA específico de pendências */}
        {sincronizacaoConcluida && cadastroIncompleto && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px] border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            onClick={() => onVerPendencias?.()}
          >
            <ListChecks className="h-3 w-3 mr-1" /> Ver pendências
          </Button>
        )}
        {/* Aprovado + completo -> apenas chip de status, sem ação */}
        {sincronizacaoConcluida && !cadastroIncompleto && (
          <QAStatusChip label="Cadastro completo" tone="ok" icon={CheckCircle2} />
        )}
        {/* Divergência pendente após aprovação -> ação específica */}
        {isAprovado && divergentes.length > 0 && (
          <QAStatusChip label="Revisar divergências" tone="danger" icon={AlertTriangle} />
        )}
        {!isConferido && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px]"
            disabled={busy}
            onClick={() => void marcarConferido()}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar formulário como conferido
          </Button>
        )}
      </div>
    </QAOperationalSection>
  );
}