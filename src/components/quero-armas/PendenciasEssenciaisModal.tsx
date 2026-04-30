import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import {
  useCadastroPendenciasCriticas,
  shouldShowPendenciasModalThisSession,
  dismissPendenciasModalForSession,
  type PendenciaItem,
} from "./clientes/useCadastroPendenciasCriticas";

const TIPO_LABEL: Record<string, string> = {
  sem_cliente_vinculado: "Cadastro público sem cliente vinculado",
  servico_solicitado_nao_gerado: "Serviço informado no formulário, mas não gerado na ficha do cliente",
  servico_pendente_classificacao: "Serviço solicitado precisa de classificação manual",
};

export default function PendenciasEssenciaisModal() {
  const { pendencias, loading } = useCadastroPendenciasCriticas();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (pendencias.length === 0) return;
    if (!shouldShowPendenciasModalThisSession()) return;
    setOpen(true);
  }, [loading, pendencias.length]);

  const close = () => {
    dismissPendenciasModalForSession();
    setOpen(false);
  };

  const goToCadastro = (p: PendenciaItem) => {
    dismissPendenciasModalForSession();
    setOpen(false);
    navigate(`/clientes?cadastro_publico=${p.cadastro_publico_id}`);
  };

  const goToList = () => {
    dismissPendenciasModalForSession();
    setOpen(false);
    navigate(`/clientes`);
  };

  if (pendencias.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-2xl bg-white border border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Pendências essenciais de cadastro
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {pendencias.length} cadastro{pendencias.length > 1 ? "s" : ""} recebido{pendencias.length > 1 ? "s" : ""} pelo formulário público com dados essenciais a completar antes de seguir o fluxo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-2">
          {pendencias.slice(0, 25).map((p) => (
            <div key={p.cadastro_publico_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold uppercase text-slate-900 truncate">{p.nome}</div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {p.cpf || "—"} · Origem: Formulário público
                  </div>
                  <div className="mt-1 text-[11px] text-slate-700">
                    Serviço informado: <span className="font-semibold uppercase">{p.servico_interesse || "—"}</span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {p.pendencias.map((t) => (
                      <li key={t} className="text-[11px] text-amber-800 flex gap-1.5">
                        <span className="text-amber-600">•</span>
                        {TIPO_LABEL[t] ?? t}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="shrink-0 h-8 text-[11px]"
                  onClick={() => goToCadastro(p)}
                >
                  Resolver agora <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
          {pendencias.length > 25 && (
            <div className="text-[11px] text-slate-500 text-center py-2">
              + {pendencias.length - 25} pendência(s) adicional(is) — abra a lista completa.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <Button variant="ghost" size="sm" onClick={close} className="text-slate-500">
            <X className="h-3.5 w-3.5 mr-1" /> Fechar por enquanto
          </Button>
          <Button variant="outline" size="sm" onClick={goToList}>
            Ver lista completa em /clientes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}