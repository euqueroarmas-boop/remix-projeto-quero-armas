import { supabase } from "@/integrations/supabase/client";
import type { WorkbenchWeapon } from "./Workbench";

/**
 * Declarações persistentes "Não possuo mais a GT".
 *
 * Fonte da verdade: tabela `qa_arma_gt_declaracoes` (RLS por cliente/staff).
 * NÃO usar localStorage como fonte primária — apenas a tabela é consultada.
 */

export interface GtDeclaracaoRow {
  id: number;
  qa_cliente_id: number;
  weapon_key: string;
  arma_manual_id: number | null;
  numero_serie: string | null;
  numero_sigma: string | null;
  numero_sinarm: string | null;
  marca: string | null;
  modelo: string | null;
  calibre: string | null;
  status: "nao_possuo" | "revertida";
  declarado_em: string;
  revertido_em: string | null;
}

export const weaponKeyOf = (w: Pick<WorkbenchWeapon, "source" | "id">) =>
  `${w.source}-${w.id}`;

export async function listGtDeclaracoes(clienteId: number) {
  const { data, error } = await supabase
    .from("qa_arma_gt_declaracoes" as any)
    .select("*")
    .eq("qa_cliente_id", clienteId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[gtDeclaracoes] listar falhou:", error.message);
    return [] as GtDeclaracaoRow[];
  }
  return ((data as any[]) || []) as GtDeclaracaoRow[];
}

export async function declararNaoPossuoGt(params: {
  clienteId: number;
  weapon: WorkbenchWeapon;
  origem?: string;
}) {
  const { clienteId, weapon, origem = "area_cliente" } = params;
  const { data: { user } } = await supabase.auth.getUser();
  const armaManualId =
    typeof weapon.id === "string" && weapon.id.startsWith("doc-")
      ? null
      : (typeof weapon.id === "number" ? null : null); // armas físicas vêm de qa_crafs, não de armas_manual.

  const payload: any = {
    qa_cliente_id: clienteId,
    weapon_key: weaponKeyOf(weapon),
    arma_manual_id: armaManualId,
    numero_serie: weapon.numero_arma || null,
    numero_sigma: weapon.numero_sigma || null,
    numero_sinarm: null,
    marca: null,
    modelo: weapon.nome_arma || null,
    calibre: null,
    status: "nao_possuo",
    declarado_em: new Date().toISOString(),
    declarado_por: user?.id || null,
    revertido_em: null,
    revertido_por: null,
    origem,
    metadados_json: {
      source: weapon.source,
      sistema: weapon.sistema || null,
      finalidade: weapon.finalidade || null,
      catalogo_id: weapon.catalogo_id || null,
    },
  };

  const { error } = await supabase
    .from("qa_arma_gt_declaracoes" as any)
    .upsert(payload, { onConflict: "qa_cliente_id,weapon_key" });
  if (error) throw error;
}

export async function reverterDeclaracaoGt(params: {
  clienteId: number;
  weapon: WorkbenchWeapon;
}) {
  const { clienteId, weapon } = params;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("qa_arma_gt_declaracoes" as any)
    .update({
      status: "revertida",
      revertido_em: new Date().toISOString(),
      revertido_por: user?.id || null,
    })
    .eq("qa_cliente_id", clienteId)
    .eq("weapon_key", weaponKeyOf(weapon));
  if (error) throw error;
}