/**
 * FASE 5 — Edição administrativa de arma manual/IA.
 *
 * Permite à equipe revisar e editar registros de `qa_cliente_armas_manual`.
 * - Bloqueia modelo puramente numérico (frontend; trigger no banco é defesa).
 * - Permite marcar `needs_review = false` ("Marcar como revisado") quando
 *   o modelo está válido.
 * - Armas vindas de `qa_crafs` NÃO usam este modal (somente leitura).
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ArmaHistoricoBlock from "@/components/arsenal/ArmaHistoricoBlock";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Registro vindo de `qa_cliente_armas_manual` (id numérico). */
  arma: any | null;
  onSaved?: () => void | Promise<void>;
}

const isModeloInvalido = (s: string) => /^[0-9\s.\-/]+$/.test(s.trim());
const upper = (s: string) => (s ?? "").toString().trim().toUpperCase();

const STATUS_DOC_OPTIONS = [
  { value: "—", label: "— (não definido)" },
  { value: "regular", label: "REGULAR" },
  { value: "irregular", label: "IRREGULAR" },
  { value: "vencido", label: "VENCIDO" },
  { value: "em_renovacao", label: "EM RENOVAÇÃO" },
];

export default function ArmaManualEditModal({ open, onOpenChange, arma, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
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
  const [statusDoc, setStatusDoc] = useState<string>("—");
  const [needsReview, setNeedsReview] = useState(false);

  useEffect(() => {
    if (!arma) return;
    setSistema((arma.sistema as any) || "SINARM");
    setTipo(arma.tipo_arma || "");
    setMarca(arma.marca || "");
    setModelo(arma.modelo || "");
    setCalibre(arma.calibre || "");
    setNumeroSerie(arma.numero_serie || "");
    setNumeroCraf(arma.numero_craf || "");
    setNumeroSinarm(arma.numero_sinarm || "");
    setNumeroSigma(arma.numero_sigma || "");
    setAutCompra(arma.numero_autorizacao_compra || "");
    setStatusDoc(arma.status_documental || "—");
    setNeedsReview(!!arma.needs_review);
  }, [arma]);

  function buildPayload(forceReviewed?: boolean): Record<string, any> | null {
    if (!modelo.trim()) {
      toast.error("Modelo é obrigatório.");
      return null;
    }
    if (isModeloInvalido(modelo)) {
      toast.error("Modelo não pode ser número de documento. Informe o modelo real da arma.");
      return null;
    }
    return {
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
      status_documental: statusDoc && statusDoc !== "—" ? statusDoc : null,
      needs_review: forceReviewed === true ? false : needsReview,
      updated_at: new Date().toISOString(),
    };
  }

  async function persist(payload: Record<string, any>) {
    if (!arma?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("qa_cliente_armas_manual" as any)
        .update(payload)
        .eq("id", arma.id);
      if (error) throw error;
      // FASE 6 — auditoria é gravada automaticamente via trigger no banco
      // (qa_cliente_armas_manual_audit_trg). Apenas atualiza o histórico exibido.
      setHistoryKey((k) => k + 1);
      return true;
    } catch (e: any) {
      console.error("[ArmaManualEditModal] erro:", e);
      toast.error(e?.message || "Erro ao salvar arma.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const payload = buildPayload();
    if (!payload) return;
    const ok = await persist(payload);
    if (ok) {
      toast.success("Arma atualizada.");
      onOpenChange(false);
      await onSaved?.();
    }
  }

  async function handleMarcarRevisado() {
    if (!modelo.trim() || isModeloInvalido(modelo)) {
      toast.error("Modelo inválido. Corrija antes de marcar como revisado.");
      return;
    }
    if (!calibre.trim()) {
      toast.error("Informe o calibre antes de marcar como revisado.");
      return;
    }
    const payload = buildPayload(true);
    if (!payload) return;
    const ok = await persist(payload);
    if (ok) {
      toast.success("Arma marcada como revisada.");
      setNeedsReview(false);
      onOpenChange(false);
      await onSaved?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EDITAR ARMA {arma?.origem === "ocr" || arma?.origem === "ia" ? "(IA/OCR)" : "(MANUAL)"}</DialogTitle>
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
              <Input
                className="h-9 uppercase"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="G25"
              />
              {modelo.trim() && isModeloInvalido(modelo) && (
                <div className="text-[10px] mt-1 text-red-600">
                  Modelo não pode ser número de documento. Informe o modelo real da arma.
                </div>
              )}
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
          <div>
            <Label className="text-xs">STATUS DOCUMENTAL</Label>
            <Select value={statusDoc} onValueChange={setStatusDoc}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_DOC_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsReview && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
              Esta arma está marcada como <b>PRECISA REVISÃO</b>. Confirme modelo e calibre, depois clique em <b>Marcar como revisado</b>.
            </div>
          )}
          {arma?.id && (
            <ArmaHistoricoBlock armaManualId={arma.id} refreshKey={historyKey} />
          )}
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>CANCELAR</Button>
          {needsReview && (
            <Button
              variant="secondary"
              onClick={handleMarcarRevisado}
              disabled={saving}
              className="bg-amber-100 text-amber-900 hover:bg-amber-200"
            >
              {saving ? "SALVANDO..." : "MARCAR COMO REVISADO"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>{saving ? "SALVANDO..." : "SALVAR"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}