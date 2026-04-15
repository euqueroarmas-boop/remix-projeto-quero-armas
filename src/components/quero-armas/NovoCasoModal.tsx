import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS_SERVICO = [
  { value: "defesa_posse_arma", label: "Defesa para Posse de Arma" },
  { value: "defesa_porte_arma", label: "Defesa para Porte de Arma" },
  { value: "defesa_craf", label: "Defesa para CRAF" },
  { value: "recurso_administrativo", label: "Recurso Administrativo" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_geracao", label: "Em geração" },
  { value: "gerado", label: "Gerado" },
  { value: "revisado", label: "Revisado" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  preselectedClienteId?: number | null;
}

export default function NovoCasoModal({ open, onOpenChange, onCreated, preselectedClienteId }: Props) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchCliente, setSearchCliente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [tipoServico, setTipoServico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load clients for picker
  useEffect(() => {
    if (!open) return;
    loadClientes();
  }, [open]);

  // Pre-select client
  useEffect(() => {
    if (preselectedClienteId && clientes.length > 0) {
      const c = clientes.find((cl: any) => cl.id === preselectedClienteId);
      if (c) setSelectedCliente(c);
    }
  }, [preselectedClienteId, clientes]);

  const loadClientes = async () => {
    setLoadingClientes(true);
    try {
      const { data } = await supabase.from("qa_clientes" as any)
        .select("id, nome_completo, cpf, cidade, estado")
        .order("nome_completo", { ascending: true }).limit(200);
      setClientes((data as any[]) ?? []);
    } catch { /* ignore */ }
    setLoadingClientes(false);
  };

  const filteredClientes = clientes.filter(c => {
    if (!searchCliente) return true;
    const s = searchCliente.toLowerCase();
    return (c.nome_completo || "").toLowerCase().includes(s) || (c.cpf || "").includes(s);
  });

  const resetForm = () => {
    setTitulo(""); setTipoServico(""); setDescricao(""); setStatus("rascunho");
    setObservacoes(""); setSelectedCliente(null); setSearchCliente("");
  };

  const handleSave = async () => {
    if (!selectedCliente) { toast.error("Selecione um cliente."); return; }
    if (!titulo.trim()) { toast.error("Informe o título do caso."); return; }
    if (!tipoServico) { toast.error("Selecione o tipo de serviço."); return; }

    setSaving(true);
    try {
      const tipoLabel = TIPOS_SERVICO.find(t => t.value === tipoServico)?.label || tipoServico;
      const payload = {
        titulo: titulo.trim(),
        nome_requerente: selectedCliente.nome_completo,
        cpf_cnpj: selectedCliente.cpf || null,
        tipo_peca: tipoServico,
        tipo_servico: tipoLabel,
        cidade: selectedCliente.cidade || null,
        uf: selectedCliente.estado || null,
        descricao_caso: descricao.trim() || null,
        foco_argumentativo: observacoes.trim() || null,
        status,
      };

      const { error } = await supabase.from("qa_casos" as any).insert(payload);
      if (error) throw error;

      toast.success("Caso criado com sucesso!");
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar caso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white border-slate-200 rounded-xl !p-0 overflow-y-auto !top-[1.5rem] !bottom-auto !translate-y-0"
        style={{ width: "calc(100vw - 2rem)", maxWidth: "32rem", maxHeight: "calc(100vh - 3rem)", gap: 0 }}
      >
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "hsl(220 13% 91%)" }}>
          <h2 className="text-base font-bold uppercase" style={{ color: "hsl(220 20% 18%)" }}>Novo Caso</h2>
          <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Cadastre um novo processo</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Client Picker */}
          <div>
            <label className="text-[11px] font-semibold uppercase mb-1.5 block" style={{ color: "hsl(220 10% 45%)" }}>
              Cliente Vinculado *
            </label>
            {selectedCliente ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-slate-50" style={{ borderColor: "hsl(220 13% 91%)" }}>
                <User className="h-4 w-4 shrink-0" style={{ color: "hsl(220 10% 55%)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                    {selectedCliente.nome_completo}
                  </div>
                  <div className="text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>
                    {selectedCliente.cpf} {selectedCliente.cidade && `• ${selectedCliente.cidade}/${selectedCliente.estado || ""}`}
                  </div>
                </div>
                <button onClick={() => setSelectedCliente(null)} className="p-1 rounded hover:bg-slate-200">
                  <X className="h-3.5 w-3.5" style={{ color: "hsl(220 10% 55%)" }} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(220 10% 55%)" }} />
                  <input
                    value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                    placeholder="Buscar cliente por nome ou CPF..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border text-xs uppercase outline-none"
                    style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 20% 18%)" }}
                  />
                </div>
                <div className="max-h-32 overflow-y-auto rounded-lg border" style={{ borderColor: "hsl(220 13% 91%)" }}>
                  {loadingClientes ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(220 10% 55%)" }} />
                    </div>
                  ) : filteredClientes.length === 0 ? (
                    <div className="text-center py-3 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                      Nenhum cliente encontrado
                    </div>
                  ) : (
                    filteredClientes.slice(0, 20).map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCliente(c); setSearchCliente(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b last:border-b-0"
                        style={{ borderColor: "hsl(220 13% 95%)" }}
                      >
                        <div className="text-xs font-medium uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
                          {c.nome_completo}
                        </div>
                        <div className="text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>
                          {c.cpf}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold uppercase mb-1.5 block" style={{ color: "hsl(220 10% 45%)" }}>
              Título do Caso *
            </label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Defesa Administrativa - João Silva"
              className="w-full h-9 px-3 rounded-lg border text-xs uppercase outline-none"
              style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 20% 18%)" }}
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-[11px] font-semibold uppercase mb-1.5 block" style={{ color: "hsl(220 10% 45%)" }}>
              Tipo de Serviço *
            </label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 rounded-lg text-xs uppercase">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_SERVICO.map(t => (
                  <SelectItem key={t.value} value={t.value} className="uppercase text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold uppercase mb-1.5 block" style={{ color: "hsl(220 10% 45%)" }}>
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 rounded-lg text-xs uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value} className="uppercase text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold uppercase mb-1.5 block" style={{ color: "hsl(220 10% 45%)" }}>
              Descrição / Resumo
            </label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva brevemente o caso..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs outline-none resize-none"
              style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 20% 18%)" }}
            />
          </div>

          {/* Observations */}
          <div>
            <label className="text-[11px] font-semibold uppercase mb-1.5 block" style={{ color: "hsl(220 10% 45%)" }}>
              Observações / Foco Argumentativo
            </label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Pontos importantes, foco da argumentação..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs outline-none resize-none"
              style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 10% 18%)" }}
            />
          </div>

          {/* Footer inside scroll */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <button
              onClick={() => { resetForm(); onOpenChange(false); }}
              className="h-9 px-4 rounded-lg text-xs font-medium uppercase hover:bg-slate-100 transition-colors"
              style={{ color: "hsl(220 10% 45%)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="qa-btn-primary h-9 px-5 text-xs font-semibold uppercase flex items-center gap-1.5 no-glow"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Criar Caso
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
