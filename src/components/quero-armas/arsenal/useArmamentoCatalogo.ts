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

  /** Pede para a IA identificar a arma do CRAF/GTE e vincular ao catálogo (dedup global). */
  const requestedRef = (typeof window !== "undefined") ? ((window as any).__qaArmaReqs ||= new Set<string>()) : new Set<string>();
  async function resolveCraf(opts: { craf_id?: number | string; gte_id?: number | string; nome_arma?: string | null }) {
    const key = `${opts.craf_id || ""}|${opts.gte_id || ""}|${opts.nome_arma || ""}`.toUpperCase();
    if (!key.trim() || requestedRef.has(key)) return null;
    requestedRef.add(key);
    try {
      const body: any = {};
      if (opts.craf_id) body.craf_id = opts.craf_id;
      else if (opts.gte_id) body.gte_id = opts.gte_id;
      else if (opts.nome_arma) body.nome_arma = opts.nome_arma;
      const { data, error } = await supabase.functions.invoke("qa-resolver-arma-craf", { body });
      if (error) { console.warn("[resolveCraf] erro", error); return null; }
      const cat = (data as any)?.catalog as ArmamentoCatalogo | undefined;
      if (cat) {
        setItems((prev) => {
          const exists = prev.some((p) => p.id === cat.id);
          return exists ? prev.map((p) => (p.id === cat.id ? cat : p)) : [...prev, cat];
        });
        return cat;
      }
    } catch (e) {
      console.warn("[resolveCraf] falhou", e);
    }
    return null;
  }

  /** Lookup direto por id (quando CRAF/GTE já tem catalogo_id vinculado). */
  const byId = useMemo(() => {
    const m = new Map<string, ArmamentoCatalogo>();
    items.forEach((it) => m.set(it.id, it));
    return (id: string | null | undefined) => (id ? m.get(id) || null : null);
  }, [items]);

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

  return { items, loading, match: matcher, byId, resolveCraf };
}
