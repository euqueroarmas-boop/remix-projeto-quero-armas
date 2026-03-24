import { supabase } from "@/integrations/supabase/client";

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

function getAdminToken(): string | null {
  return sessionStorage.getItem("admin_token");
}

export async function adminQuery(queries: AdminQuery[]): Promise<AdminQueryResult[]> {
  const token = getAdminToken();
  if (!token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("admin-data", {
    body: { queries },
    headers: { "x-admin-token": token },
  });

  if (error) throw new Error(error.message || "Admin query failed");
  if (data?.error === "Unauthorized") {
    sessionStorage.removeItem("admin_token");
    window.location.reload();
    throw new Error("Session expired");
  }
  if (data?.error) throw new Error(data.error);

  return data.results;
}

// Convenience for single query
export async function adminQuerySingle(query: AdminQuery): Promise<AdminQueryResult> {
  const results = await adminQuery([query]);
  return results[0];
}
