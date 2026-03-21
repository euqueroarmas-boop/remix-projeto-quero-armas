import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useClientContracts(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("contracts")
      .select("*, quotes(*)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, [customerId]);

  return { contracts: data, loading };
}

export function useClientPayments(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("contracts")
      .select("id, quote_id")
      .eq("customer_id", customerId)
      .then(async ({ data: contracts }) => {
        if (!contracts?.length) { setLoading(false); return; }
        const quoteIds = contracts.map((c) => c.quote_id).filter(Boolean);
        if (!quoteIds.length) { setLoading(false); return; }
        const { data: payments } = await supabase
          .from("payments")
          .select("*")
          .in("quote_id", quoteIds)
          .order("created_at", { ascending: false });
        setData(payments || []);
        setLoading(false);
      });
  }, [customerId]);

  return { payments: data, loading };
}

export function useClientServiceRequests(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("service_requests")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, [customerId]);

  return { requests: data, loading, setRequests: setData };
}

export function useClientEvents(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("client_events")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, [customerId]);

  return { events: data, loading };
}

export function useClientFiscalDocs(customerId: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("fiscal_documents")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .then(({ data: d }) => { setData(d || []); setLoading(false); });
  }, [customerId]);

  return { docs: data, loading };
}
