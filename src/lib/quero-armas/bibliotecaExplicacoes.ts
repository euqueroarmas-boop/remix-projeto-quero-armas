// ============================================================================
// bibliotecaExplicacoes.ts
// ----------------------------------------------------------------------------
// FONTE ÚNICA (04/08/2026 — pedido do usuário): o passo a passo que o cliente
// vê é o que está cadastrado em Configurações › Biblioteca de documentos
// (`qa_documentos_biblioteca`). Nada de sincronizar dois lugares: a biblioteca
// manda, e o registro estático em `pendenciasExplicacoes.ts` só existe como
// rede de segurança para códigos ainda não cadastrados (será removido depois).
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import {
  setExplicacoesBiblioteca,
  type ExplicacaoPendencia,
} from "@/lib/quero-armas/pendenciasExplicacoes";

let cache: Promise<Map<string, ExplicacaoPendencia>> | null = null;

async function buscar(): Promise<Map<string, ExplicacaoPendencia>> {
  const mapa = new Map<string, ExplicacaoPendencia>();
  const { data } = await supabase
    .from("qa_documentos_biblioteca" as any)
    .select("codigo, nome, descricao_como_enviar, observacao_cliente, link_emissao")
    .eq("ativo", true);
  for (const row of ((data as any[]) ?? [])) {
    const codigo = String(row?.codigo || "").trim().toLowerCase();
    if (!codigo) continue;
    const passos = String(row?.descricao_como_enviar || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!passos.length) continue;
    mapa.set(codigo, {
      titulo: String(row?.nome || codigo.replace(/_/g, " ")),
      passos,
      observacao: row?.observacao_cliente || undefined,
      siteUrl: row?.link_emissao || undefined,
    });
  }
  setExplicacoesBiblioteca(mapa);
  return mapa;
}

/** Carrega (com cache) o passo a passo cadastrado na biblioteca. */
export function carregarExplicacoesBiblioteca(force = false) {
  if (force || !cache) cache = buscar().catch(() => new Map());
  return cache;
}