// ============================================================================
// ConfrontoCpfComprovanteModal — CPF-01
// ----------------------------------------------------------------------------
// A concessionária imprime o CPF mascarado (***.123.456-**) ou não imprime.
// Isso NÃO reprova a conta e NÃO transforma o comprovante em documento de
// terceiro: perguntamos ao cliente qual é o CPF do titular da conta e
// confrontamos com os dígitos que ficaram legíveis no documento.
// ============================================================================
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ShieldQuestion } from "lucide-react";
import type { CpfLido } from "@/lib/quero-armas/titularComprovante";

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

interface Props {
  open: boolean;
  cpfLido: CpfLido | null;
  titularLido?: string | null;
  erro?: string | null;
  onFechar: () => void;
  onConfirmar: (cpf: string) => void;
}

export default function ConfrontoCpfComprovanteModal({
  open,
  cpfLido,
  titularLido,
  erro,
  onFechar,
  onConfirmar,
}: Props) {
  const [valor, setValor] = useState("");
  useEffect(() => {
    if (open) setValor("");
  }, [open]);

  const visiveis = (cpfLido?.padrao || "").replace(/\*/g, "").length;
  const impresso = cpfLido?.bruto || null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden rounded-sm border-2 border-[#7A1F2B] bg-white p-0 [&>button]:hidden"
      >
        <div className="relative border-b-2 border-[#7A1F2B] bg-[#FAFAFA] px-5 py-4 pr-14 sm:pr-16">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-[#7A1F2B]" />
            <h2 className="font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-[#0A0A0A]">
              Conferência do titular
            </h2>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#4A4A4A]">
            A concessionária não imprimiu o CPF completo. Isso não invalida a
            conta — só precisamos confirmar de quem ela é.
          </p>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-sm bg-[#7A1F2B] text-white transition-colors hover:bg-[#5A1622]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {(titularLido || impresso) && (
            <div className="rounded-sm border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5">
              {titularLido && (
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6A6A]">
                  Titular impresso: <span className="text-[#0A0A0A]">{titularLido}</span>
                </p>
              )}
              {impresso && (
                <p className="mt-1 font-mono text-[13px] text-[#0A0A0A]">
                  CPF no documento: {impresso}
                </p>
              )}
              {visiveis > 0 && (
                <p className="mt-1 text-[11px] text-[#6A6A6A]">
                  {visiveis} dígito{visiveis > 1 ? "s" : ""} legíve{visiveis > 1 ? "is" : "l"} —
                  confrontamos exatamente esses.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-[#0A0A0A]">
              CPF do titular da conta
            </label>
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={valor}
              onChange={(e) => setValor(mascaraCpf(e.target.value))}
              className="h-11 rounded-sm border-[#D5D5D5] font-mono text-[15px]"
            />
            {erro && (
              <p className="mt-2 rounded-sm border border-[#7A1F2B] bg-[#FDF2F3] px-2.5 py-2 text-[12px] text-[#7A1F2B]">
                {erro}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-[#E5E5E5] bg-white px-5 py-4">
          <Button
            variant="outline"
            onClick={onFechar}
            className="h-11 flex-1 rounded-sm border-[#E5E5E5] bg-white font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-[#0A0A0A] hover:bg-[#F7F7F7]"
          >
            Depois
          </Button>
          <Button
            onClick={() => onConfirmar(valor.replace(/\D/g, ""))}
            disabled={valor.replace(/\D/g, "").length !== 11}
            className="h-11 flex-[1.3] rounded-sm bg-[#0A0A0A] font-heading text-[12px] font-bold uppercase tracking-[0.22em] text-white hover:bg-[#7A1F2B]"
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
