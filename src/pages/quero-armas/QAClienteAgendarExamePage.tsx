import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCredenciadosPF, type CredenciadoPF } from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosPF";
import { useCredenciadosIAT, type CredenciadoIAT } from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosIAT";
import { AgendarExameList } from "@/components/quero-armas/clientes/AgendarExame/AgendarExameList";
import { INSTRUTOR_PDF_PF } from "@/components/quero-armas/clientes/AgendarExame/instrutorPdfLinks";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function QAClienteAgendarExamePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tipoInicial = (params.get("tipo") === "instrutor_tiro" ? "instrutor_tiro" : "psicologo") as "psicologo" | "instrutor_tiro";
  const [tipo, setTipo] = useState<"psicologo" | "instrutor_tiro">(tipoInicial);
  const [cep, setCep] = useState<string>(params.get("cep") || "");
  const [uf, setUf] = useState<string>(params.get("uf") || "");
  const [raio, setRaio] = useState<number>(50);
  const [incluirVencidos, setIncluirVencidos] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (cep || uf) return;
    (async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) return;
        const { data } = await supabase.from("qa_clientes").select("cep,estado").eq("user_id", user.user.id).maybeSingle();
        if ((data as any)?.cep) setCep(String((data as any).cep));
        else if ((data as any)?.estado) setUf(String((data as any).estado).toUpperCase());
      } catch { /* noop */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cepLimpo = cep.replace(/\D/g, "");
  const cepValido = cepLimpo.length === 8;
  const isInstrutor = tipo === "instrutor_tiro";

  const psicoParams = useMemo(() => isInstrutor ? null : ({
    tipo: "psicologo" as const, cep: cepLimpo || undefined, uf: !cepLimpo && uf ? uf : undefined,
    raio_km: raio, limit: 50, incluir_vencidos: incluirVencidos,
  }), [isInstrutor, cepLimpo, uf, raio, incluirVencidos]);
  const iatParams = useMemo(() => (isInstrutor && (cepValido || uf)) ? ({
    cep: cepValido ? cepLimpo : undefined, uf: !cepValido && uf ? uf : undefined, raio_km: raio, limit: 100,
  }) : null, [isInstrutor, cepValido, cepLimpo, uf, raio]);

  const psico = useCredenciadosPF(psicoParams as any);
  const iat = useCredenciadosIAT(iatParams);

  const loading = isInstrutor ? iat.loading : psico.loading;
  const error = isInstrutor ? iat.error : psico.error;
  const origin = isInstrutor ? iat.data?.origin || null : psico.origin;
  const ufResolved = (origin?.uf || uf || iat.data?.uf || "").toUpperCase();
  const iatMode = iat.data?.mode || null;
  const iatTemEnderecos = iat.data?.tem_enderecos ?? false;
  const pdfHref = isInstrutor && ufResolved ? INSTRUTOR_PDF_PF[ufResolved] : null;
  const foraDoRaio = isInstrutor ? Boolean(iat.data?.fora_do_raio) : psico.foraDoRaio;
  const distanciaMaisProximo = isInstrutor
    ? iat.data?.distancia_mais_proximo ?? null
    : psico.distanciaMaisProximo;

  const results: CredenciadoPF[] = isInstrutor
    ? (iat.data?.results || []).map((r: CredenciadoIAT) => ({
        id: r.id,
        tipo: "instrutor_tiro",
        uf: r.uf,
        cidade: null,
        bairro: r.clube || null,
        nome: r.nome,
        registro: r.portaria ? `Portaria ${r.portaria}` : null,
        endereco: r.endereco,
        telefones: r.telefone ? [r.telefone] : [],
        emails: r.email ? [r.email] : [],
        validade: null,
        validade_label: r.validade || null,
        latitude: r.lat,
        longitude: r.lng,
        source_url: r.fonte_url || pdfHref || "",
        distancia_km: iatMode === "proximity" ? r.distancia_km ?? null : null,
      }))
    : psico.results;

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) => [r.nome, r.bairro, r.cidade, r.endereco].some((v) => (v || "").toLowerCase().includes(q)));
  }, [results, busca]);

  return (
    <main style={{ background: "#f6f5f1", minHeight: "100vh", padding: "32px 20px", fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <button onClick={() => navigate(-1)} style={{ background: "transparent", border: 0, color: "#7A1F2B", fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: ".16em", cursor: "pointer", padding: 0, marginBottom: 12 }}>← VOLTAR</button>
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, color: "#0A0A0A", margin: 0, letterSpacing: ".04em" }}>AGENDAR EXAME — PROFISSIONAIS CREDENCIADOS PF</h1>
        <p style={{ fontSize: 12, color: "#6A6A6A", margin: "6px 0 18px" }}>Lista oficial da Polícia Federal sincronizada diariamente. Selecione o tipo de exame e o sistema mostra os profissionais mais próximos.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["psicologo","instrutor_tiro"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)} style={{
              flex: 1, padding: "12px 14px", border: "1px solid " + (tipo === t ? "#7A1F2B" : "#d6d6d4"),
              background: tipo === t ? "#7A1F2B" : "#fff", color: tipo === t ? "#fff" : "#0A0A0A",
              fontFamily: "Oswald, sans-serif", fontSize: 12, letterSpacing: ".14em", cursor: "pointer", borderRadius: 3,
            }}>{t === "psicologo" ? "EXAME PSICOLÓGICO" : "EXAME DE TIRO"}</button>
          ))}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e3e3e1", borderRadius: 4, padding: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 14 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 11, letterSpacing: ".12em", color: "#6A6A6A" }}>
            CEP
            <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" style={{ border: "1px solid #d6d6d4", padding: "7px 9px", fontFamily: "inherit", fontSize: 13 }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, letterSpacing: ".12em", color: "#6A6A6A" }}>
            UF (se sem CEP)
            <select value={uf} onChange={(e) => setUf(e.target.value)} style={{ border: "1px solid #d6d6d4", padding: "7px 9px", fontFamily: "inherit", fontSize: 13, background: "#fff" }}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, letterSpacing: ".12em", color: "#6A6A6A" }}>
            RAIO
            <select value={raio} onChange={(e) => setRaio(Number(e.target.value))} style={{ border: "1px solid #d6d6d4", padding: "7px 9px", fontFamily: "inherit", fontSize: 13, background: "#fff" }}>
              {[5,10,25,50,100,99999].map((r) => <option key={r} value={r}>{r >= 99999 ? "Estado todo" : `${r} km`}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, letterSpacing: ".12em", color: "#6A6A6A" }}>
            BUSCAR
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, bairro, cidade…" style={{ border: "1px solid #d6d6d4", padding: "7px 9px", fontFamily: "inherit", fontSize: 13 }} />
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, letterSpacing: ".08em", color: "#6A6A6A", alignSelf: "end" }}>
            <input type="checkbox" checked={incluirVencidos} onChange={(e) => setIncluirVencidos(e.target.checked)} /> Incluir vencidos
          </label>
        </div>

        {origin && <div style={{ fontSize: 11, color: "#6A6A6A", marginBottom: 10 }}>Origem: {origin.cidade}/{origin.uf}</div>}
        {error && <div style={{ color: "#df2727", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {foraDoRaio && (
          <div style={{ background: "#fff8e1", border: "1px solid #f0d893", padding: 10, borderRadius: 4, fontSize: 12, color: "#5a4500", marginBottom: 10 }}>
            Nenhum credenciado dentro de {raio} km{origin?.cidade ? ` de ${origin.cidade}` : ""}.
            Mostrando os mais próximos
            {typeof distanciaMaisProximo === "number"
              ? ` — o mais perto está a ${Math.round(distanciaMaisProximo)} km`
              : ""}.
            {" "}Amplie o raio se quiser.
          </div>
        )}

        <AgendarExameList loading={loading} results={filtered} empty="Nenhum profissional encontrado. Tente ampliar o raio, escolher uma UF, ou consulte diretamente o gov.br/PF." />
        {isInstrutor && (
          <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e3e3e1", padding: 14, borderRadius: 4, fontSize: 12, color: "#303030" }}>
            <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", marginBottom: 6 }}>LISTA OFICIAL PF (PDF)</strong>
            A Polícia Federal publica os instrutores de tiro credenciados em PDFs por UF.
            {pdfHref ? (
              <div style={{ marginTop: 6 }}>
                <a href={pdfHref} target="_blank" rel="noreferrer noopener" style={{ color: "#7A1F2B", fontWeight: 700 }}>
                  Baixar lista atualizada — {ufResolved}
                </a>
              </div>
            ) : (
              <div style={{ marginTop: 6 }}>Informe o CEP ou UF para abrir o PDF do seu estado.</div>
            )}
          </div>
        )}

        <p style={{ fontSize: 11, color: "#6A6A6A", marginTop: 18, textAlign: "center" }}>
          Dados oficiais da Polícia Federal — atualização diária automática.
        </p>
      </div>
    </main>
  );
}