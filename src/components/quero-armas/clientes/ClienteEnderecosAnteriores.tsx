// ============================================================================
// RESIDÊNCIA DOS ÚLTIMOS 5 ANOS — no cadastro do cliente, para a equipe
// ----------------------------------------------------------------------------
// Regra do titular (21/08/2026): o SINARM CAC e o SIGMA exigem certidão de
// antecedentes de CADA estado onde a pessoa morou nos últimos cinco anos. Quem
// morou em São Paulo, Minas, Paraná, Rondônia e Rio Grande do Sul apresenta as
// certidões dos cinco.
//
// A pergunta chega ao cliente pelo checklist, depois do comprovante de
// endereço. Esta tela é a porta da EQUIPE: "para nós podermos cumprir essas
// exigências para o cliente caso seja necessário" — quando o cliente não
// responde, responde errado, ou informa por telefone.
//
// O QUE ACONTECE AO SALVAR
// Nada é montado aqui. Gravar em qa_cliente_enderecos_anteriores dispara o
// gatilho qa_trg_endereco_anterior_resseia, que chama o semeador em todos os
// processos do cliente que ainda montam dossiê. As certidões aparecem sozinhas
// no checklist, em bloco separado, e o dossiê já protocolado não é tocado.
//
// O QUE IMPORTA NO FIM É O ESTADO. Várias cidades do mesmo estado geram um
// bloco só; a cidade fica como registro para a conferência.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EnderecosAnterioresLista } from "@/components/quero-armas/EnderecosAnterioresLista";
import {
  QAAlertBlock,
  QAInfoCard,
  QAOperationalSection,
  QAStatusChip,
} from "@/components/quero-armas/qa-operational";
import {
  type EnderecoAnterior,
  type EnderecoAnteriorGravado,
  chaveEnderecoAnterior as chave,
  diffEnderecosAnteriores,
  estadosDistintos,
} from "@/lib/quero-armas/enderecosAnteriores";

interface LinhaBanco extends EnderecoAnteriorGravado {
  observacao: string | null;
}

// `qa_cliente_enderecos_anteriores` nasceu na migration 20260821080000 e ainda
// não está no types.ts gerado — daí os `as any` nas chamadas do supabase, que
// são o padrão da casa enquanto o espelho de tipos não é regerado. O mesmo vale
// para a coluna residiu_mesmo_endereco_5_anos no update de qa_clientes.

