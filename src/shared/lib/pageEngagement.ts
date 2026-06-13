import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PageEngagementCounts = {
  views: number;
  shares: number;
};

type UsePageEngagementArgs = {
  pageKey: string;
  pageType?: string;
  title?: string;
  enabled?: boolean;
};

interface EngagementRow {
  view_count: number;
  share_count: number;
}

const EMPTY_COUNTS: PageEngagementCounts = {
  views: 0,
  shares: 0,
};

function sessionKey(pageKey: string) {
  return `qa-page-viewed:${pageKey}`;
}

async function fetchCounts(pageKey: string): Promise<PageEngagementCounts> {
  const { data, error } = (await supabase
    .from("qa_page_engagement_counters" as any)
    .select("view_count, share_count")
    .eq("page_key", pageKey)
    .maybeSingle()) as unknown as { data: EngagementRow | null; error: any };

  if (error || !data) return EMPTY_COUNTS;

  return {
    views: Number(data.view_count ?? 0),
    shares: Number(data.share_count ?? 0),
  };
}

async function incrementMetric(
  pageKey: string,
  metric: "view" | "share",
  pageType: string,
  title?: string,
): Promise<PageEngagementCounts> {
  const { data, error } = (await (supabase.rpc as any)("qa_increment_page_engagement", {
    p_page_key: pageKey,
    p_metric: metric,
    p_page_type: pageType,
    p_title: title ?? null,
  })) as unknown as { data: EngagementRow[] | EngagementRow | null; error: any };

  if (error) return fetchCounts(pageKey);

  const row = Array.isArray(data) ? data[0] : data;

  return {
    views: Number(row?.view_count ?? 0),
    shares: Number(row?.share_count ?? 0),
  };
}

export function usePageEngagement({
  pageKey,
  pageType = "service",
  title,
  enabled = true,
}: UsePageEngagementArgs) {
  const [counts, setCounts] = useState<PageEngagementCounts>(EMPTY_COUNTS);

  useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY_COUNTS);
      return;
    }

    let active = true;

    async function load() {
      try {
        const alreadyViewed =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(sessionKey(pageKey)) === "1";

        const nextCounts = alreadyViewed
          ? await fetchCounts(pageKey)
          : await incrementMetric(pageKey, "view", pageType, title);

        if (!alreadyViewed && typeof window !== "undefined") {
          window.sessionStorage.setItem(sessionKey(pageKey), "1");
        }

        if (active) setCounts(nextCounts);
      } catch {
        if (active) setCounts(EMPTY_COUNTS);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [enabled, pageKey, pageType, title]);

  const registerShare = useCallback(async () => {
    if (!enabled) return;
    const nextCounts = await incrementMetric(pageKey, "share", pageType, title);
    setCounts(nextCounts);
  }, [enabled, pageKey, pageType, title]);

  return {
    counts,
    registerShare,
  };
}
