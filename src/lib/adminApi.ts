import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_SESSION_EXPIRED_MESSAGE,
  clearAdminSession,
  requireAdminToken,
} from "@/lib/adminSession";

export type QueryFilter = {
  column: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "or";
  value: unknown;
};

export type AdminQuery = {
  table: string;
  select?: string;
  filters?: QueryFilter[];
  order?: { column: string; ascending: boolean };
  range?: { from: number; to: number };
  count?: boolean;
  limit?: number;
  single?: boolean;
};

export type AdminQueryResult = {
  data: unknown;
  error: string | null;
  count: number | null;
};

function isUnauthorizedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unauthorized|401/i.test(message);
}

export async function adminQuery(queries: AdminQuery[]): Promise<AdminQueryResult[]> {
  const token = requireAdminToken();

  const { data, error } = await supabase.functions.invoke("admin-data", {
    body: { queries },
    headers: { "x-admin-token": token },
  });

  if (error) {
    if (isUnauthorizedError(error)) {
      clearAdminSession("unauthorized");
      throw new Error(ADMIN_SESSION_EXPIRED_MESSAGE);
    }
    throw new Error(error.message || "Admin query failed");
  }

  if (data?.error === "Unauthorized") {
    clearAdminSession("unauthorized");
    throw new Error(ADMIN_SESSION_EXPIRED_MESSAGE);
  }
  if (data?.error) throw new Error(data.error);

  return data.results;
}

export async function adminQuerySingle(query: AdminQuery): Promise<AdminQueryResult> {
  const results = await adminQuery([query]);
  return results[0];
}
