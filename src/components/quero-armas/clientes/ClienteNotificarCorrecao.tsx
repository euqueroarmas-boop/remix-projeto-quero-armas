import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Campo {
  campo: string;
  era: string;
  agora: string;
}

interface Props {
  clienteId: number;
  clienteNome: string;
  clienteEmail?: string | null;
}

export default function ClienteNotificarCorrecao({ clienteId, clienteNome, clienteEmail }: Props) {
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState<Campo[]>([{ campo: "", era: "", agora: "" }]);
  const [enviando, setEnviando] = useState(false);

  const addCampo = () => setCampos((prev) => [...prev, { campo: "", era: "", agora: "" }]);
  const removeCampo = (i: number) => setCampos((prev) => prev.filter((_, idx) => idx !== i));
  const updateCampo = (i: number, key: keyof Campo, value: string) =>
    setCampos((prev) => prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));

  const valido = campos.length > 0 && campos.every((c) => c.campo.trim() && c.agora.trim());

  const enviar = async () => {
    if (!valido) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-notificar-correcao-cadastro", {
        body: { clienteId, campos },
      });
      if (error || !data?.ok) {
        toast.error("Falha ao enviar: " + (error?.message ?? data?.error ?? "erro desconhecido"));
      } else {
        toast.success("E-mail de correção enviado para " + (clienteEmail ?? "o cliente") + ".");
        setAberto(false);
        setCampos([{ campo: "", era: "", agora: "" }]);
      }
    } catch (e) {
      toast.error("Erro inesperado: " + String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAberto(true)}
        className="gap-1.5 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        <Mail className="h-3.5 w-3.5" />
        Notificar cliente sobre correção
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notificar {clienteNome} sobre correção de dados</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-[12px] text-slate-500">
              O e-mail informa quais dados foram corrigidos e alerta que dado errado pode reprovar o processo na PF.
              {clienteEmail && (
                <span className="ml-1 font-medium text-slate-700">Será enviado para: {clienteEmail}</span>
              )}
            </p>

            <div className="space-y-3">
              {campos.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Campo {i + 1}
                    </span>
                    {campos.length > 1 && (
                      <button onClick={() => removeCampo(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px]">Nome do campo *</Label>
                    <Input
                      value={c.campo}
                      onChange={(e) => updateCampo(i, "campo", e.target.value)}
                      placeholder="Ex: Título de Eleitor"
                      className="h-8 text-[13px] mt-0.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Era (valor antigo)</Label>
                      <Input
                        value={c.era}
                        onChange={(e) => updateCampo(i, "era", e.target.value)}
                        placeholder="Valor incorreto"
                        className="h-8 text-[13px] mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Agora (valor correto) *</Label>
                      <Input
                        value={c.agora}
                        onChange={(e) => updateCampo(i, "agora", e.target.value)}
                        placeholder="Valor correto"
                        className="h-8 text-[13px] mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addCampo}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-[12px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar outro campo
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!valido || enviando}
                onClick={enviar}
                className="gap-1.5"
              >
                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Enviar e-mail
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
