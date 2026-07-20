import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, ChevronRight, UserCheck, UserPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ClienteSalvo } from "./PrePilotoWizard";

interface Props {
  dadosRevisados: Record<string, string | null>;
  senhagov: string | null;
  onSalvo: (c: ClienteSalvo) => void;
  onVoltar: () => void;
}

function formatCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return d || null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function Etapa4Salvar({ dadosRevisados, senhagov, onSalvo, onVoltar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [existente, setExistente] = useState<ClienteSalvo | null>(null);
  const [verificado, setVerificado] = useState(false);

  const cpfNorm = dadosRevisados.cpf?.replace(/\D/g, "") ?? null;

  async function verificarDuplicata() {
    if (!cpfNorm || cpfNorm.length !== 11) {
      toast.error("CPF inválido — corrija na etapa anterior");
      return;
    }
    setSalvando(true);
    try {
      const { data } = await supabase
        .from("qa_clientes" as any)
        .select("id, nome_completo, cpf, email, celular")
        .eq("cpf", formatCpf(cpfNorm))
        .maybeSingle();

      if (data) {
        setExistente({ id: (data as any).id, nome_completo: (data as any).nome_completo, cpf: (data as any).cpf, email: (data as any).email, celular: (data as any).celular, existia: true });
      } else {
        setExistente(null);
      }
      setVerificado(true);
    } catch (e: any) {
      toast.error("Erro ao verificar CPF: " + (e?.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  }

  async function salvar(reutilizar: boolean) {
    setSalvando(true);
    try {
      let clienteId: number;
      let existia = false;

      if (reutilizar && existente) {
        clienteId = existente.id;
        existia = true;
        // atualiza dados que podem ter mudado
        await supabase.from("qa_clientes" as any).update({
          nome_completo: dadosRevisados.nome_completo,
          email: dadosRevisados.email || undefined,
          celular: dadosRevisados.celular || undefined,
        }).eq("id", clienteId);
      } else {
        // Criar novo cliente
        const payload: Record<string, unknown> = {
          nome_completo: dadosRevisados.nome_completo,
          cpf: formatCpf(cpfNorm),
          email: dadosRevisados.email || null,
          celular: dadosRevisados.celular || null,
          data_nascimento: dadosRevisados.data_nascimento || null,
          nome_mae: dadosRevisados.nome_mae || null,
          sexo: dadosRevisados.sexo || null,
          rg: dadosRevisados.rg || null,
          end1_cep: dadosRevisados.cep || null,
          end1_logradouro: dadosRevisados.logradouro || null,
          end1_numero: dadosRevisados.numero || null,
          end1_complemento: dadosRevisados.complemento || null,
          end1_bairro: dadosRevisados.bairro || null,
          end1_cidade: dadosRevisados.cidade || null,
          end1_estado: dadosRevisados.estado || null,
          profissao: dadosRevisados.profissao || null,
        };

        const { data: novo, error: errNovo } = await supabase
          .from("qa_clientes" as any)
          .insert(payload)
          .select("id, nome_completo, cpf, email, celular")
          .single();

        if (errNovo || !novo) throw new Error(errNovo?.message || "Falha ao criar cliente");
        clienteId = (novo as any).id;
      }

      // Salvar senha GOV.BR se disponível (via RPC segura)
      if (senhagov) {
        try {
          await supabase.rpc("qa_cliente_salvar_senha_gov" as any, {
            p_cliente_id: clienteId,
            p_senha_plaintext: senhagov,
          });
        } catch {
          toast.warning("Cliente salvo, mas não foi possível salvar a senha GOV.BR — adicione manualmente no cadastro.");
        }
      }

      // Auditoria
      try {
        await supabase.from("qa_logs_auditoria" as any).insert({
          acao: reutilizar ? "pre_piloto_reutilizou_cliente" : "pre_piloto_criou_cliente",
          entidade: "pre_piloto",
          entidade_id: String(clienteId),
          detalhes_json: { campos_preenchidos: Object.keys(dadosRevisados).filter((k) => dadosRevisados[k]) },
        });
      } catch { /* não bloqueia */ }

      const cFinal: ClienteSalvo = {
        id: clienteId,
        nome_completo: dadosRevisados.nome_completo || existente?.nome_completo || "",
        cpf: formatCpf(cpfNorm),
        email: dadosRevisados.email || null,
        celular: dadosRevisados.celular || null,
        existia,
      };

      toast.success(existia ? "Cliente atualizado com sucesso" : "Cliente criado com sucesso");
      onSalvo(cFinal);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 4 — Salvar Cliente</h2>
        <p className="text-xs text-muted-foreground">
          Verificamos se o CPF já está cadastrado antes de criar um novo registro.
        </p>
      </div>

      {/* Resumo */}
      <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-xs">
        <p><span className="font-medium">Nome:</span> {dadosRevisados.nome_completo}</p>
        <p><span className="font-medium">CPF:</span> {formatCpf(cpfNorm) || "(não informado)"}</p>
        {dadosRevisados.email && <p><span className="font-medium">E-mail:</span> {dadosRevisados.email}</p>}
        {dadosRevisados.celular && <p><span className="font-medium">Celular:</span> {dadosRevisados.celular}</p>}
        {senhagov && (
          <p className="flex items-center gap-1 text-green-700">
            <ShieldCheck className="w-3.5 h-3.5" /> Senha GOV.BR será salva (criptografada)
          </p>
        )}
      </div>

      {!verificado && (
        <Button
          onClick={verificarDuplicata}
          disabled={salvando}
          className="w-full bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
          size="sm"
        >
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Verificar CPF e continuar
        </Button>
      )}

      {verificado && existente && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <div className="flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">CPF já cadastrado</p>
              <p className="text-xs text-amber-700 mt-0.5">
                <strong>{existente.nome_completo}</strong> (ID {existente.id})
              </p>
              {existente.email && <p className="text-xs text-amber-600">{existente.email}</p>}
            </div>
          </div>
          <p className="text-xs text-amber-700">O que deseja fazer?</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => salvar(true)}
              disabled={salvando}
              className="text-xs gap-1 flex-1"
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              Usar cadastro existente
            </Button>
            <Button
              size="sm"
              onClick={() => salvar(false)}
              disabled={salvando}
              className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 flex-1"
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              Criar novo mesmo assim
            </Button>
          </div>
        </div>
      )}

      {verificado && !existente && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            CPF não encontrado — será criado um novo cadastro.
          </div>
          <Button
            onClick={() => salvar(false)}
            disabled={salvando}
            className="w-full bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
            size="sm"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Criar cliente e avançar
          </Button>
        </div>
      )}

      <div className="flex justify-start pt-1">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="text-xs gap-1 text-muted-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
      </div>
    </div>
  );
}
