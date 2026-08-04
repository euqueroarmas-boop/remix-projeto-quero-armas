import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, RefreshCw, Play, Loader2, FileText, CheckCircle2, Clock,
  ChevronDown, ChevronUp, ExternalLink, Trash2, Mail, Undo2, FilePlus2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { resumirUserAgent } from "@/lib/quero-armas/userAgentResumo";

type ContratoItem = {
  contrato_id: string;
  contrato_status: string;
  venda_id: number;
  venda_id_legado: number | null;
  cliente_id: number;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_cpf: string | null;
  servico_nome: string | null;
  gerado_em: string;
  link_assinatura: string | null;
};

/** Carimbo enxuto de download: quando o cliente baixou, em que aparelho e navegador. */
type DownloadCarimbo = {
  baixado_em: string;
  dispositivo: string;
  navegador: string;
  vezes: number;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string }> = {
    generated_pending_company_signature: { label: "Aguardando assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    pending_customer_signature: { label: "Aguardando assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    pending_company_signature: { label: "Aguardando contra-assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    signed_pending_validation: { label: "Assinado — validando", color: "text-blue-700 bg-blue-50 border-blue-200" },
    validated: { label: "Validado", color: "text-green-700 bg-green-50 border-green-200" },
    signed: { label: "Assinado", color: "text-green-700 bg-green-50 border-green-200" },
    customer_signature_uploaded: { label: "Assinado — validando", color: "text-green-700 bg-green-50 border-green-200" },
    validating: { label: "Assinado — validando", color: "text-green-700 bg-green-50 border-green-200" },
    arquivado_template_legado: { label: "Arquivado (template legado)", color: "text-muted-foreground bg-muted border-muted" },
    rejected: { label: "Rejeitado", color: "text-red-700 bg-red-50 border-red-200" },
    cancelled: { label: "Cancelado", color: "text-red-700 bg-red-50 border-red-200" },
  };
  return map[s] ?? { label: s, color: "text-muted-foreground bg-muted border-muted" };
}

const STATUS_AGUARDANDO = [
  "generated_pending_company_signature",
  "pending_customer_signature",
  "pending_company_signature",
];
const STATUS_ASSINADO = [
  "customer_signature_uploaded",
  "validating",
  "signed_pending_validation",
  "signed",
  "validated",
];

function isAssinado(status: string) {
  return STATUS_ASSINADO.includes(status);
}

type Filtro = "aguardando" | "assinados" | "todos" | "gerar";

export type HistoricoContratosPendentesHandle = { carregar: () => void };

const HistoricoContratosPendentes = forwardRef<HistoricoContratosPendentesHandle>(function HistoricoContratosPendentes(_, ref) {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("aguardando");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [uploadArquivo, setUploadArquivo] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [regenerando, setRegenerando] = useState<string | null>(null);
  const [revertendo, setRevertendo] = useState<string | null>(null);
  const [semContrato, setSemContrato] = useState<{ venda_id: number; venda_id_legado: number | null; cliente_id: number; cliente_nome: string; cliente_email: string | null; criado_em: string | null }[]>([]);
  const [ordemSemContrato, setOrdemSemContrato] = useState<"az" | "za" | "novos" | "antigos">("novos");
  const [gerando, setGerando] = useState<number | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadCarimbo>>({});
  const inputFileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Busca todos os contratos pendentes de assinatura (independente de auditoria pré-piloto),
      // para que contratos gerados em fluxos parciais/interrompidos também apareçam.
      const { data: auditorias } = await supabase
        .from("qa_logs_auditoria" as any)
        .select("entidade_id, detalhes_json, created_at")
        .eq("acao", "pre_piloto_contrato_gerado")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: contratoRows } = await supabase
        .from("qa_contracts" as any)
        .select("id, status, venda_id, cliente_id, created_at")
        .in("status", [...STATUS_AGUARDANDO, ...STATUS_ASSINADO])
        .order("created_at", { ascending: false })
        .limit(200);

      // Vendas pagas que ficaram SEM nenhum contrato (ex.: contrato excluído).
      try {
        const { data: todasVendas } = await supabase
          .from("qa_vendas" as any)
          .select("id, id_legado, cliente_id, created_at")
          .eq("status", "PAGO")
          .order("id", { ascending: false })
          .limit(200);
        const { data: todosContratos } = await supabase
          .from("qa_contracts" as any)
          .select("venda_id")
          .limit(1000);
        // Contratos gravam o venda_id podendo ser o id atual OU o id_legado da venda.
        const comContrato = new Set(((todosContratos ?? []) as any[]).map((c) => Number(c.venda_id)));
        const orfas = ((todasVendas ?? []) as any[]).filter(
          (v) => !comContrato.has(Number(v.id)) && !comContrato.has(Number(v.id_legado)),
        );
        if (orfas.length) {
          const { data: cli } = await supabase
            .from("qa_clientes" as any)
            .select("id, nome_completo, email")
            .in("id", [...new Set(orfas.map((v) => v.cliente_id))]);
          const map = Object.fromEntries(((cli ?? []) as any[]).map((c) => [c.id, c]));
          setSemContrato(orfas.map((v) => ({
            venda_id: Number(v.id),
            venda_id_legado: v.id_legado != null ? Number(v.id_legado) : null,
            cliente_id: Number(v.cliente_id),
            cliente_nome: map[v.cliente_id]?.nome_completo ?? "—",
            cliente_email: map[v.cliente_id]?.email ?? null,
            criado_em: v.created_at ?? null,
          })));
        } else {
          setSemContrato([]);
        }
      } catch { /* best effort */ }

      if (!contratoRows?.length) { setContratos([]); setCarregando(false); return; }

      const clienteIds = [...new Set((contratoRows as any[]).map((c) => c.cliente_id))];
      const { data: clientes } = await supabase
        .from("qa_clientes" as any)
        .select("id, nome_completo, email, cpf")
        .in("id", clienteIds);

      const clienteMap = Object.fromEntries(((clientes ?? []) as any[]).map((c) => [c.id, c]));

      const items: ContratoItem[] = (contratoRows as any[]).map((c) => {
        const auditoria = (auditorias as any[]).find(
          (a) => Number(a?.detalhes_json?.venda_id ?? a?.entidade_id) === Number(c.venda_id),
        );
        const det = auditoria?.detalhes_json ?? {};
        const cli = clienteMap[c.cliente_id] ?? {};
        return {
          contrato_id: c.id,
          contrato_status: c.status,
          venda_id: c.venda_id,
          venda_id_legado: det.venda_id_legado ?? null,
          cliente_id: c.cliente_id,
          cliente_nome: cli.nome_completo ?? det.cliente_nome ?? "—",
          cliente_email: cli.email ?? null,
          cliente_cpf: cli.cpf ?? null,
          servico_nome: det.servico_nome ?? null,
          gerado_em: c.created_at,
          link_assinatura: `https://www.euqueroarmas.com.br/area-do-cliente/contratos/${c.id}`,
        };
      });

      setContratos(items);

      // Nota de rodapé discreta: último download feito pelo cliente.
      try {
        const { data: dls } = await supabase
          .from("qa_documento_downloads" as any)
          .select("documento_id, baixado_em, user_agent")
          .eq("documento_tipo", "contrato")
          .in("documento_id", items.map((i) => i.contrato_id))
          .order("baixado_em", { ascending: false });
        const mapa: Record<string, DownloadCarimbo> = {};
        for (const d of ((dls ?? []) as any[])) {
          const key = String(d.documento_id);
          if (mapa[key]) { mapa[key].vezes += 1; continue; }
          const { dispositivo, navegador } = resumirUserAgent(d.user_agent);
          mapa[key] = { baixado_em: d.baixado_em, dispositivo, navegador, vezes: 1 };
        }
        setDownloads(mapa);
      } catch { /* best effort */ }
    } catch (e: any) {
      toast.error("Erro ao carregar histórico: " + (e?.message || ""));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useImperativeHandle(ref, () => ({ carregar }), [carregar]);

  async function uploadAssinado(contratoId: string, vendaId: number) {
    if (!uploadArquivo) { toast.error("Selecione o arquivo PDF assinado"); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("contract_id", contratoId);
      fd.append("file", uploadArquivo);
      fd.append("observacao", obs.trim() || "Contrato assinado via GOV.BR — enviado por WhatsApp");
      fd.append("origem", "pre_piloto_historico_whatsapp");
      fd.append("notificacao_policy", JSON.stringify({
        notificar_cliente: true,
        canais: { email: true, whatsapp: false, push: false },
        motivo_nao_notificar: "",
      }));
      const { data, error } = await supabase.functions.invoke("qa-piloto-upload-contrato-staff", { body: fd });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Falha no upload");
      toast.success("Contrato assinado enviado com sucesso!");
      setUploadArquivo(null);
      setObs("");
      setExpandido(null);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar contrato");
    } finally {
      setEnviando(false);
    }
  }

  async function excluirPermanente(contratoId: string, clienteNome: string) {
    const contrato = contratos.find((x) => x.contrato_id === contratoId);
    if (contrato && isAssinado(contrato.contrato_status)) {
      const okAssinado = window.confirm(
        `ATENÇÃO: o contrato de ${clienteNome} JÁ FOI ASSINADO.\n\nExcluir apaga o rastro jurídico da assinatura. O recomendado é gerar um novo contrato (Regenerar) e manter este no histórico.\n\nDeseja mesmo continuar com a exclusão?`,
      );
      if (!okAssinado) return;
    }
    const confirm1 = window.confirm(
      `Excluir permanentemente o contrato de ${clienteNome}?\n\nEsta ação é IRREVERSÍVEL — remove o contrato, assinaturas, itens, aceites e eventos vinculados.`,
    );
    if (!confirm1) return;
    const confirm2 = window.prompt('Digite EXCLUIR para confirmar:');
    if ((confirm2 || "").trim().toUpperCase() !== "EXCLUIR") {
      toast.info("Exclusão cancelada");
      return;
    }
    setExcluindo(contratoId);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-excluir-permanente", {
        body: { contrato_id: contratoId },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error || error?.message || "Falha ao excluir");
      }
      toast.success("Contrato excluído permanentemente");
      setContratos((prev) => prev.filter((x) => x.contrato_id !== contratoId));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir contrato");
    } finally {
      setExcluindo(null);
    }
  }

  // Regenera o contrato com o template/anexo vigente (útil quando o Anexo I
  // ou o corpo do contrato principal foi atualizado em Configurações depois
  // que este contrato já tinha sido gerado) e reenvia o e-mail ao cliente.
  // O link é sempre o mesmo (/area-do-cliente/contratos/{id}) e passa a
  // servir o conteúdo corrigido assim que regenerado — não há necessidade
  // de invalidar o link antigo, só de avisar o cliente de novo.
  async function regenerarEReenviar(contratoId: string, vendaId: number, clienteNome: string) {
    if (!window.confirm(`Regenerar o contrato de ${clienteNome} com o template vigente e reenviar o e-mail de assinatura?`)) return;
    setRegenerando(contratoId);
    try {
      const { data, error } = await supabase.functions.invoke("qa-generate-contract", {
        body: { venda_id: vendaId, force: true, reenviar_email: true },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Falha ao regenerar contrato");
      }
      const emailDispatch = (data as any)?.email_dispatch;
      if (emailDispatch?.ok === false) {
        toast.warning(emailDispatch.error || "Contrato regenerado, mas o e-mail não foi confirmado.");
      } else {
        toast.success("Contrato regenerado e e-mail reenviado ao cliente.");
      }
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao regenerar contrato");
    } finally {
      setRegenerando(null);
    }
  }

  // Volta um contrato ASSINADO para "aguardando assinatura", preservando o
  // registro e liberando a regeneração com o cadastro corrigido.
  async function reverterAssinatura(contratoId: string, clienteNome: string) {
    if (!window.confirm(
      `Voltar o contrato de ${clienteNome} para "Aguardando assinatura"?\n\nA assinatura enviada será desvinculada (o registro e o histórico permanecem) e você poderá regenerar o contrato com os dados corrigidos.`,
    )) return;
    setRevertendo(contratoId);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-reverter-assinatura", {
        body: { contrato_id: contratoId },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Falha ao reverter");
      toast.success("Contrato voltou para 'Aguardando assinatura'. Agora você pode regenerar.");
      setFiltro("aguardando");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reverter assinatura");
    } finally {
      setRevertendo(null);
    }
  }

  // Gera contrato do zero para uma venda paga que ficou sem contrato.
  // `vendaIdApi` é o id que a edge function espera (id_legado da venda);
  // `vendaIdExibicao` é o número mostrado na tela.
  async function gerarParaVenda(vendaIdApi: number, clienteNome: string, vendaIdExibicao = vendaIdApi) {
    if (!window.confirm(`Gerar um novo contrato para ${clienteNome} (venda #${vendaIdExibicao}) com os dados atuais do cadastro?`)) return;
    setGerando(vendaIdExibicao);
    try {
      const { data, error } = await supabase.functions.invoke("qa-generate-contract", {
        body: { venda_id: vendaIdApi, force: true, reenviar_email: true },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Falha ao gerar contrato");
      toast.success("Contrato gerado. Ele já aparece em 'Aguardando assinatura'.");
      setFiltro("aguardando");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar contrato");
    } finally {
      setGerando(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const termoDigitos = termo.replace(/\D/g, "");
  const listaFiltrada = contratos.filter((c) => {
    if (filtro === "aguardando" && isAssinado(c.contrato_status)) return false;
    if (filtro === "assinados" && !isAssinado(c.contrato_status)) return false;
    if (!termo) return true;
    const cpfDigitos = (c.cliente_cpf ?? "").replace(/\D/g, "");
    return (
      c.cliente_nome.toLowerCase().includes(termo) ||
      (c.cliente_email ?? "").toLowerCase().includes(termo) ||
      c.contrato_id.toLowerCase().includes(termo) ||
      String(c.venda_id_legado ?? c.venda_id).includes(termoDigitos || termo) ||
      (!!termoDigitos && cpfDigitos.includes(termoDigitos))
    );
  });

  const totalAguardando = contratos.filter((c) => !isAssinado(c.contrato_status)).length;
  const totalAssinados = contratos.filter((c) => isAssinado(c.contrato_status)).length;

  const abas: { id: Filtro; label: string; count: number }[] = [
    { id: "aguardando", label: "Aguardando assinatura", count: totalAguardando },
    { id: "assinados", label: "Assinados", count: totalAssinados },
    { id: "todos", label: "Todos", count: contratos.length },
    { id: "gerar", label: "Gerar contrato", count: semContrato.length },
  ];

  const abaGerar = filtro === "gerar";
  const semContratoFiltrado = semContrato.filter((v) => {
    if (!termo) return true;
    return (
      v.cliente_nome.toLowerCase().includes(termo) ||
      (v.cliente_email ?? "").toLowerCase().includes(termo) ||
      String(v.venda_id).includes(termoDigitos || termo) ||
      String(v.venda_id_legado ?? "").includes(termoDigitos || termo)
    );
  });

  return (
    <div className="space-y-2">
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
        {abas.map((a) => {
          const ativo = filtro === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setFiltro(a.id)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition-all ${
                ativo
                  ? "bg-[#7B1C2E] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              }`}
            >
              {a.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  ativo ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {a.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={abaGerar ? "Buscar por nome, e-mail ou nº da venda" : "Buscar por nome, CPF, e-mail, nº da venda ou ID do contrato"}
          className="text-xs h-8 flex-1"
        />
        <Button variant="ghost" size="sm" onClick={carregar} className="text-xs gap-1 h-7">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {abaGerar
          ? `${semContratoFiltrado.length} venda(s) paga(s) sem contrato`
          : `${listaFiltrada.length} contrato(s) encontrado(s)`}
      </p>

      {abaGerar && semContrato.length === 0 && (
        <div className="py-8 text-center text-xs italic text-muted-foreground">
          Nenhuma venda paga sem contrato.
        </div>
      )}

      {abaGerar && semContrato.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-3 space-y-2">
          <p className="text-[11px] font-semibold text-amber-900 uppercase tracking-wide">
            Vendas pagas sem contrato ({semContrato.length})
          </p>
          <p className="text-[11px] text-amber-800">
            O contrato foi excluído ou nunca foi gerado. Gere um novo com os dados atuais do cadastro.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] uppercase tracking-wide text-amber-900/70">Ordenar:</span>
            {([
              { id: "az", label: "A → Z" },
              { id: "za", label: "Z → A" },
              { id: "novos", label: "Mais novos" },
              { id: "antigos", label: "Mais antigos" },
            ] as const).map((o) => (
              <button
                key={o.id}
                onClick={() => setOrdemSemContrato(o.id)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  ordemSemContrato === o.id
                    ? "bg-[#7B1C2E] text-white border-[#7B1C2E]"
                    : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100/60"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {[...semContratoFiltrado]
            .sort((a, b) => {
              if (ordemSemContrato === "az") return a.cliente_nome.localeCompare(b.cliente_nome, "pt-BR");
              if (ordemSemContrato === "za") return b.cliente_nome.localeCompare(a.cliente_nome, "pt-BR");
              const ta = a.criado_em ? new Date(a.criado_em).getTime() : a.venda_id;
              const tb = b.criado_em ? new Date(b.criado_em).getTime() : b.venda_id;
              return ordemSemContrato === "novos" ? tb - ta : ta - tb;
            })
            .map((v) => (
            <div key={v.venda_id} className="flex items-center justify-between gap-2 bg-white border rounded px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{v.cliente_nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">Venda #{v.venda_id} · {v.cliente_email || "—"}</p>
              </div>
              <Button
                size="sm"
                className="text-xs gap-1 h-7 bg-[#7B1C2E] hover:bg-[#6a1827] text-white flex-shrink-0"
                disabled={gerando === v.venda_id}
                onClick={() => gerarParaVenda(v.venda_id_legado ?? v.venda_id, v.cliente_nome, v.venda_id)}
              >
                {gerando === v.venda_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FilePlus2 className="w-3 h-3" />}
                Gerar contrato
              </Button>
            </div>
          ))}
        </div>
      )}

      {!abaGerar && listaFiltrada.length === 0 && (
        <div className="text-center py-8 text-xs text-muted-foreground italic">
          Nenhum contrato encontrado para este filtro.
        </div>
      )}

      {!abaGerar && listaFiltrada.map((c) => {
        const st = statusLabel(c.contrato_status);
        const aberto = expandido === c.contrato_id;
        const pendente = c.contrato_status === "generated_pending_company_signature";
        const dl = downloads[c.contrato_id];

        return (
          <div key={c.contrato_id} className="border rounded-lg overflow-hidden">
            {/* Cabeçalho da linha */}
            <button
              onClick={() => setExpandido(aberto ? null : c.contrato_id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.cliente_nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[c.servico_nome, fmt(c.gerado_em)].filter(Boolean).join(" · ")}
                    {[fmtCpf(c.cliente_cpf), c.cliente_email, c.venda_id ? `Venda #${c.venda_id_legado ?? c.venda_id}` : null]
                      .filter(Boolean)
                      .map((v) => ` — ${v}`)
                      .join("")}
                  </p>
                  {dl && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                      Baixado pelo cliente · {fmt(dl.baixado_em)} · {dl.dispositivo} · {dl.navegador}
                      {dl.vezes > 1 ? ` · ${dl.vezes}×` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${st.color}`}>
                  {st.label}
                </span>
                {aberto ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>

            {/* Painel expandido */}
            {aberto && (
              <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <p><span className="text-muted-foreground">E-mail:</span> {c.cliente_email || "—"}</p>
                  <p><span className="text-muted-foreground">Venda:</span> #{c.venda_id_legado ?? c.venda_id}</p>
                  <p><span className="text-muted-foreground">Contrato:</span> {c.contrato_id.slice(0, 8)}…</p>
                </div>

                {/* Link do contrato */}
                {c.link_assinatura && (
                  <div className="flex items-center gap-2">
                    <Input value={c.link_assinatura} readOnly className="text-[11px] h-7 bg-white flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => window.open(c.link_assinatura!, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {/* Upload contrato assinado */}
                {pendente && (
                  <div className="space-y-2 pt-1 border-t">
                    <p className="text-[11px] font-medium text-foreground">Upload do contrato assinado</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => inputFileRef.current?.click()}
                      >
                        <Upload className="w-3 h-3" />
                        {uploadArquivo ? uploadArquivo.name.slice(0, 25) + (uploadArquivo.name.length > 25 ? "…" : "") : "Selecionar PDF"}
                      </Button>
                      <input
                        ref={inputFileRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => setUploadArquivo(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Input
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Observação (opcional)"
                      className="text-xs h-7"
                    />
                    <Button
                      size="sm"
                      onClick={() => uploadAssinado(c.contrato_id, c.venda_id)}
                      disabled={!uploadArquivo || enviando}
                      className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-7"
                    >
                      {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {enviando ? "Enviando..." : "Confirmar assinatura"}
                    </Button>
                  </div>
                )}

                {/* Regenerar contrato / Excluir / Ir para Piloto Real */}
                <div className="flex flex-wrap justify-between items-center pt-1 border-t gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1 h-7 text-red-700 hover:text-red-800 hover:bg-red-50"
                    disabled={excluindo === c.contrato_id}
                    onClick={() => excluirPermanente(c.contrato_id, c.cliente_nome)}
                  >
                    {excluindo === c.contrato_id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />}
                    Excluir permanentemente
                  </Button>
                  <div className="flex gap-2">
                    {isAssinado(c.contrato_status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1 h-7 border-amber-300 text-amber-800 hover:bg-amber-50"
                        disabled={revertendo === c.contrato_id}
                        onClick={() => reverterAssinatura(c.contrato_id, c.cliente_nome)}
                      >
                        {revertendo === c.contrato_id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Undo2 className="w-3 h-3" />}
                        Voltar p/ aguardando
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 h-7"
                      disabled={regenerando === c.contrato_id}
                      onClick={() => regenerarEReenviar(c.contrato_id, c.venda_id, c.cliente_nome)}
                    >
                      {regenerando === c.contrato_id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Mail className="w-3 h-3" />}
                      Regenerar e reenviar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 h-7"
                      onClick={() => navigate("/admin/piloto-real", {
                        state: { clienteId: c.cliente_id, clienteNome: c.cliente_nome, vendaId: c.venda_id },
                      })}
                    >
                      <Play className="w-3 h-3" /> Abrir no Piloto Real
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default HistoricoContratosPendentes;
