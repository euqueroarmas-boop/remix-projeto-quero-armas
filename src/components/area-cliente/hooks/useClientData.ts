import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function logPortalHookError(scope: string, error: unknown) {
  console.error(`[useClientData] ${scope}:`, error);
}

export function useClientContracts(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!customerId) {
        if (active) {
          setData([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const { data: d, error } = await supabase
          .from("contracts")
          .select("*, quotes(*)")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (active) setData(d || []);
      } catch (error) {
        logPortalHookError("contracts", error);
        if (active) setData([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [customerId]);

  return { contracts: data, loading };
}

export function useClientPayments(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!customerId) {
        if (active) {
          setData([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const { data: contracts, error: contractsError } = await supabase
          .from("contracts")
          .select("id, quote_id")
          .eq("customer_id", customerId);

        if (contractsError) throw contractsError;
        if (!contracts?.length) {
          if (active) setData([]);
          return;
        }

        const quoteIds = contracts.map((c) => c.quote_id).filter(Boolean);
        if (!quoteIds.length) {
          if (active) setData([]);
          return;
        }

        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select("*")
          .in("quote_id", quoteIds)
          .order("created_at", { ascending: false });

        if (paymentsError) throw paymentsError;
        if (active) setData(payments || []);
      } catch (error) {
        logPortalHookError("payments", error);
        if (active) setData([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [customerId]);

  return { payments: data, loading };
}

export function useClientServiceRequests(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!customerId) {
        if (active) {
          setData([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const { data: d, error } = await supabase
          .from("service_requests")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (active) setData(d || []);
      } catch (error) {
        logPortalHookError("service_requests", error);
        if (active) setData([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [customerId]);

  return { requests: data, loading, setRequests: setData };
}

export function useClientEvents(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!customerId) {
        if (active) {
          setData([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const { data: d, error } = await supabase
          .from("client_events")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        if (active) setData(d || []);
      } catch (error) {
        logPortalHookError("client_events", error);
        if (active) setData([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [customerId]);

  return { events: data, loading };
}

export function useClientFiscalDocs(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!customerId) {
        if (active) {
          setData([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const { data: d, error } = await supabase
          .from("fiscal_documents")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (active) setData(d || []);
      } catch (error) {
        logPortalHookError("fiscal_documents", error);
        if (active) setData([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [customerId]);

  return { docs: data, loading };
}
