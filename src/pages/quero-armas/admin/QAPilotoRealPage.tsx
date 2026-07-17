/**
 * Piloto Real Quero Armas — Contratação Assistida pela Equipe
 *
 * Wizard admin que orquestra o fluxo real de venda→contrato→liberação
 * usando SOMENTE Edge Functions oficiais. Nenhum INSERT/UPDATE manual
 * é feito daqui. Todas as ações geram trilha em qa_venda_eventos /
 * qa_pagamento_auditoria / qa_contract_events / qa_processo_eventos.
 *
 * Passos:
 *  1. Selecionar cliente real (qa_clientes)
 *  2. Selecionar serviço (qa_servicos_catalogo)
 *  3. Criar venda (qa-checkout-criar-venda)
 *  4. Aprovar valor (RPC qa_venda_aprovar_valor)
 *  5. Confirmar pagamento manual + comprovante (qa-venda-confirmar-pagamento-manual)
 *  6. Acompanhar contrato → assinatura cliente → liberação
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Search, User, CheckCircle2, Circle, ArrowRight, ShieldAlert,
  Upload, FileText, Copy, ExternalLink, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Cliente = { id: number; id_legado: number | null; nome_completo: string; cpf: string | null; email: string | null; celular: string | null };
type Servico = { id: string; slug: string; nome: string; preco: number | null; ativo: boolean };
type Venda = { id: number; id_legado: number | null; cliente_id: number; status: string | null; status_validacao_valor: string | null; cobranca_status: string | null; valor_a_pagar: number | string | null; forma_pagamento: string | null };
type Contrato = { id: string; status: string; venda_id: number; cliente_id: number };
type Processo = { id: string; venda_id: number | null; servico_id: number | null; status: string | null };

const FORMAS_MANUAL = [
  "PIX", "BOLETO", "CARTÃO DE CRÉDITO", "CARTÃO DE DÉBITO", "DINHEIRO", "TRANSFERÊNCIA", "OUTRO",
] as const;

function money(v: unknown): string {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusDot(state: "done" | "pending" | "current" | "blocked") {
  const map = {
    done: "bg-emerald-500",
    current: "bg-amber-400 animate-pulse",
    pending: "bg-neutral-700",
    blocked: "bg-rose-500",
  } as const;
  return <span className={`inline-block h-2 w-2 rounded-full ${map[state]}`} />;
}

export default function QAPilotoRealPage() {
  /* ---------- Passo 1: Cliente ---------- */
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidatos, setCandidatos] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const buscarCliente = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const cpfDigits = q.replace(/\D/g, "");
      const filtro = cpfDigits.length >= 6
        ? `cpf.ilike.%${cpfDigits}%`
        : `nome_completo.ilike.%${q}%,email.ilike.%${q}%`;
      const { data, error } = await supabase
        .from("qa_clientes")
        .select("id, id_legado, nome_completo, cpf, email, celular")
        .neq("status", "excluido_lgpd")
        .or(filtro)
        .order("id", { ascending: false })
        .limit(15);
      if (error) throw error;
      setCandidatos((data ?? []) as Cliente[]);
    } catch (e: any) {
      toast.error(`Falha na busca: ${e?.message || e}`);
    } finally {
      setSearching(false);
    }
  }, [query]);

  /* ---------- Passo 2: Serviço ---------- */
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servico, setServico] = useState<Servico | null>(null);
  const [servicoQ, setServicoQ] = useState("");
  const [carregandoServicos, setCarregandoServicos] = useState(false);

  useEffect(() => {
    (async () => {
      setCarregandoServicos(true);
      const { data } = await supabase
        .from("qa_servicos_catalogo")
        .select("id, slug, nome, preco, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      setServicos((data ?? []) as Servico[]);
      setCarregandoServicos(false);
    })();
  }, []);

  const servicosFiltrados = useMemo(() => {
    const q = servicoQ.trim().toLowerCase();
    if (!q) return servicos.slice(0, 30);
    return servicos.filter((s) => s.nome.toLowerCase().includes(q) || s.slug.includes(q)).slice(0, 30);
  }, [servicos, servicoQ]);

  /* ---------- Passo 3: Venda ---------- */
  const [venda, setVenda] = useState<Venda | null>(null);
  const [criandoVenda, setCriandoVenda] = useState(false);

  const criarVenda = useCallback(async () => {
    if (!cliente || !servico) return;
    setCriandoVenda(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-checkout-criar-venda", {
        body: {
          cart: [{ servico_id: servico.id, slug: servico.slug, quantidade: 1 }],
          identificacao: {
            nome_completo: cliente.nome_completo,
            cpf: cliente.cpf || "",
            email: cliente.email || "",
            celular: cliente.celular || "",
          },
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "falha_criar_venda");
      toast.success(`Venda #${(data as any).venda_id} criada`);
      await recarregarVenda((data as any).venda_id);
    } catch (e: any) {
      toast.error(`Erro ao criar venda: ${e?.message || e}`);
    } finally {
      setCriandoVenda(false);
    }
  }, [cliente, servico]);

  const recarregarVenda = useCallback(async (id: number) => {
    const { data } = await supabase
      .from("qa_vendas")
      .select("id, id_legado, cliente_id, status, status_validacao_valor, cobranca_status, valor_a_pagar, forma_pagamento")
      .eq("id", id)
      .maybeSingle();
    if (data) setVenda(data as Venda);
  }, []);

  /* ---------- Passo 4: Aprovar valor ---------- */
  const [aprovando, setAprovando] = useState(false);
  const aprovarValor = useCallback(async () => {
    if (!venda) return;
    setAprovando(true);
    try {
      const { data, error } = await supabase.rpc("qa_venda_aprovar_valor", { p_venda_id: venda.id });
      if (error) throw error;
      toast.success("Valor aprovado (evento registrado)");
      await recarregarVenda(venda.id);
    } catch (e: any) {
      toast.error(`Falha ao aprovar valor: ${e?.message || e}`);
    } finally {
      setAprovando(false);
    }
  }, [venda, recarregarVenda]);

  /* ---------- Passo 5: Pagamento Manual ---------- */
  const [forma, setForma] = useState<string>("PIX");
  const [parcelas, setParcelas] = useState<number>(1);
  const [observacao, setObservacao] = useState<string>("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [comprovantePath, setComprovantePath] = useState<string | null>(null);
  const [confirmandoPag, setConfirmandoPag] = useState(false);

  const uploadComprovante = useCallback(async () => {
    if (!venda || !comprovante) return null;
    const ext = (comprovante.name.split(".").pop() || "bin").toLowerCase();
    const path = `qa/manual-payments/${venda.id}/comprovante-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("paid-contracts").upload(path, comprovante, {
      contentType: comprovante.type || "application/octet-stream",
      upsert: true,
    });
    if (error) throw error;
    setComprovantePath(path);
    return path;
  }, [comprovante, venda]);

  const confirmarPagamento = useCallback(async () => {
    if (!venda) return;
    if (observacao.trim().length < 20) {
      toast.error("Observação deve ter no mínimo 20 caracteres.");
      return;
    }
    if (!comprovante && !comprovantePath) {
      toast.error("Anexe o comprovante do pagamento.");
      return;
    }
    setConfirmandoPag(true);
    try {
      const path = comprovantePath || (await uploadComprovante());
      if (!path) throw new Error("comprovante_upload_falhou");
      const { data, error } = await supabase.functions.invoke("qa-venda-confirmar-pagamento-manual", {
        body: {
          venda_id: venda.id,
          forma_pagamento: forma,
          parcelas,
          observacao: observacao.trim(),
          comprovante_path: path,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "falha");
      toast.success(
        (data as any)?.ja_estava_pago
          ? "Venda já estava paga. Pipeline reexecutado (idempotente)."
          : "Pagamento confirmado. Contrato sendo gerado…",
      );
      await recarregarVenda(venda.id);
      await recarregarContrato(venda.id);
    } catch (e: any) {
      toast.error(`Falha ao confirmar pagamento: ${e?.message || e}`);
    } finally {
      setConfirmandoPag(false);
    }
  }, [venda, forma, parcelas, observacao, comprovante, comprovantePath, uploadComprovante]);

  /* ---------- Passo 6: Contrato + Liberação ---------- */
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);

  const recarregarContrato = useCallback(async (vendaId: number) => {
    const { data: c } = await supabase
      .from("qa_contracts")
      .select("id, status, venda_id, cliente_id")
      .eq("venda_id", vendaId)
      .maybeSingle();
    setContrato((c as Contrato) ?? null);
    const { data: p } = await supabase
      .from("qa_processos")
      .select("id, venda_id, servico_id, status")
      .eq("venda_id", vendaId);
    setProcessos((p ?? []) as Processo[]);
  }, []);

  useEffect(() => {
    if (!venda) return;
    const t = setInterval(() => {
      recarregarContrato(venda.id);
      recarregarVenda(venda.id);
    }, 6000);
    return () => clearInterval(t);
  }, [venda, recarregarContrato, recarregarVenda]);

  const linkContratoCliente = useMemo(() => {
    if (!contrato) return null;
    return `${window.location.origin}/area-do-cliente`;
  }, [contrato]);

  /* ---------- Estados derivados p/ checklist ---------- */
  const stepStates = useMemo(() => ({
    cliente: cliente ? "done" as const : "current" as const,
    servico: servico ? "done" as const : cliente ? "current" as const : "pending" as const,
    venda: venda ? "done" as const : (cliente && servico) ? "current" as const : "pending" as const,
    valor: venda?.status_validacao_valor === "aprovado" ? "done" as const : venda ? "current" as const : "pending" as const,
    pagamento: venda?.cobranca_status === "confirmada" ? "done" as const : venda?.status_validacao_valor === "aprovado" ? "current" as const : "pending" as const,
    contrato: contrato ? (["validated","customer_signed"].includes(contrato.status) ? "done" as const : "current" as const) : "pending" as const,
    liberacao: processos.length > 0 ? "done" as const : contrato?.status === "validated" ? "current" as const : "pending" as const,
  }), [cliente, servico, venda, contrato, processos]);

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 p-6 uppercase">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Coluna principal */}
        <div className="space-y-6">
          <header className="border-b border-neutral-800 pb-4">
            <h1 className="text-xl font-bold tracking-wide">Piloto Real — Contratação Assistida</h1>
            <p className="text-xs text-neutral-400 mt-1 normal-case">
              Fluxo real do sistema, sem atalhos. Todas as ações geram evento em <code>qa_venda_eventos</code>,
              <code> qa_pagamento_auditoria</code> e <code>qa_contract_events</code>.
            </p>
          </header>

          {/* Passo 1 */}
          <Card title="1. Cliente Real" state={stepStates.cliente}>
            {!cliente ? (
              <>
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome, CPF ou e-mail…"
                    onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                    className="bg-neutral-900 border-neutral-700 uppercase"
                  />
                  <Button onClick={buscarCliente} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                  {candidatos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCliente(c)}
                      className="w-full text-left border border-neutral-800 hover:border-emerald-500/60 hover:bg-neutral-900 rounded p-2 text-xs"
                    >
                      <div className="font-semibold flex items-center gap-2">
                        <User className="h-3 w-3" /> {c.nome_completo}
                      </div>
                      <div className="text-neutral-400 normal-case">
                        CPF {c.cpf || "—"} · {c.email || "—"} · {c.celular || "—"}
                      </div>
                    </button>
                  ))}
                  {candidatos.length === 0 && !searching && query && (
                    <p className="text-xs text-neutral-500">Nenhum cliente encontrado.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{cliente.nome_completo}</div>
                  <div className="text-xs text-neutral-400 normal-case">
                    #{cliente.id} · CPF {cliente.cpf} · {cliente.email}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setCliente(null); setVenda(null); setContrato(null); }}>
                  Trocar
                </Button>
              </div>
            )}
          </Card>

          {/* Passo 2 */}
          {cliente && (
            <Card title="2. Serviço" state={stepStates.servico}>
              {!servico ? (
                <>
                  <Input
                    value={servicoQ}
                    onChange={(e) => setServicoQ(e.target.value)}
                    placeholder="Filtrar serviço por nome ou slug…"
                    className="bg-neutral-900 border-neutral-700 uppercase"
                  />
                  <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                    {carregandoServicos && <Loader2 className="h-4 w-4 animate-spin" />}
                    {servicosFiltrados.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setServico(s)}
                        className="w-full text-left border border-neutral-800 hover:border-emerald-500/60 hover:bg-neutral-900 rounded p-2 text-xs flex justify-between"
                      >
                        <span>
                          <span className="font-semibold">{s.nome}</span>
                          <span className="text-neutral-500 normal-case"> · {s.slug}</span>
                        </span>
                        <span className="text-emerald-400">{money(s.preco)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{servico.nome}</div>
                    <div className="text-xs text-neutral-400 normal-case">{servico.slug} · {money(servico.preco)}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setServico(null); setVenda(null); setContrato(null); }}>
                    Trocar
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Passo 3 */}
          {cliente && servico && (
            <Card title="3. Criar Venda" state={stepStates.venda}>
              {!venda ? (
                <Button onClick={criarVenda} disabled={criandoVenda}>
                  {criandoVenda ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando…</> : <>Criar venda oficial <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              ) : (
                <div className="text-sm space-y-1">
                  <div>Venda <strong>#{venda.id}</strong> · Status: <strong>{venda.status}</strong></div>
                  <div className="text-xs text-neutral-400 normal-case">
                    Valor: {money(venda.valor_a_pagar)} · Cobrança: {venda.cobranca_status} · Validação: {venda.status_validacao_valor || "pendente"}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Passo 4 */}
          {venda && (
            <Card title="4. Aprovar Valor" state={stepStates.valor}>
              {venda.status_validacao_valor === "aprovado" ? (
                <p className="text-xs text-emerald-400">Valor aprovado — evento gravado.</p>
              ) : (
                <Button onClick={aprovarValor} disabled={aprovando}>
                  {aprovando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar valor da venda"}
                </Button>
              )}
            </Card>
          )}

          {/* Passo 5 */}
          {venda && venda.status_validacao_valor === "aprovado" && venda.cobranca_status !== "confirmada" && (
            <Card title="5. Registrar Pagamento Manual" state={stepStates.pagamento}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Forma de pagamento</Label>
                  <select
                    value={forma}
                    onChange={(e) => setForma(e.target.value)}
                    className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded h-9 px-2 text-sm uppercase"
                  >
                    {FORMAS_MANUAL.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number" min={1} max={24} value={parcelas}
                    onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
                    className="bg-neutral-900 border-neutral-700"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Observação (mín. 20 caracteres — obrigatória)</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: PAGAMENTO PIX RECEBIDO EM 17/07 CONFORME COMPROVANTE ANEXO."
                  className="bg-neutral-900 border-neutral-700 min-h-[80px] normal-case"
                />
                <div className="text-xs text-neutral-500 normal-case mt-1">{observacao.trim().length} caracteres</div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Comprovante (PDF/JPG/PNG — obrigatório)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => { setComprovante(e.target.files?.[0] ?? null); setComprovantePath(null); }}
                    className="bg-neutral-900 border-neutral-700 normal-case"
                  />
                  {comprovantePath && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>
                {comprovantePath && (
                  <p className="text-xs text-emerald-500 normal-case mt-1">Salvo em: {comprovantePath}</p>
                )}
              </div>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-500" onClick={confirmarPagamento} disabled={confirmandoPag}>
                {confirmandoPag ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando…</> : <><Upload className="h-4 w-4 mr-2" /> Confirmar pagamento e gerar contrato</>}
              </Button>
              <p className="text-[10px] text-neutral-500 normal-case mt-2">
                Ao confirmar: qa_vendas.status=PAGO, evento imutável em qa_venda_eventos, auditoria em qa_pagamento_auditoria, pipeline
                pós-pagamento canônico (protocolo + qa-generate-contract + notificações).
              </p>
            </Card>
          )}

          {/* Passo 6 */}
          {venda?.cobranca_status === "confirmada" && (
            <Card title="6. Contrato · Assinatura · Liberação" state={stepStates.contrato}>
              {!contrato ? (
                <div className="flex items-center gap-2 text-xs text-neutral-400 normal-case">
                  <Loader2 className="h-4 w-4 animate-spin" /> Aguardando geração do contrato…
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>Contrato <code className="normal-case">{contrato.id.slice(0, 8)}</code> · Status: <strong>{contrato.status}</strong></div>
                  {linkContratoCliente && (
                    <div className="flex items-center gap-2 normal-case">
                      <Input value={linkContratoCliente} readOnly className="bg-neutral-900 border-neutral-700 text-xs" />
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(linkContratoCliente); toast.success("Link copiado"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={linkContratoCliente} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-neutral-400 normal-case">
                    O cliente entra no portal, assina digitalmente e faz upload do contrato assinado (qa-upload-signed-contract →
                    qa-validate-customer-signature). Quando o contrato ficar <strong>validated</strong>, o trigger
                    qa_contracts_after_validated_release aciona qa-liberar-servicos-contrato automaticamente.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => venda && recarregarContrato(venda.id)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Atualizar status
                  </Button>

                  {processos.length > 0 && (
                    <div className="mt-3 border-t border-neutral-800 pt-3">
                      <div className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Processo(s) criados pela liberação oficial:
                      </div>
                      <ul className="mt-2 space-y-1">
                        {processos.map((p) => (
                          <li key={p.id} className="text-xs normal-case">
                            <FileText className="h-3 w-3 inline mr-1" />
                            <code>{p.id.slice(0, 8)}</code> · status {p.status ?? "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar Checklist */}
        <aside className="border border-neutral-800 rounded bg-neutral-950 p-4 h-fit sticky top-4">
          <h2 className="text-sm font-semibold mb-3 tracking-wide">Checklist do Piloto</h2>
          <ol className="space-y-2 text-xs">
            <ChecklistItem state={stepStates.cliente} label="Cliente real selecionado" />
            <ChecklistItem state={stepStates.servico} label="Serviço escolhido no catálogo" />
            <ChecklistItem state={stepStates.venda} label="Venda + itens criados (checkout oficial)" />
            <ChecklistItem state={stepStates.valor} label="Valor aprovado (RPC oficial)" />
            <ChecklistItem state={stepStates.pagamento} label="Pagamento manual confirmado + comprovante" />
            <ChecklistItem state={stepStates.contrato} label="Contrato gerado / assinado / validado" />
            <ChecklistItem state={stepStates.liberacao} label="Processo + checklist liberados" />
          </ol>
          <div className="mt-4 border-t border-neutral-800 pt-3 text-[10px] text-neutral-500 normal-case leading-relaxed">
            <ShieldAlert className="h-3 w-3 inline mr-1 text-amber-400" />
            Fluxo baseado em Lei 10.826/03, Dec. 11.615/23, Dec. 12.345/24 e IN 201/311.
            Nenhum passo faz UPDATE manual solto — tudo passa por RPC/Edge oficial.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, state, children }: { title: string; state: "done" | "pending" | "current" | "blocked"; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-800 rounded bg-neutral-950 p-4">
      <div className="flex items-center gap-2 mb-3">
        {statusDot(state)}
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChecklistItem({ state, label }: { state: "done" | "pending" | "current" | "blocked"; label: string }) {
  const Icon = state === "done" ? CheckCircle2 : Circle;
  const color = state === "done" ? "text-emerald-500" : state === "current" ? "text-amber-400" : "text-neutral-600";
  return (
    <li className={`flex items-center gap-2 normal-case ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </li>
  );
}