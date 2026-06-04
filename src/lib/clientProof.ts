/**
 * Captures client proof data for contract clause 17.3.
 * Collects IP, geolocation, user agent, and session ID.
 */

export interface ClientProofData {
  ip_contratante: string;
  geo_contratante: string;
  user_agent: string;
  session_id: string;
  data_hora_contratacao: string;
}

const FALLBACK = "Não capturado";

/**
 * Generates or retrieves a persistent session ID for the contracting flow.
 */
function getSessionId(): string {
  const key = "wmti_contract_session_id";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

/**
 * Fetches the client's public IP address.
 */
async function fetchIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return data.ip || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * Fetches approximate geolocation based on IP.
 */
async function fetchGeo(ip: string): Promise<string> {
  if (ip === FALLBACK) return FALLBACK;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.city && data.region) {
      return `${data.city}, ${data.region}, ${data.country_name || "BR"}`;
    }
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * Captures all proof data for the contract.
 * Returns immediately available data + async IP/geo.
 */
export async function captureClientProof(): Promise<ClientProofData> {
  const now = new Date();
  const data_hora = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const user_agent = navigator.userAgent || FALLBACK;
  const session_id = getSessionId();

  const ip = await fetchIp();
  const geo = await fetchGeo(ip);

  return {
    ip_contratante: ip,
    geo_contratante: geo,
    user_agent,
    session_id,
    data_hora_contratacao: data_hora,
  };
}
