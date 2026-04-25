import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { WeaponKind } from "./utils";

export interface ArmamentoCatalogo {
  id: string;
  marca: string;
  modelo: string;
  apelido: string | null;
  tipo: WeaponKind;
  calibre: string;
  capacidade_carregador: number | null;
  peso_gramas: number | null;
  comprimento_cano_mm: number | null;
  alcance_efetivo_m: number | null;
  velocidade_projetil_ms: number | null;
  origem: string | null;
  classificacao_legal: string | null;
  descricao: string | null;
  stat_dano: number | null;
  stat_precisao: number | null;
  stat_alcance: number | null;
  stat_cadencia: number | null;
  stat_mobilidade: number | null;
  stat_controle: number | null;
  search_tokens: string | null;
  imagem: string | null;
  imagem_status: string | null;
}

const NORM = (s: string) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Carrega o catálogo curado uma única vez por sessão. */
export function useArmamentoCatalogo() {
  const [items, setItems] = useState<ArmamentoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("qa_armamentos_catalogo" as any)
        .select("*")
        .eq("ativo", true);
      if (cancel) return;
      if (!error && data) setItems(data as unknown as ArmamentoCatalogo[]);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  /** Pede pra IA gerar uma entrada pendente de revisão (fire-and-forget, dedup). */
  const requestedRef = (typeof window !== "undefined") ? ((window as any).__qaArmaReqs ||= new Set<string>()) : new Set<string>();
  async function autoCreatePending(rawName: string, tipo?: WeaponKind | null, calibre?: string | null) {
    const key = `${rawName}|${tipo || ""}|${calibre || ""}`.toUpperCase();
    if (requestedRef.has(key)) return;
    requestedRef.add(key);
    // Tenta extrair marca + modelo de forma simples ("Taurus G2C 9mm" -> marca/modelo)
    const parts = rawName.trim().split(/\s+/);
    if (parts.length < 2) return;
    const marca = parts[0];
    const modelo = parts.slice(1, 3).join(" ");
    try {
      const { data } = await supabase.functions.invoke("qa-armamento-gerar-ia", {
        body: { marca, modelo, calibre, tipo },
      });
      const d = (data as any)?.data;
      if (!d) return;
      const payload = {
        ...d,
        fonte_dados: "ia_gerado",
        status_revisao: "pendente_revisao",
        search_tokens: `${d.marca} ${d.modelo} ${d.apelido || ""} ${d.calibre || ""}`.toUpperCase(),
      };
      await supabase.from("qa_armamentos_catalogo" as any).insert(payload);
    } catch (e) {
      console.warn("autoCreate falhou", e);
    }
  }

  /** Tenta encontrar o melhor match para um nome livre de arma. */
  const matcher = useMemo(() => {
    const indexed = items.map((it) => ({
      it,
      tokens: NORM(`${it.marca} ${it.modelo} ${it.apelido || ""} ${it.search_tokens || ""}`)
        .split(" ")
        .filter(Boolean),
    }));
    return (rawName: string | null | undefined): ArmamentoCatalogo | null => {
      if (!rawName) return null;
      const blob = NORM(rawName);
      if (!blob) return null;
      const queryTokens = blob.split(" ").filter((t) => t.length >= 2);
      let best: { score: number; it: ArmamentoCatalogo } | null = null;
      for (const { it, tokens } of indexed) {
        let score = 0;
        for (const t of tokens) {
          if (queryTokens.includes(t)) score += t.length >= 4 ? 3 : 2;
          else if (blob.includes(t) && t.length >= 3) score += 1;
        }
        // Bônus se modelo aparecer na string
        if (blob.includes(NORM(it.modelo))) score += 4;
        if (it.apelido && blob.includes(NORM(it.apelido))) score += 4;
        if (best === null || score > best.score) best = { score, it };
      }
      return best && best.score >= 4 ? best.it : null;
    };
  }, [items]);

  return { items, loading, match: matcher, autoCreatePending };
}
