import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyFaviconUrl,
  DEFAULT_QA_FAVICON,
  QA_FAVICON_BRANDING_KEY,
} from "@/lib/quero-armas/favicon";

export default function QAFaviconManager() {
  useEffect(() => {
    let alive = true;

    applyFaviconUrl(DEFAULT_QA_FAVICON);

    supabase
      .from("qa_branding" as any)
      .select("data_url")
      .eq("chave", QA_FAVICON_BRANDING_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        applyFaviconUrl(((data as any)?.data_url as string) || DEFAULT_QA_FAVICON);
      });

    return () => {
      alive = false;
    };
  }, []);

  return null;
}
