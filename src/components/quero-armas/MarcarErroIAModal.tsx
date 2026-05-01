import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIPOS_PECA } from "@/components/quero-armas/tiposPeca";
import { CATEGORIAS_ERRO } from "@/pages/quero-armas/QACorrecoesIAPage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, GraduationCap, Globe2, User, FolderOpen, FileText, Power } from "lucide-react";
import { toast } from "sonner";

/**
 * Modal compartilhado para registrar uma correção supervisionada da IA.
 * Usa a MESMA tabela `qa_ia_correcoes_juridicas` da página /correcoes-ia.
 * NÃO duplica lógica: apenas grava o registro (Fase 2).
 */

export type EscopoTarget = "global" | "cliente" | "caso" | "peca";

export interface CorrecaoContext {
  tipo_peca?: string;
  foco_argumentativo?: string | null;
  cliente_id?: string | number | null;
  caso_id?: string | null;
  peca_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trechoInicial?: string;
  context?: CorrecaoContext;
  onSaved?: () => void;
}

export default function MarcarErroIAModal({ open, onOpenChange, trechoInicial, context, onSaved }: Props) {
  const [tipoPeca, setTipoPeca] = useState<string>(context?.tipo_peca || TIPOS_PECA[0].value);
  const [foco, setFoco] = useState<string>(context?.foco_argumentativo || "");
  const [categoria, setCategoria] = useState<string>("outro");
  const [trechoErrado, setTrechoErrado] = useState<string>(trechoInicial || "");
  const [trechoCorreto, setTrechoCorreto] = useState<string>("");
  const [explicacao, setExplicacao] = useState<string>("");
  const [regra, setRegra] = useState<string>("");
  const [escopo, setEscopo] = useState<EscopoTarget>(
    context?.peca_id ? "peca" : context?.caso_id ? "caso" : context?.cliente_id ? "cliente" : "global",
  );
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipoPeca(context?.tipo_peca || TIPOS_PECA[0].value);
    setFoco(context?.foco_argumentativo || "");
    setCategoria("outro");
    setTrechoErrado(trechoInicial || "");
    setTrechoCorreto("");
    setExplicacao("");
    setRegra("");
    setEscopo(context?.peca_id ? "peca" : context?.caso_id ? "caso" : context?.cliente_id ? "cliente" : "global");
    setAtivo(true);
  }, [open, trechoInicial, context]);

  // Escopos disponíveis dependem do contexto vindo da peça
  const escoposDisponiveis: { value: EscopoTarget; label: string; icon: any; available: boolean; hint?: string }[] = [
    { value: "global", label: "GLOBAL — TODAS AS PEÇAS", icon: Globe2, available: true },
    { value: "cliente", label: "APENAS ESTE CLIENTE", icon: User, available: !!context?.cliente_id, hint: !context?.cliente_id ? "Cliente não vinculado" : undefined },
    { value: "caso", label: "APENAS ESTE CASO", icon: FolderOpen, available: !!context?.caso_id, hint: !context?.caso_id ? "Salve o caso primeiro" : undefined },
    { value: "peca", label: "APENAS ESTA PEÇA", icon: FileText, available: !!context?.peca_id, hint: !context?.peca_id ? "Sem peça gerada vinculada" : undefined },
  ];

  async function salvar() {
    if (trechoErrado.trim().length < 5) { toast.error("Trecho errado deve ter ao menos 5 caracteres"); return; }
    if (trechoCorreto.trim().length < 5) { toast.error("Trecho correto deve ter ao menos 5 caracteres"); return; }
    // Garantir coerência com a constraint do banco
    if (escopo !== "global") {
      const ok = (escopo === "cliente" && context?.cliente_id)
        || (escopo === "caso" && context?.caso_id)
        || (escopo === "peca" && context?.peca_id);
      if (!ok) { toast.error("Escopo selecionado não tem ID disponível"); return; }
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        tipo_peca: tipoPeca,
        foco_argumentativo: foco.trim() || null,
        categoria_erro: categoria,
        trecho_errado: trechoErrado.trim(),
        trecho_correto: trechoCorreto.trim(),
        explicacao: explicacao.trim() || null,
        regra_aplicavel: regra.trim() || null,
        aplicar_globalmente: escopo === "global",
        cliente_id: escopo === "cliente" ? String(context?.cliente_id) : null,
        caso_id: escopo === "caso" ? context?.caso_id : null,
        peca_id: escopo === "peca" ? context?.peca_id : null,
        ativo,
        criado_por: user?.id || null,
        criado_por_nome: user?.email || null,
      };
      const { error } = await (supabase as any)
        .from("qa_ia_correcoes_juridicas")
        .insert(payload);
      if (error) throw error;
      toast.success("Correção registrada — a IA vai considerá-la nas próximas peças");
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar correção");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto qa-scope">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wide text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4" style={{ color: "hsl(35 90% 45%)" }} />
            MARCAR TRECHO COMO ERRO DA IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="TIPO DE PEÇA *">
              <Select value={tipoPeca} onValueChange={setTipoPeca}>
                <SelectTrigger className="h-9 text-xs uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PECA.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs uppercase">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
            <FieldLabel label="CATEGORIA DO ERRO *">
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-9 text-xs uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_ERRO.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs uppercase">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldLabel>
          </div>

          <FieldLabel label="FOCO ARGUMENTATIVO (OPCIONAL)">
            <Input
              value={foco}
              onChange={e => setFoco(e.target.value.toUpperCase())}
              placeholder="EX: LEGALIDADE, MOTIVAÇÃO..."
              className="h-9 text-xs uppercase"
            />
          </FieldLabel>

          <FieldLabel label="TRECHO ERRADO GERADO PELA IA *">
            <Textarea
              value={trechoErrado}
              onChange={e => setTrechoErrado(e.target.value)}
              placeholder="Cole/edite aqui o trecho exato que está incorreto..."
              className="min-h-[100px] text-xs"
            />
          </FieldLabel>

          <FieldLabel label="TRECHO CORRETO ESPERADO *">
            <Textarea
              value={trechoCorreto}
              onChange={e => setTrechoCorreto(e.target.value)}
              placeholder="Escreva como a IA deveria ter redigido..."
              className="min-h-[100px] text-xs"
            />
          </FieldLabel>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="EXPLICAÇÃO DO ERRO">
              <Textarea
                value={explicacao}
                onChange={e => setExplicacao(e.target.value)}
                placeholder="Por que o trecho está errado?"
                className="min-h-[80px] text-xs"
              />
            </FieldLabel>
            <FieldLabel label="REGRA / NORMA APLICÁVEL">
              <Textarea
                value={regra}
                onChange={e => setRegra(e.target.value)}
                placeholder="EX: ART. X DA LEI 10.826/03"
                className="min-h-[80px] text-xs uppercase"
              />
            </FieldLabel>
          </div>

          <FieldLabel label="ESCOPO DA CORREÇÃO">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {escoposDisponiveis.map(opt => {
                const Icon = opt.icon;
                const selected = escopo === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => opt.available && setEscopo(opt.value)}
                    disabled={!opt.available}
                    className="flex items-start gap-2 p-3 rounded-lg border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: selected ? "hsl(35 90% 50%)" : "hsl(36 20% 88%)",
                      background: selected ? "hsl(40 95% 96%)" : "white",
                    }}
                  >
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: selected ? "hsl(35 90% 45%)" : "hsl(220 10% 55%)" }} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 25% 18%)" }}>
                        {opt.label}
                      </div>
                      {opt.hint && <div className="text-[10px]" style={{ color: "hsl(0 60% 45%)" }}>{opt.hint}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </FieldLabel>

          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white" style={{ borderColor: "hsl(36 20% 88%)" }}>
            <div className="flex items-start gap-2 min-w-0">
              <Power className="h-4 w-4 mt-0.5" style={{ color: ativo ? "hsl(35 90% 50%)" : "hsl(220 10% 55%)" }} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 25% 18%)" }}>ATIVA</div>
                <div className="text-[10px]" style={{ color: "hsl(220 10% 50%)" }}>Correções inativas não são usadas pela IA.</div>
              </div>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-wider border transition-colors"
            style={{ borderColor: "hsl(220 13% 85%)", color: "hsl(220 15% 30%)" }}
          >Cancelar</button>
          <button
            onClick={salvar}
            disabled={saving}
            className="h-9 px-5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
            style={{ background: "hsl(35 90% 50%)", color: "white" }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
            Registrar correção
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "hsl(220 10% 40%)" }}>{label}</Label>
      {children}
    </div>
  );
}