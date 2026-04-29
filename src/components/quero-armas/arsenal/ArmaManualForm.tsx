/**
 * FASE 4 — Cadastro manual de arma (escopo mínimo eficaz).
 *
 * Salva em `qa_cliente_armas_manual` com:
 *  - Identidade resolvida server-side via `ensureClienteFromAuthUser` (auth.uid).
 *  - Validação de modelo (não aceitar números puros).
 *  - Dedupe consultando a view `qa_cliente_armas` por:
 *      número de série | CRAF | SINARM | SIGMA | (marca + modelo + calibre).
 *
 * NÃO altera ArsenalView nem o loadData do portal — apenas insere e dispara onSaved.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ensureClienteFromAuthUser } from "@/lib/quero-armas/ensureClienteFromAuthUser";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando informado, pula `ensureClienteFromAuthUser` (uso pelo admin). */
  qaClienteId?: number;
  defaultEmail?: string | null;
  defaultCpf?: string | null;
  defaultNome?: string | null;
  onSaved?: () => void | Promise<void>;
}

const isModeloInvalido = (s: string) => /^[0-9\s.\-/]+$/.test(s.trim());
const upper = (s: string) => s.trim().toUpperCase();
const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

export default function ArmaManualForm({
  open,
  onOpenChange,
  qaClienteId,
  defaultEmail,
  defaultCpf,
  defaultNome,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [sistema, setSistema] = useState<"SINARM" | "SIGMA">("SINARM");
  const [tipo, setTipo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [calibre, setCalibre] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [numeroCraf, setNumeroCraf] = useState("");
  const [numeroSinarm, setNumeroSinarm] = useState("");
  const [numeroSigma, setNumeroSigma] = useState("");
  const [autCompra, setAutCompra] = useState("");

  const reset = () => {
    setSistema("SINARM"); setTipo(""); setMarca(""); setModelo(""); setCalibre("");
    setNumeroSerie(""); setNumeroCraf(""); setNumeroSinarm(""); setNumeroSigma(""); setAutCompra("");
  };

  async function handleSubmit() {
    if (!modelo.trim()) { toast.error("Modelo é obrigatório."); return; }
    if (isModeloInvalido(modelo)) {
      toast.error("Modelo não pode ser apenas número. Informe o modelo real (ex.: TS9, G25).");
      return;
    }

    setSaving(true);
    try {
      // 1) Resolver cliente
      let clienteId = qaClienteId ?? null;
      if (!clienteId) {
        const ensured = await ensureClienteFromAuthUser({
          email: defaultEmail ?? null,
          cpf: defaultCpf ?? null,
          nome: defaultNome ?? null,
        });
        if (ensured.needs_manual_review || !ensured.qa_cliente_id) {
          toast.error("Não foi possível identificar seu cadastro. Contate o suporte.");
          setSaving(false); return;
        }
        clienteId = ensured.qa_cliente_id;
      }

      // 2) Dedupe via view qa_cliente_armas
      const { data: existentes, error: errView } = await supabase
        .from("qa_cliente_armas" as any)
        .select("arma_uid, modelo, marca, calibre, numero_serie, numero_craf, numero_sinarm, numero_sigma")
        .eq("qa_cliente_id", clienteId);
      if (errView) throw errView;

      const sNorm = norm(numeroSerie);
      const cNorm = norm(numeroCraf);
      const siNorm = norm(numeroSinarm);
      const sgNorm = norm(numeroSigma);
      const mmcKey = `${upper(marca)}|${upper(modelo)}|${upper(calibre)}`;

      const dup = (existentes as any[] | null)?.find((a) => {
        if (sNorm && norm(a.numero_serie || "") === sNorm) return true;
        if (cNorm && norm(a.numero_craf || "") === cNorm) return true;
        if (siNorm && norm(a.numero_sinarm || "") === siNorm) return true;
        if (sgNorm && norm(a.numero_sigma || "") === sgNorm) return true;
        if (a.modelo && a.marca && a.calibre) {
          if (`${upper(a.marca)}|${upper(a.modelo)}|${upper(a.calibre)}` === mmcKey) return true;
        }
        return false;
      });

      if (dup) {
        toast.error("Arma semelhante já existe no seu arsenal. Cadastro bloqueado para evitar duplicidade.");
        setSaving(false); return;
      }

      // 3) Insert
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, any> = {
        qa_cliente_id: clienteId,
        user_id: user?.id ?? null,
        origem: "manual",
        sistema,
        tipo_arma: tipo ? upper(tipo) : null,
        marca: marca ? upper(marca) : null,
        modelo: upper(modelo),
        calibre: calibre ? upper(calibre) : null,
        numero_serie: numeroSerie ? upper(numeroSerie) : null,
        numero_craf: numeroCraf ? upper(numeroCraf) : null,
        numero_sinarm: numeroSinarm ? upper(numeroSinarm) : null,
        numero_sigma: numeroSigma ? upper(numeroSigma) : null,
        numero_autorizacao_compra: autCompra ? upper(autCompra) : null,
        needs_review: false,
      };

      const { error: errIns } = await supabase
        .from("qa_cliente_armas_manual" as any)
        .insert(payload);
      if (errIns) throw errIns;

      toast.success("Arma cadastrada com sucesso.");
      reset();
      onOpenChange(false);
      await onSaved?.();
    } catch (e: any) {
      console.error("[ArmaManualForm] erro:", e);
      toast.error(e?.message || "Erro ao salvar arma.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CADASTRAR ARMA MANUALMENTE</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">SISTEMA</Label>
            <Select value={sistema} onValueChange={(v) => setSistema(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SINARM">SINARM</SelectItem>
                <SelectItem value="SIGMA">SIGMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">TIPO</Label>
              <Input className="h-9 uppercase" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="PISTOLA" />
            </div>
            <div>
              <Label className="text-xs">CALIBRE</Label>
              <Input className="h-9 uppercase" value={calibre} onChange={(e) => setCalibre(e.target.value)} placeholder=".380 ACP" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">MARCA</Label>
              <Input className="h-9 uppercase" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="GLOCK" />
            </div>
            <div>
              <Label className="text-xs">MODELO *</Label>
              <Input className="h-9 uppercase" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="G25" />
            </div>
          </div>
          <div>
            <Label className="text-xs">NÚMERO DE SÉRIE</Label>
            <Input className="h-9 uppercase" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">NÚMERO CRAF</Label>
              <Input className="h-9 uppercase" value={numeroCraf} onChange={(e) => setNumeroCraf(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">AUTORIZAÇÃO COMPRA</Label>
              <Input className="h-9 uppercase" value={autCompra} onChange={(e) => setAutCompra(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">NÚMERO SINARM</Label>
              <Input className="h-9 uppercase" value={numeroSinarm} onChange={(e) => setNumeroSinarm(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">NÚMERO SIGMA</Label>
              <Input className="h-9 uppercase" value={numeroSigma} onChange={(e) => setNumeroSigma(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>CANCELAR</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "SALVANDO..." : "SALVAR ARMA"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}