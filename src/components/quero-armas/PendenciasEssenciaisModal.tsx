import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, X, CheckCircle2 } from "lucide-react";
import {
  useCadastroPendenciasCriticas,
  shouldShowPendenciasModalThisSession,
  dismissPendenciasModalForSession,
  type PendenciaItem,
} from "./clientes/useCadastroPendenciasCriticas";

const TIPO_LABEL: Record<string, string> = {
  sem_cliente_vinculado: "Cadastro público sem cliente vinculado",
  cpf_divergente: "CPF do cadastro público diverge do cliente vinculado",
  dados_formulario_nao_aplicados: "Dados do formulário não aplicados na ficha do cliente",
  servico_solicitado_nao_gerado: "Serviço informado no formulário, mas não gerado na ficha do cliente",
  servico_sem_slug: "Serviço sem identificador canônico (slug)",
  servico_pendente_classificacao: "Serviço solicitado precisa de classificação manual",
  servico_sem_status: "Solicitação de serviço sem status",
  servico_sem_status_financeiro: "Solicitação de serviço sem status financeiro",
  servico_sem_status_processo: "Solicitação de serviço sem status do processo",
  documentos_orfaos: "Documentos enviados pelo formulário sem vínculo ao cadastro público",
  cliente_sem_cadastro_publico_id: "Cliente vindo do formulário sem vínculo reverso (cadastro_publico_id)",
  conferido_com_pendencias: "Formulário marcado como conferido, mas ainda há pendências",
};

/**
 * Painel "Pendências essenciais de cadastro".
 *
 * Modos:
 *  - automático (padrão): abre uma vez ao logar quando há pendências e o
 *    admin ainda não dispensou nesta sessão.
 *  - manual: controlado pelo caller via `open`/`onOpenChange`. Sempre exibe
 *    o resultado da varredura — inclusive "nenhuma pendência" — para o botão
 *    "Verificar pendências" da Dashboard.
 *
 * Em ambos os modos a fonte é o MESMO hook `useCadastroPendenciasCriticas`,
 * sem duplicar consultas/regras.
 */
export default function PendenciasEssenciaisModal({
  open: controlledOpen,
  onOpenChange,
  triggeredManually = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggeredManually?: boolean;
} = {}) {
  const { pendencias, loading } = useCadastroPendenciasCriticas();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen! : internalOpen;
  const navigate = useNavigate();

  useEffect(() => {
    if (isControlled) return; // modo manual: caller controla
    if (loading) return;
    if (pendencias.length === 0) return;
    if (!shouldShowPendenciasModalThisSession()) return;
    setInternalOpen(true);
  }, [loading, pendencias.length, isControlled]);

  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  const close = () => {
    if (!isControlled) dismissPendenciasModalForSession();
    setOpen(false);
  };

  const goToCadastro = (p: PendenciaItem) => {
    if (!isControlled) dismissPendenciasModalForSession();
    setOpen(false);
    navigate(`/clientes?cadastro_publico=${p.cadastro_publico_id}`);
  };

  const goToList = () => {
    if (!isControlled) dismissPendenciasModalForSession();
    setOpen(false);
    navigate(`/clientes`);
  };

  // Modo automático sem pendências: nada a renderizar.
  if (!isControlled && pendencias.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-2xl bg-white border border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Pendências essenciais de cadastro
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {loading
              ? "Verificando pendências..."
              : pendencias.length === 0
              ? "Nenhuma pendência essencial encontrada."
              : `${pendencias.length} cadastro${pendencias.length > 1 ? "s" : ""} recebido${pendencias.length > 1 ? "s" : ""} pelo formulário público com dados essenciais a completar antes de seguir o fluxo.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[11px] text-slate-500">Verificando pendências...</span>
          </div>
        ) : pendencias.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-700">Nenhuma pendência essencial encontrada.</span>
            <span className="text-[11px] text-slate-500">{triggeredManually ? "Varredura manual concluída." : "Tudo em dia."}</span>
          </div>
        ) : (
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
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <Button variant="ghost" size="sm" onClick={close} className="text-slate-500">
            <X className="h-3.5 w-3.5 mr-1" /> Fechar
          </Button>
          <Button variant="outline" size="sm" onClick={goToList}>
            Ver lista completa em /clientes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}