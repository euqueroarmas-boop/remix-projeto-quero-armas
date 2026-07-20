import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, ChevronRight, Loader2, Search, CheckCircle2, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ClienteSalvo } from "./PrePilotoWizard";

type Servico = { id: string; slug: string; nome: string; preco: number | null };

interface Props {
  clienteSalvo: ClienteSalvo;
  onConcluido: (vendaId: number, vendaIdLegado: number | null) => void;
  onVoltar: () => void;
}

function formatBRL(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Etapa5Contrato({ clienteSalvo, onConcluido, onVoltar }: Props) {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [q, setQ] = useState("");
  const [servico, setServico] = useState<Servico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState<"selecionar" | "confirmar" | "ok">("selecionar");
  const [vendaGerada, setVendaGerada] = useState<{ id: number; legado: number | null } | null>(null);

  useEffect(() => {
    supabase
      .from("qa_servicos_catalogo" as any)
      .select("id, slug, nome, preco")
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .then(({ data }) => { setServicos((data ?? []) as unknown as Servico[]); setCarregando(false); });
  }, []);

  const servicosFiltrados = servicos.filter((s) => {
    const t = q.trim().toLowerCase();
    return !t || s.nome.toLowerCase().includes(t) || s.slug.includes(t);
  }).slice(0, 20);

  async function gerarContrato() {
    if (!servico) return;
    setEnviando(true);
    try {
      // 1. Criar venda
      const { data: vendaData, error: errVenda } = await supabase.functions.invoke(
        "qa-checkout-criar-venda",
        {
          body: {
            cart: [{ servico_id: servico.id, slug: servico.slug, quantidade: 1, preco_negociado: servico.preco }],
            target_qa_cliente_id: clienteSalvo.id,
            identificacao: {
              nome_completo: clienteSalvo.nome_completo,
              cpf: clienteSalvo.cpf || "",
              email: clienteSalvo.email || "",
              celular: clienteSalvo.celular || "",
            },
          },
        }
      );
      if (errVenda || !(vendaData as any)?.ok) {
        throw new Error((vendaData as any)?.error || errVenda?.message || "Falha ao criar venda");
      }
      const vendaId = Number((vendaData as any).venda_id);
      const vendaLegado = (vendaData as any).id_legado != null ? Number((vendaData as any).id_legado) : null;

      // 2. Confirmar pagamento (a combinar) — dispara pipeline: PAGO → protocolo → contrato → email
      const { data: pagData, error: errPag } = await supabase.functions.invoke(
        "qa-venda-confirmar-pagamento-manual",
        {
          body: {
            venda_id: vendaId,
            forma_pagamento: "a_combinar",
            parcelas: 1,
            observacao: "Pré-Piloto: contrato gerado antes do pagamento para assinatura do cliente.",
            notificacao_policy: {
              notificar_cliente: true,
              canais: { email: true, whatsapp: false, push: false },
              motivo_nao_notificar: "",
            },
          },
        }
      );
      if (errPag || !(pagData as any)?.ok) {
        throw new Error((pagData as any)?.error || errPag?.message || "Falha ao gerar contrato");
      }

      // Auditoria
      try {
        await supabase.from("qa_logs_auditoria" as any).insert({
        acao: "pre_piloto_contrato_gerado",
        entidade: "pre_piloto",
        entidade_id: String(vendaId),
        detalhes_json: {
          cliente_id: clienteSalvo.id,
          cliente_nome: clienteSalvo.nome_completo,
          servico_id: servico.id,
          servico_nome: servico.nome,
          venda_id_legado: vendaLegado,
        },
        });
      } catch { /* best effort */ }

      setVendaGerada({ id: vendaId, legado: vendaLegado });
      setEtapa("ok");
      toast.success("Contrato gerado e e-mail enviado ao cliente!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar contrato");
    } finally {
      setEnviando(false);
    }
  }

  if (etapa === "ok" && vendaGerada) {
    return (
      <div className="space-y-5">
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-800">Contrato gerado e enviado!</p>
          </div>
          <div className="text-xs text-green-700 space-y-1">
            <p><span className="font-medium">Cliente:</span> {clienteSalvo.nome_completo}</p>
            <p><span className="font-medium">Serviço:</span> {servico?.nome}</p>
            {clienteSalvo.email && (
              <p className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                E-mail enviado para <strong>{clienteSalvo.email}</strong> com link do contrato
              </p>
            )}
          </div>
        </div>

        <div className="bg-muted/40 rounded p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Próximos passos</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Cliente baixa o contrato pelo link do e-mail</li>
            <li>Assina pelo GOV.BR e devolve por WhatsApp</li>
            <li>Você faz upload do contrato assinado no Histórico abaixo</li>
            <li>Depois confirma o pagamento no Piloto Real</li>
          </ul>
        </div>

        <div className="flex gap-2 justify-between">
          <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Button>
          <Button
            size="sm"
            onClick={() => onConcluido(vendaGerada.id, vendaGerada.legado)}
            className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
          >
            Ir para Piloto Real <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (etapa === "confirmar" && servico) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold mb-1">Confirmar geração do contrato</h2>
          <p className="text-xs text-muted-foreground">
            Uma venda será criada e o contrato gerado. O cliente receberá um e-mail com o link para baixar, assinar e devolver.
          </p>
        </div>

        <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-xs">
          <p><span className="font-medium">Cliente:</span> {clienteSalvo.nome_completo}</p>
          <p><span className="font-medium">CPF:</span> {clienteSalvo.cpf || "—"}</p>
          <p><span className="font-medium">E-mail:</span> {clienteSalvo.email || <span className="text-red-600">Não cadastrado — contrato não será enviado!</span>}</p>
          <p><span className="font-medium">Serviço:</span> {servico.nome}</p>
          <p><span className="font-medium">Valor:</span> {formatBRL(servico.preco)}</p>
          <p><span className="font-medium">Pagamento:</span> A combinar (registrado após assinatura)</p>
        </div>

        {!clienteSalvo.email && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            Atenção: o cliente não tem e-mail cadastrado. O contrato será gerado mas o link não será enviado automaticamente.
          </div>
        )}

        <div className="flex gap-2 justify-between">
          <Button variant="outline" size="sm" onClick={() => setEtapa("selecionar")} className="text-xs gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Button>
          <Button
            size="sm"
            onClick={gerarContrato}
            disabled={enviando}
            className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            {enviando ? "Gerando..." : "Gerar contrato e enviar e-mail"}
          </Button>
        </div>
      </div>
    );
  }

  // Seleção de serviço
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 5 — Contrato</h2>
        <p className="text-xs text-muted-foreground">
          Selecione o serviço contratado. O contrato será gerado e enviado por e-mail para o cliente assinar antes do pagamento.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Buscar serviço</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou slug do serviço..."
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando serviços...
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {servicosFiltrados.map((s) => (
            <button
              key={s.id}
              onClick={() => setServico(s)}
              className={`w-full text-left px-3 py-2 rounded text-xs flex justify-between items-center transition-colors ${
                servico?.id === s.id
                  ? "bg-[#7B1C2E] text-white"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <span className="font-medium">{s.nome}</span>
              <span className={servico?.id === s.id ? "text-white/80" : "text-muted-foreground"}>
                {formatBRL(s.preco)}
              </span>
            </button>
          ))}
          {servicosFiltrados.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhum serviço encontrado</p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
        <Button
          size="sm"
          onClick={() => setEtapa("confirmar")}
          disabled={!servico}
          className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
        >
          Continuar <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