export default function ClienteEnderecosAnteriores({
  cliente,
  onChanged,
}: {
  cliente: any;
  onChanged?: () => void | Promise<void>;
}) {
  const clienteId = Number(cliente?.id) || 0;
  const ufAtual = String(cliente?.estado || "").trim();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [doBanco, setDoBanco] = useState<LinhaBanco[]>([]);
  const [lista, setLista] = useState<EnderecoAnterior[]>([]);
  const [respostaBanco, setRespostaBanco] = useState<boolean | null>(null);
  const [resposta, setResposta] = useState<boolean | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    const [{ data: enderecos }, { data: cli }] = await Promise.all([
      supabase
        .from("qa_cliente_enderecos_anteriores" as any)
        .select("id, uf, cidade, origem, observacao")
        .eq("qa_cliente_id", clienteId)
        .order("uf", { ascending: true }),
      supabase
        .from("qa_clientes")
        .select("residiu_mesmo_endereco_5_anos")
        .eq("id", clienteId)
        .maybeSingle<{ residiu_mesmo_endereco_5_anos: boolean | null }>(),
    ]);

    const linhas = ((enderecos as any[]) ?? []) as LinhaBanco[];
    setDoBanco(linhas);
    setLista(linhas.map((l) => ({ uf: l.uf, cidade: l.cidade || "" })));
    const r = cli?.residiu_mesmo_endereco_5_anos;
    setRespostaBanco(typeof r === "boolean" ? r : null);
    setResposta(typeof r === "boolean" ? r : null);
    setCarregando(false);
  }, [clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const estados = useMemo(() => estadosDistintos(lista, ufAtual), [lista, ufAtual]);

  // O que a equipe mexeu e ainda não gravou.
  const sujo = useMemo(() => {
    if (resposta !== respostaBanco) return true;
    const antes = new Set(doBanco.map((l) => chave(l.uf, l.cidade)));
    const agora = new Set(
      lista.filter((l) => l.uf).map((l) => chave(l.uf, l.cidade)),
    );
    if (antes.size !== agora.size) return true;
    for (const k of agora) if (!antes.has(k)) return true;
    return false;
  }, [resposta, respostaBanco, doBanco, lista]);

  const salvar = async () => {
    if (!clienteId) return;
    setSalvando(true);
    try {
      // 1) A resposta, no cadastro.
      if (resposta !== respostaBanco) {
        const { error } = await supabase
          .from("qa_clientes")
          .update({ residiu_mesmo_endereco_5_anos: resposta } as any)
          .eq("id", clienteId);
        if (error) throw error;
      }

      // 2) O que sai e o que entra. A regra vive em enderecosAnteriores.ts,
      //    junto do resto da régua e com teste em cima.
      const { remover, inserir } = diffEnderecosAnteriores(
        doBanco,
        lista,
        resposta === true,
      );

      if (remover.length > 0) {
        const { error } = await supabase
          .from("qa_cliente_enderecos_anteriores" as any)
          .delete()
          .in("id", remover);
        if (error) throw error;
      }

      if (inserir.length > 0) {
        const { error } = await supabase
          .from("qa_cliente_enderecos_anteriores" as any)
          .insert(
            inserir.map((l) => ({
              qa_cliente_id: clienteId,
              uf: l.uf,
              cidade: l.cidade || null,
              origem: "equipe",
              observacao: "Lançado pela equipe no cadastro do cliente.",
            })) as any,
          );
        if (error) throw error;
      }

      toast.success(
        resposta === true
          ? "Registrado: morou no mesmo endereço nos últimos 5 anos."
          : estados.length > 0
            ? `Salvo. As certidões de ${estados.join(", ")} entram nos processos abertos deste cliente.`
            : "Salvo.",
      );
      await carregar();
      await onChanged?.();
    } catch (e: unknown) {
      // O índice único da tabela é (cliente, UF, cidade) — a mensagem crua não
      // ajuda ninguém.
      const msg = e instanceof Error ? e.message : String(e ?? "");
      toast.error(
        msg.includes("uq_qa_end_anteriores")
          ? "Esse estado e cidade já estão na lista."
          : `Não foi possível salvar: ${msg || "erro desconhecido"}`,
      );
    } finally {
      setSalvando(false);
    }
  };

  const doSistema = doBanco.filter((l) => l.origem === "sistema");

  const chip =
    respostaBanco === null ? (
      <QAStatusChip label="Não respondido" tone="warn" />
    ) : respostaBanco ? (
      <QAStatusChip label="Sempre no mesmo endereço" tone="ok" />
    ) : (
      <QAStatusChip
        label={`${estadosDistintos(doBanco.map((l) => ({ uf: l.uf, cidade: l.cidade || "" })), ufAtual).length} estado(s) anterior(es)`}
        tone={doBanco.length > 0 ? "ok" : "warn"}
      />
    );

  return (
    <QAOperationalSection
      icon={MapPin}
      title="Residência nos últimos 5 anos"
      status={chip}
    >
      <QAInfoCard padding="md">
        {carregando ? (
          <div className="flex items-center gap-2 py-4 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] leading-snug text-slate-600">
              O SINARM e o SIGMA exigem certidão de antecedentes de{" "}
              <strong>cada estado</strong> onde o cliente morou nos últimos cinco
              anos. O cliente responde isso no checklist, depois de enviar o
              comprovante de endereço — aqui a equipe lança ou corrige quando
              precisa cumprir a exigência por ele.
            </p>
            <p className="text-[11px] leading-snug text-slate-500">
              Vale para Posse, Concessão de CR e Autorização de Compra CAC. A
              Autorização de compra / Posse da Polícia Federal usa só o endereço
              atual — nela nada é criado, mesmo que a lista abaixo seja
              preenchida.
            </p>

            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Morou sempre no endereço do comprovante?
              </div>
              <div className="flex gap-2">
                {([true, false] as const).map((v) => {
                  const ativo = resposta === v;
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setResposta(v)}
                      className={`h-9 flex-1 rounded-md border text-[12px] font-bold uppercase tracking-wider transition-colors ${
                        ativo
                          ? "border-[#7A1F2B] bg-[#7A1F2B] text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-[#7A1F2B]"
                      }`}
                    >
                      {v ? "Sim, sempre o mesmo" : "Não, morou em outro estado"}
                    </button>
                  );
                })}
              </div>
            </div>

            {resposta === false && (
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                  Onde morou nos últimos 5 anos
                  {ufAtual ? ` — hoje mora em ${ufAtual.toUpperCase()}` : ""}
                </div>
                <EnderecosAnterioresLista
                  valor={lista}
                  onChange={setLista}
                  ufAtual={ufAtual}
                  disabled={salvando}
                />
                {doSistema.length > 0 && (
                  <p className="text-[10px] leading-snug text-amber-900/80">
                    {doSistema.map((l) => l.uf).join(", ")} {doSistema.length === 1 ? "foi registrado" : "foram registrados"}{" "}
                    automaticamente quando o endereço do cadastro mudou. Só tire
                    da lista se a mudança não aconteceu de fato.
                  </p>
                )}
              </div>
            )}

            {resposta === true && doBanco.some((l) => l.origem === "cliente") && (
              <QAAlertBlock tone="warn" title="Isto retira estados da lista">
                Marcar "sempre o mesmo" retira da lista os estados que foram
                <strong> declarados</strong>. Os que o sistema registrou numa
                mudança de endereço real permanecem.
              </QAAlertBlock>
            )}

            {resposta === false && estados.length > 0 && (
              <p className="text-[11px] leading-snug text-slate-600">
                Ao salvar, os processos deste cliente que ainda montam dossiê
                ganham o bloco de certidões de <strong>{estados.join(", ")}</strong>,
                separado das certidões do estado atual. Processo já protocolado
                não é tocado.
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                disabled={!sujo || salvando}
                onClick={() => void salvar()}
                className="bg-[#7A1F2B] hover:bg-[#5f1822]"
              >
                {salvando ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Salvar
              </Button>
              {sujo && !salvando && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void carregar()}
                  className="text-slate-600"
                >
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  Desfazer
                </Button>
              )}
            </div>
          </div>
        )}
      </QAInfoCard>
    </QAOperationalSection>
  );
}
