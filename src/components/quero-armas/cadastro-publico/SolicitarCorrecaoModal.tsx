import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { qaDialogMobile } from "@/components/quero-armas/ui/mobileDialog";

/**
 * Modal real de "Solicitar correção ao cliente" para a conferência
 * do Cadastro Público em /clientes.
 *
 * Recebe a lista de pendências detectadas automaticamente, deixa a equipe:
 *  - selecionar quais enviar;
 *  - adicionar pendências livres;
 *  - escrever observação;
 *  - revisar a prévia da mensagem;
 *  - registrar (atualiza status para `pendente_correcao` no caller);
 *  - registrar e abrir WhatsApp do cliente.
 */

export interface SolicitarCorrecaoPayload {
  itensSelecionados: string[];
  observacao: string;
  mensagemFinal: string;
  abrirWhatsapp: boolean;
}

export interface SolicitarCorrecaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendenciasAuto: string[];
  nomeCliente?: string | null;
  telefoneWhatsapp?: string | null;
  saving?: boolean;
  onConfirm: (payload: SolicitarCorrecaoPayload) => void | Promise<void>;
}

const PENDENCIAS_PADRAO = [
  "Reenviar documento de identificação (RG/CNH/CIN) legível.",
  "Reenviar comprovante de endereço atualizado (últimos 90 dias).",
  "Enviar selfie segurando o documento.",
  "Confirmar/corrigir endereço completo (CEP, rua, número, bairro, cidade/UF).",
  "Confirmar telefone/WhatsApp ativo.",
  "Confirmar e-mail válido.",
  "Confirmar serviço desejado.",
  "Corrigir dados pessoais (nome, CPF, data de nascimento, etc).",
];

function buildMensagem(opts: {
  nome?: string | null;
  itens: string[];
  observacao: string;
}) {
  const saud = opts.nome
    ? `Olá, ${String(opts.nome).split(" ")[0]}!`
    : "Olá!";
  const corpo = opts.itens.length
    ? `Para concluir seu cadastro na Quero Armas, precisamos que você ajuste os pontos abaixo:\n\n${opts.itens
        .map((p, i) => `${i + 1}. ${p}`)
        .join("\n")}`
    : "Para concluir seu cadastro na Quero Armas, precisamos de alguns ajustes.";
  const obs = opts.observacao.trim() ? `\n\nObservação da equipe:\n${opts.observacao.trim()}` : "";
  return `${saud}\n\n${corpo}${obs}\n\nResponda esta mensagem assim que possível para seguirmos com o atendimento. Obrigado!`;
}

function digitsOnly(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

export default function SolicitarCorrecaoModal({
  open,
  onOpenChange,
  pendenciasAuto,
  nomeCliente,
  telefoneWhatsapp,
  saving,
  onConfirm,
}: SolicitarCorrecaoModalProps) {
  const sugestoes = useMemo(() => {
    const set = new Set<string>();
    pendenciasAuto.forEach((p) => set.add(p));
    PENDENCIAS_PADRAO.forEach((p) => set.add(p));
    return Array.from(set);
  }, [pendenciasAuto]);

  const [selecionadas, setSelecionadas] = useState<Record<string, boolean>>({});
  const [observacao, setObservacao] = useState("");
  const [livre, setLivre] = useState("");

  useEffect(() => {
    if (open) {
      const inicial: Record<string, boolean> = {};
      pendenciasAuto.forEach((p) => {
        inicial[p] = true;
      });
      setSelecionadas(inicial);
      setObservacao("");
      setLivre("");
    }
  }, [open, pendenciasAuto]);

  const itensFinal = useMemo(() => {
    const arr = sugestoes.filter((p) => selecionadas[p]);
    const livres = livre
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return [...arr, ...livres];
  }, [sugestoes, selecionadas, livre]);

  const mensagem = buildMensagem({
    nome: nomeCliente,
    itens: itensFinal,
    observacao,
  });

  const podeConfirmar = itensFinal.length > 0 && !saving;
  const tel = digitsOnly(telefoneWhatsapp);

  const handleConfirm = async (abrirWhatsapp: boolean) => {
    await onConfirm({
      itensSelecionados: itensFinal,
      observacao: observacao.trim(),
      mensagemFinal: mensagem,
      abrirWhatsapp,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={qaDialogMobile(
          "max-w-2xl bg-white text-slate-900 border-slate-200",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-slate-900">Solicitar correção ao cliente</DialogTitle>
          <DialogDescription className="text-slate-600">
            Selecione os itens que devem ser corrigidos. Uma mensagem padronizada será preparada
            para envio via WhatsApp/E-mail e o cadastro entrará em <b>pendente de correção</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 mb-2">
              Pendências
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-slate-50/40">
              {sugestoes.map((p) => (
                <label
                  key={p}
                  className="flex items-start gap-2 text-[13px] text-slate-800 cursor-pointer"
                >
                  <Checkbox
                    checked={!!selecionadas[p]}
                    onCheckedChange={(v) =>
                      setSelecionadas((prev) => ({ ...prev, [p]: !!v }))
                    }
                    className="mt-0.5"
                  />
                  <span className="leading-snug">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
              Outros itens (1 por linha)
            </label>
            <textarea
              rows={2}
              value={livre}
              onChange={(e) => setLivre(e.target.value)}
              placeholder="Ex.: Confirmar nome da mãe completo."
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-[13px] text-slate-900 outline-none focus:border-[#7A1F2B] bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
              Observação interna / contexto
            </label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Será incluída na mensagem ao cliente."
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-[13px] text-slate-900 outline-none focus:border-[#7A1F2B] bg-white"
            />
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 mb-1">
              Prévia da mensagem
            </div>
            <pre className="text-[12px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800 max-h-48 overflow-y-auto font-sans leading-snug">
              {mensagem}
            </pre>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!saving}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={!podeConfirmar}
            onClick={() => void handleConfirm(false)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Registrar solicitação
          </Button>
          <Button
            disabled={!podeConfirmar || tel.length < 10}
            onClick={() => void handleConfirm(true)}
            className="bg-[#7A1F2B] hover:bg-[#641722] text-white"
            title={tel.length < 10 ? "Telefone do cliente ausente." : "Registrar e abrir WhatsApp"}
          >
            <MessageCircle className="h-4 w-4 mr-1" /> Registrar e abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}