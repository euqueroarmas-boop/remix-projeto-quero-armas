import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Sparkles, Globe, Trash2, CheckCircle2, AlertCircle, Search, Image as ImageIcon, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

type Status = "rascunho" | "pendente_revisao" | "verificado" | "rejeitado";
type Fonte = "curado" | "ia_gerado" | "scrape_fabricante" | "importado";

interface Arma {
  id: string;
  marca: string; modelo: string; apelido: string | null;
  tipo: string; calibre: string;
  capacidade_carregador: number | null; peso_gramas: number | null;
  comprimento_cano_mm: number | null; alcance_efetivo_m: number | null;
  velocidade_projetil_ms: number | null;
  origem: string | null; classificacao_legal: string | null; descricao: string | null;
  stat_dano: number | null; stat_precisao: number | null; stat_alcance: number | null;
  stat_cadencia: number | null; stat_mobilidade: number | null; stat_controle: number | null;
  status_revisao: Status; fonte_dados: Fonte; fonte_url: string | null;
  observacoes: string | null; ativo: boolean;
  search_tokens: string | null;
  imagem: string | null;
  imagem_status: "pendente" | "gerando" | "pronta" | "erro" | null;
}

const TIPOS = ["pistola","revolver","espingarda","carabina","fuzil","submetralhadora","outra"];
const STATUS_LABEL: Record<Status,string> = {
  rascunho: "Rascunho", pendente_revisao: "Pendente revisão", verificado: "Verificado", rejeitado: "Rejeitado",
};
const FONTE_LABEL: Record<Fonte,string> = {
  curado: "Curado", ia_gerado: "IA", scrape_fabricante: "Scrape", importado: "Importado",
};

const empty = (): Partial<Arma> => ({
  marca: "", modelo: "", tipo: "pistola", calibre: "", status_revisao: "rascunho", fonte_dados: "curado", ativo: true,
});

export default function QAArmamentosAdminPage() {
  const [items, setItems] = useState<Arma[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Arma> | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [imgBusyId, setImgBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("qa_armamentos_catalogo" as any).select("*").order("marca").order("modelo");
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setItems((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return items.filter((it) => {
      if (tipoFilter !== "todos" && it.tipo !== tipoFilter) return false;
      if (statusFilter !== "todos" && it.status_revisao !== statusFilter) return false;
      if (!norm) return true;
      return [it.marca, it.modelo, it.apelido, it.calibre].filter(Boolean).join(" ").toLowerCase().includes(norm);
    });
  }, [items, q, tipoFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    pendentes: items.filter(i => i.status_revisao === "pendente_revisao").length,
    verificados: items.filter(i => i.status_revisao === "verificado").length,
    ia: items.filter(i => i.fonte_dados === "ia_gerado").length,
  }), [items]);

  function openNew() { setEditing(empty()); setScrapeUrl(""); setOpen(true); }
  function openEdit(it: Arma) { setEditing({ ...it }); setScrapeUrl(it.fonte_url || ""); setOpen(true); }

  async function save() {
    if (!editing?.marca || !editing?.modelo || !editing?.tipo || !editing?.calibre) {
      toast.error("Marca, modelo, tipo e calibre são obrigatórios"); return;
    }
    setSaving(true);
    const payload: any = { ...editing };
    payload.search_tokens = `${payload.marca} ${payload.modelo} ${payload.apelido || ""} ${payload.calibre}`.toUpperCase();
    if (payload.fonte_url !== undefined) payload.fonte_url = payload.fonte_url || null;
    const isUpdate = !!editing.id;
    const { error } = isUpdate
      ? await supabase.from("qa_armamentos_catalogo" as any).update(payload).eq("id", editing.id!)
      : await supabase.from("qa_armamentos_catalogo" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isUpdate ? "Atualizado" : "Criado");
    setOpen(false); load();
  }

  async function remove(it: Arma) {
    if (!confirm(`Excluir ${it.marca} ${it.modelo}?`)) return;
    const { error } = await supabase.from("qa_armamentos_catalogo" as any).delete().eq("id", it.id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  }

  async function marcarVerificado(it: Arma) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("qa_armamentos_catalogo" as any)
      .update({ status_revisao: "verificado", revisado_em: new Date().toISOString(), revisado_por: u.user?.id || null })
      .eq("id", it.id);
    if (error) toast.error(error.message); else { toast.success("Marcado como verificado"); load(); }
  }

  async function gerarImagem(it: Pick<Arma, "id" | "marca" | "modelo">) {
    if (!it.id) { toast.error("Salve a arma antes de gerar a imagem"); return; }
    setImgBusyId(it.id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-armamento-gerar-imagem", { body: { id: it.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Imagem gerada para ${it.marca} ${it.modelo}`);
      const url = (data as any)?.imagem as string | undefined;
      if (url) {
        setEditing((p) => (p && p.id === it.id ? { ...p, imagem: url, imagem_status: "pronta" } : p));
      }
      load();
    } catch (e: any) {
      toast.error(`Falha ao gerar imagem: ${e?.message || e}`);
    } finally {
      setImgBusyId(null);
    }
  }

  async function gerarComIA() {
    if (!editing?.marca || !editing?.modelo) { toast.error("Preencha marca e modelo primeiro"); return; }
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("qa-armamento-gerar-ia", {
      body: { marca: editing.marca, modelo: editing.modelo, calibre: editing.calibre, tipo: editing.tipo },
    });
    setAiBusy(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const d = (data as any)?.data;
    if (!d) { toast.error("IA não retornou dados"); return; }
    setEditing((prev) => ({ ...(prev || {}), ...d, fonte_dados: "ia_gerado", status_revisao: "pendente_revisao" }));
    toast.success("Dados gerados pela IA — revise antes de salvar");
  }

  async function scrapeFabricante() {
    if (!scrapeUrl) { toast.error("Informe a URL do fabricante"); return; }
    setScrapeBusy(true);
    const { data, error } = await supabase.functions.invoke("qa-armamento-scrape", {
      body: { url: scrapeUrl, marca: editing?.marca, modelo: editing?.modelo },
    });
    setScrapeBusy(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const d = (data as any)?.data;
    if (!d) { toast.error("Scrape não retornou dados"); return; }
    setEditing((prev) => ({ ...(prev || {}), ...d, fonte_dados: "scrape_fabricante", fonte_url: scrapeUrl, status_revisao: "pendente_revisao" }));
    toast.success("Dados extraídos do fabricante — revise antes de salvar");
  }

  function setF<K extends keyof Arma>(k: K, v: any) { setEditing((p) => ({ ...(p || {}), [k]: v })); }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CATÁLOGO DE ARMAMENTOS</h1>
          <p className="text-sm text-muted-foreground">Base técnica de armas reais usadas pelos clientes do Arsenal.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova arma</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total" value={stats.total} />
        <Kpi label="Verificados" value={stats.verificados} tone="success" />
        <Kpi label="Pendentes revisão" value={stats.pendentes} tone="warn" />
        <Kpi label="Gerados por IA" value={stats.ia} />
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar marca, modelo, calibre…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Calibre</TableHead>
                <TableHead>Capac.</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => (
                <TableRow key={it.id} className="cursor-pointer" onClick={() => openEdit(it)}>
                  <TableCell>
                    <div className="font-medium">{it.marca} {it.modelo}</div>
                    {it.apelido && <div className="text-xs text-muted-foreground">"{it.apelido}"</div>}
                  </TableCell>
                  <TableCell className="capitalize">{it.tipo}</TableCell>
                  <TableCell>{it.calibre}</TableCell>
                  <TableCell>{it.capacidade_carregador ?? "—"}</TableCell>
                  <TableCell>{it.origem ?? "—"}</TableCell>
                  <TableCell><StatusBadge s={it.status_revisao} /></TableCell>
                  <TableCell><Badge variant="outline">{FONTE_LABEL[it.fonte_dados]}</Badge></TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {it.status_revisao !== "verificado" && (
                      <Button size="sm" variant="ghost" onClick={() => marcarVerificado(it)} title="Marcar verificado">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(it)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum resultado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar arma" : "Nova arma"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={aiBusy} onClick={gerarComIA}>
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Gerar/Regerar com IA
                </Button>
                <div className="flex gap-2 flex-1 min-w-[260px]">
                  <Input placeholder="URL fabricante (ex: taurusarmas.com.br/...)" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} />
                  <Button type="button" variant="secondary" disabled={scrapeBusy} onClick={scrapeFabricante}>
                    {scrapeBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                    Buscar no fabricante
                  </Button>
                </div>
              </div>
              {editing.status_revisao === "pendente_revisao" && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                  <AlertCircle className="h-4 w-4" /> Dados pendentes de revisão. Confirme a precisão antes de marcar como verificado.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Marca *"><Input value={editing.marca || ""} onChange={(e) => setF("marca", e.target.value)} /></Field>
                <Field label="Modelo *"><Input value={editing.modelo || ""} onChange={(e) => setF("modelo", e.target.value)} /></Field>
                <Field label="Apelido"><Input value={editing.apelido || ""} onChange={(e) => setF("apelido", e.target.value)} /></Field>
                <Field label="Tipo *">
                  <Select value={editing.tipo || "pistola"} onValueChange={(v) => setF("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Calibre *"><Input value={editing.calibre || ""} onChange={(e) => setF("calibre", e.target.value)} /></Field>
                <Field label="Origem"><Input value={editing.origem || ""} onChange={(e) => setF("origem", e.target.value)} /></Field>
                <Field label="Classificação legal">
                  <Select value={editing.classificacao_legal || ""} onValueChange={(v) => setF("classificacao_legal", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Uso Permitido">Uso Permitido</SelectItem>
                      <SelectItem value="Uso Restrito">Uso Restrito</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capacidade carregador"><Input type="number" value={editing.capacidade_carregador ?? ""} onChange={(e) => setF("capacidade_carregador", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Peso (g)"><Input type="number" value={editing.peso_gramas ?? ""} onChange={(e) => setF("peso_gramas", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Comprimento cano (mm)"><Input type="number" value={editing.comprimento_cano_mm ?? ""} onChange={(e) => setF("comprimento_cano_mm", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Alcance efetivo (m)"><Input type="number" value={editing.alcance_efetivo_m ?? ""} onChange={(e) => setF("alcance_efetivo_m", e.target.value === "" ? null : Number(e.target.value))} /></Field>
                <Field label="Velocidade (m/s)"><Input type="number" value={editing.velocidade_projetil_ms ?? ""} onChange={(e) => setF("velocidade_projetil_ms", e.target.value === "" ? null : Number(e.target.value))} /></Field>
              </div>

              <Field label="Descrição"><Textarea rows={2} value={editing.descricao || ""} onChange={(e) => setF("descricao", e.target.value)} /></Field>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Stats (0-100)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {(["stat_dano","stat_precisao","stat_alcance","stat_cadencia","stat_mobilidade","stat_controle"] as const).map(k => (
                    <Field key={k} label={k.replace("stat_","")}>
                      <Input type="number" min={0} max={100} value={(editing as any)[k] ?? ""} onChange={(e) => setF(k as any, e.target.value === "" ? null : Number(e.target.value))} />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Status revisão">
                  <Select value={editing.status_revisao || "rascunho"} onValueChange={(v) => setF("status_revisao", v as Status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Fonte dos dados">
                  <Select value={editing.fonte_dados || "curado"} onValueChange={(v) => setF("fonte_dados", v as Fonte)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(FONTE_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="URL fonte"><Input value={editing.fonte_url || ""} onChange={(e) => setF("fonte_url", e.target.value)} /></Field>
              </div>

              <Field label="Observações internas"><Textarea rows={2} value={editing.observacoes || ""} onChange={(e) => setF("observacoes", e.target.value)} /></Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "success" | "warn" }) {
  const colorMap: Record<string,string> = { success: "text-emerald-600", warn: "text-amber-600" };
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone ? colorMap[tone] : ""}`}>{value}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ s }: { s: Status }) {
  const map: Record<Status, { variant: any; label: string }> = {
    rascunho: { variant: "outline", label: "Rascunho" },
    pendente_revisao: { variant: "secondary", label: "Pendente" },
    verificado: { variant: "default", label: "Verificado" },
    rejeitado: { variant: "destructive", label: "Rejeitado" },
  };
  const c = map[s];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}