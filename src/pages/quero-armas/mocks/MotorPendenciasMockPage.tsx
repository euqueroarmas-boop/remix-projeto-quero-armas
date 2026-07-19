import { useMemo, useState } from "react";
import {
  useCredenciadosPsico,
  type BuscarParams,
} from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosPsico";
import {
  useCredenciadosIAT,
  type BuscarIATParams,
} from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosIAT";

/**
 * MOCKUP FUNCIONAL — Motor de Pendências (Quero Armas)
 *
 * Objetivo: aprovar visual/UX antes de plugar no clique real das pendências.
 *
 * ▶ Reutiliza obrigatoriamente (sem duplicar cérebro):
 *    - Busca de instrutores credenciados: useCredenciadosIAT
 *    - Busca de psicólogos credenciados: useCredenciadosPsico
 *    - (Quando integrado em produção) o Hub Documental já responsável por
 *      leitura de IA, extração, aprovação/reprovação, logs e métricas.
 *
 * Este arquivo NÃO cria endpoint, tabela, cérebro de IA, parser ou fluxo de
 * aprovação novo. É uma camada visual/contextual sobre o Hub Documental.
 *
 * Rota: /mocks/motor-pendencias
 */

// ---------------------------------------------------------------------------
// Camada de configuração canônica (evita texto fixo espalhado)
// ---------------------------------------------------------------------------

type Profissional = "psicologo" | "instrutor" | null;

type RequirementConfig = {
  titulo: string;
  subtitulo: string;
  categoria: string;
  profissional: Profissional;
  ctaBusca: string | null;
  tituloBusca: string | null;
  textoBusca: string | null;
  baseLegal: string;
  instrucaoEmissao?: string;
  validade?: string;
};

const pendingRequirementConfig: Record<string, RequirementConfig> = {
  laudo_psicologico: {
    titulo: "Laudo Psicológico",
    subtitulo: "Psicólogo credenciado pela Polícia Federal",
    categoria: "Exames Técnicos",
    profissional: "psicologo",
    ctaBusca: "Buscar psicólogos",
    tituloBusca: "Psicólogos credenciados pela PF próximos de {cidade}/{uf}",
    textoBusca:
      "Use a busca oficial integrada para localizar psicólogos credenciados pela Polícia Federal próximos ao endereço cadastrado.",
    baseLegal: "Lei 10.826/2003 · Decreto 11.615/2023 · IN DG/PF 201 · IN DG/PF 311",
    validade: "12 meses a partir da emissão.",
  },
  atestado_capacidade_tecnica: {
    titulo: "Atestado de Capacidade Técnica",
    subtitulo: "Instrutor de tiro credenciado pela Polícia Federal",
    categoria: "Exames Técnicos",
    profissional: "instrutor",
    ctaBusca: "Buscar instrutores",
    tituloBusca: "Instrutores credenciados pela PF próximos de {cidade}/{uf}",
    textoBusca:
      "Use a busca oficial integrada para localizar instrutores de tiro credenciados pela Polícia Federal próximos ao endereço cadastrado.",
    baseLegal:
      "Lei 10.826/2003 · Decreto 11.615/2023 · Decreto 12.345/2024 · IN DG/PF 201 · IN DG/PF 311",
    validade: "12 meses a partir da emissão.",
  },
  certidao_criminal: {
    titulo: "Certidão Criminal",
    subtitulo: "Documento exigido para comprovação de antecedentes",
    categoria: "Documentos Obrigatórios",
    profissional: null,
    ctaBusca: null,
    tituloBusca: null,
    textoBusca: null,
    baseLegal: "Lei 10.826/2003 · IN DG/PF 201",
    instrucaoEmissao:
      "Emita a Certidão Criminal na Justiça Estadual, Federal, Militar Estadual e Militar da União da sua comarca. As certidões podem ser obtidas online pelos portais dos respectivos tribunais.",
    validade: "90 dias a partir da emissão.",
  },
};

// ---------------------------------------------------------------------------
// Mock de dados de entrada (formato canônico esperado pelo motor)
// ---------------------------------------------------------------------------

type PendenciaInput = {
  id: string;
  configKey: keyof typeof pendingRequirementConfig;
  status: "pendente" | "vencido" | "incompleto" | "em_analise" | "aprovado" | "reprovado";
  processo: { id: string; tipo: string; numero: string; etapa: string };
  cliente: {
    id: string;
    nome: string;
    cep: string;
    bairro: string;
    cidade: string;
    estado: string;
    uf: string;
  };
  documento: {
    id: string | null;
    arquivoUrl: string | null;
    nomeArquivo?: string | null;
    statusAnalise: string | null;
    dadosExtraidos: Record<string, string> | null;
    logs: { at: string; nivel: string; msg: string }[] | null;
    metricas: Record<string, string | number> | null;
  };
};

const clienteBase = {
  id: "189",
  nome: "WILLIAN RODRIGUES DA SILVA MASSAROTO",
  cep: "12308-320",
  bairro: "JARDIM CALIFÓRNIA",
  cidade: "JACAREÍ",
  estado: "SÃO PAULO",
  uf: "SP",
};

const pendenciasMock: PendenciaInput[] = [
  {
    id: "pend-atc-01",
    configKey: "atestado_capacidade_tecnica",
    status: "vencido",
    processo: {
      id: "proc-4501",
      tipo: "AQUISIÇÃO / REGISTRO / POSSE DE ARMA DE FOGO",
      numero: "9000147",
      etapa: "MONTAGEM DE PASTA",
    },
    cliente: clienteBase,
    documento: {
      id: "doc-atc-2025",
      arquivoUrl: null,
      nomeArquivo: "atestado_capacidade_tecnica_2025.pdf",
      statusAnalise: "vencido",
      dadosExtraidos: {
        "Nome do titular": "WILLIAN R. S. MASSAROTO",
        Instrutor: "CARLOS EDUARDO M. — CR PF SP-12345",
        "Data de emissão": "19/03/2025",
        "Validade calculada": "19/03/2026 (VENCIDO há 122 dias)",
        Modalidade: "Pistola / Revólver",
      },
      logs: [
        { at: "19/03/2025 14:22", nivel: "info", msg: "Documento recebido via portal do cliente." },
        { at: "19/03/2025 14:22", nivel: "info", msg: "Extração IA concluída (Gemini Flash Vision)." },
        { at: "19/03/2025 14:23", nivel: "ok", msg: "Titular confere com cliente 189." },
        { at: "19/03/2025 14:23", nivel: "ok", msg: "Instrutor validado contra base IAT credenciados PF." },
        { at: "19/07/2026 07:00", nivel: "warn", msg: "Validade expirou. Renovação obrigatória." },
      ],
      metricas: {
        "Confiança OCR": "0.97",
        "Campos identificados": "12 / 12",
        "Tempo de análise": "3.4s",
      },
    },
  },
  {
    id: "pend-laudo-01",
    configKey: "laudo_psicologico",
    status: "vencido",
    processo: {
      id: "proc-4501",
      tipo: "AQUISIÇÃO / REGISTRO / POSSE DE ARMA DE FOGO",
      numero: "9000147",
      etapa: "EXAMES OBRIGATÓRIOS",
    },
    cliente: clienteBase,
    documento: {
      id: "doc-laudo-2025",
      arquivoUrl: null,
      nomeArquivo: "laudo_psicologico_2025.pdf",
      statusAnalise: "vencido",
      dadosExtraidos: {
        "Nome do titular": "WILLIAN RODRIGUES DA SILVA MASSAROTO",
        Psicólogo: "DRA. FERNANDA T. — CRP 06/12345 — CR PF SP-9876",
        "Data de emissão": "03/03/2025",
        "Validade calculada": "03/03/2026 (VENCIDO há 137 dias)",
        Conclusão: "APTO",
      },
      logs: [
        { at: "03/03/2025 09:11", nivel: "info", msg: "Documento recebido via portal do cliente." },
        { at: "03/03/2025 09:12", nivel: "ok", msg: "Psicólogo validado contra base PF credenciados." },
        { at: "19/07/2026 07:00", nivel: "warn", msg: "Validade expirou. Renovação obrigatória." },
      ],
      metricas: {
        "Confiança OCR": "0.98",
        "Campos identificados": "10 / 10",
        "Tempo de análise": "2.9s",
      },
    },
  },
  {
    id: "pend-crim-01",
    configKey: "certidao_criminal",
    status: "pendente",
    processo: {
      id: "proc-4501",
      tipo: "AQUISIÇÃO / REGISTRO / POSSE DE ARMA DE FOGO",
      numero: "9000147",
      etapa: "MONTAGEM DE PASTA",
    },
    cliente: clienteBase,
    documento: {
      id: null,
      arquivoUrl: null,
      statusAnalise: null,
      dadosExtraidos: null,
      logs: null,
      metricas: null,
    },
  },
];

// ---------------------------------------------------------------------------
// Utilitários visuais
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<PendenciaInput["status"], { label: string; bg: string; fg: string }> = {
  pendente: { label: "PENDENTE", bg: "#f4e6a8", fg: "#5a4300" },
  vencido: { label: "VENCIDO", bg: "#f5d4d4", fg: "#7A1F2B" },
  incompleto: { label: "INCOMPLETO", bg: "#f4e6a8", fg: "#5a4300" },
  em_analise: { label: "EM ANÁLISE", bg: "#d9e3f0", fg: "#1c3a5e" },
  aprovado: { label: "VÁLIDO", bg: "#d5ecd8", fg: "#1e5128" },
  reprovado: { label: "REPROVADO", bg: "#f5d4d4", fg: "#7A1F2B" },
};

function StatusBadge({ status }: { status: PendenciaInput["status"] }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: "3px 10px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Painel de busca de profissional credenciado
// ---------------------------------------------------------------------------

function BuscaProfissional({
  tipo,
  cliente,
  config,
}: {
  tipo: "psicologo" | "instrutor";
  cliente: PendenciaInput["cliente"];
  config: RequirementConfig;
}) {
  const [cep, setCep] = useState(cliente.cep);
  const [cidade, setCidade] = useState(cliente.cidade);
  const [uf, setUf] = useState(cliente.uf);
  const [busca, setBusca] = useState("");
  const [raio, setRaio] = useState(25);
  const [ativo, setAtivo] = useState(true);

  const paramsPsico: BuscarParams | null = useMemo(
    () =>
      ativo && tipo === "psicologo"
        ? { tipo: "psicologo", cep: cep.replace(/\D/g, ""), uf, cidade, busca, raio_km: raio, limit: 10 }
        : null,
    [ativo, tipo, cep, uf, cidade, busca, raio],
  );

  const paramsIat: BuscarIATParams | null = useMemo(
    () =>
      ativo && tipo === "instrutor"
        ? { cep: cep.replace(/\D/g, ""), uf, cidade, busca, raio_km: raio, limit: 10 }
        : null,
    [ativo, tipo, cep, uf, cidade, busca, raio],
  );

  const psico = useCredenciadosPsico(paramsPsico);
  const iat = useCredenciadosIAT(paramsIat);

  const loading = tipo === "psicologo" ? psico.loading : iat.loading;
  const error = tipo === "psicologo" ? psico.error : iat.error;
  const results =
    tipo === "psicologo"
      ? psico.results.map((r) => ({
          id: r.id,
          nome: r.nome,
          credencial: r.registro || "CR PF —",
          endereco: r.endereco || "",
          cidade: r.cidade,
          uf: r.uf,
          telefone: (r.telefones || [])[0] || "",
          email: (r.emails || [])[0] || "",
          distancia: r.distancia_km ?? null,
          lat: r.latitude,
          lng: r.longitude,
        }))
      : (iat.data?.results || []).map((r) => ({
          id: r.id,
          nome: r.nome,
          credencial: r.portaria || "PORTARIA PF —",
          endereco: r.endereco || "",
          cidade: (r.endereco || "").split("/")[0] || cidade,
          uf: r.uf,
          telefone: r.telefone || "",
          email: r.email || "",
          distancia: r.distancia_km ?? null,
          lat: r.lat,
          lng: r.lng,
        }));

  const tituloBusca = (config.tituloBusca || "")
    .replace("{cidade}", cliente.cidade)
    .replace("{uf}", cliente.uf);

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e2da",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#7A1F2B" }}>
            PROFISSIONAIS CREDENCIADOS · PF
          </div>
          <h3
            style={{
              fontFamily: "'Oswald','Barlow Condensed',sans-serif",
              fontSize: 22,
              margin: "4px 0 0",
              color: "#0A0A0A",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {tituloBusca}
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", maxWidth: 720 }}>
            {config.textoBusca}
          </p>
        </div>
        <button
          onClick={() => setAtivo((v) => !v)}
          style={{
            background: ativo ? "#0A0A0A" : "#7A1F2B",
            color: "#fff",
            border: 0,
            padding: "10px 16px",
            fontSize: 12,
            letterSpacing: "0.08em",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {ativo ? "ATUALIZAR BUSCA" : config.ctaBusca?.toUpperCase() || "BUSCAR"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        <Field label="CEP" value={cep} onChange={setCep} placeholder="00000-000" />
        <Field label="CIDADE" value={cidade} onChange={setCidade} />
        <Field label="UF" value={uf} onChange={(v) => setUf(v.toUpperCase().slice(0, 2))} />
        <Field label="NOME / BAIRRO" value={busca} onChange={setBusca} />
        <Field
          label={`RAIO (${raio} km)`}
          value={String(raio)}
          onChange={(v) => setRaio(Number(v) || 25)}
          placeholder="25"
        />
      </div>

      <div style={{ marginTop: 20 }}>
        {loading && <div style={{ fontSize: 13, color: "#666" }}>Buscando credenciados…</div>}
        {error && <div style={{ fontSize: 13, color: "#7A1F2B" }}>Erro: {error}</div>}
        {!loading && !error && results.length === 0 && (
          <div style={{ fontSize: 13, color: "#666" }}>
            Nenhum credenciado encontrado no raio de {raio} km. Aumente o raio ou refine os filtros.
          </div>
        )}
        {results.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {results.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  padding: 14,
                  border: "1px solid #ececec",
                  background: "#fafaf7",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0A0A0A", textTransform: "uppercase" }}>
                    {r.nome}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{r.credencial}</div>
                  <div style={{ fontSize: 12, color: "#333", marginTop: 6 }}>
                    {r.endereco || "Endereço não informado"}
                    {r.cidade ? ` — ${r.cidade}/${r.uf}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#333", marginTop: 4 }}>
                    {r.telefone && <span style={{ marginRight: 12 }}>☎ {r.telefone}</span>}
                    {r.email && <span>✉ {r.email}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {r.distancia != null && (
                    <span
                      style={{
                        background: "#0A0A0A",
                        color: "#fff",
                        padding: "2px 8px",
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        fontWeight: 700,
                      }}
                    >
                      {r.distancia.toFixed(1)} km
                    </span>
                  )}
                  {r.lat && r.lng && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        color: "#7A1F2B",
                        fontWeight: 700,
                        textDecoration: "none",
                        letterSpacing: "0.06em",
                      }}
                    >
                      ABRIR NO MAPA →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#555" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          marginTop: 4,
          width: "100%",
          padding: "8px 10px",
          border: "1px solid #d6d3cc",
          background: "#fff",
          fontSize: 13,
          textTransform: "uppercase",
          fontFamily: "inherit",
          height: 36,
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Painéis reutilizando "estrutura" do Hub Documental (visualização)
// ---------------------------------------------------------------------------

function PainelDocumento({ p }: { p: PendenciaInput }) {
  return (
    <section style={{ background: "#fff", border: "1px solid #e5e2da", padding: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#7A1F2B" }}>
        DOCUMENTO
      </div>
      <h3
        style={{
          fontFamily: "'Oswald','Barlow Condensed',sans-serif",
          fontSize: 20,
          margin: "4px 0 12px",
          color: "#0A0A0A",
          textTransform: "uppercase",
        }}
      >
        Arquivo enviado
      </h3>
      {p.documento.arquivoUrl ? (
        <div style={{ border: "1px solid #ececec", padding: 20, background: "#fafaf7" }}>
          Pré-visualização do arquivo aqui.
        </div>
      ) : p.documento.nomeArquivo ? (
        <div style={{ border: "1px dashed #d6d3cc", padding: 20, background: "#fafaf7", fontSize: 13, color: "#333" }}>
          📄 {p.documento.nomeArquivo} <br />
          <span style={{ fontSize: 11, color: "#666" }}>
            (Pré-visualização virá do fluxo real do Hub Documental — sem duplicação.)
          </span>
        </div>
      ) : (
        <div style={{ border: "1px dashed #d6d3cc", padding: 24, background: "#fafaf7", textAlign: "center", color: "#666", fontSize: 13 }}>
          Nenhum arquivo enviado ainda.
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          style={{
            background: "#7A1F2B",
            color: "#fff",
            border: 0,
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          {p.documento.arquivoUrl || p.documento.nomeArquivo ? "SUBSTITUIR DOCUMENTO" : "ENVIAR DOCUMENTO"}
        </button>
        <button
          style={{
            background: "transparent",
            color: "#0A0A0A",
            border: "1px solid #0A0A0A",
            padding: "10px 16px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          HISTÓRICO
        </button>
      </div>
    </section>
  );
}

function PainelAnalise({ p }: { p: PendenciaInput }) {
  const semAnalise = !p.documento.statusAnalise;
  return (
    <section style={{ background: "#fff", border: "1px solid #e5e2da", padding: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#7A1F2B" }}>
        ANÁLISE · HUB DOCUMENTAL
      </div>
      <h3
        style={{
          fontFamily: "'Oswald','Barlow Condensed',sans-serif",
          fontSize: 20,
          margin: "4px 0 12px",
          color: "#0A0A0A",
          textTransform: "uppercase",
        }}
      >
        Resultado da IA
      </h3>

      {semAnalise ? (
        <div style={{ fontSize: 13, color: "#666" }}>
          Nenhuma análise disponível. Envie o documento para acionar a leitura automática do Hub Documental
          (mesmo modelo de IA, mesmos logs, mesmas métricas).
        </div>
      ) : (
        <>
          {p.documento.dadosExtraidos && (
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, color: "#555", marginBottom: 6 }}>
                CAMPOS EXTRAÍDOS
              </div>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(p.documento.dadosExtraidos).map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid #f0eee8" }}>
                      <td style={{ padding: "6px 0", color: "#666", width: "40%" }}>{k}</td>
                      <td style={{ padding: "6px 0", color: "#0A0A0A", fontWeight: 600 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.documento.metricas && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, color: "#555", marginBottom: 6 }}>
                MÉTRICAS
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(p.documento.metricas).map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      background: "#f5f4ef",
                      border: "1px solid #e5e2da",
                      padding: "4px 10px",
                      fontSize: 12,
                      color: "#333",
                    }}
                  >
                    <strong>{k}:</strong> {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.documento.logs && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, color: "#555", marginBottom: 6 }}>
                LOGS
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
                {p.documento.logs.map((l, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#333", fontFamily: "monospace" }}>
                    <span style={{ color: "#888" }}>{l.at}</span>{" "}
                    <span
                      style={{
                        color:
                          l.nivel === "warn" ? "#7A1F2B" : l.nivel === "ok" ? "#1e5128" : "#1c3a5e",
                        fontWeight: 700,
                      }}
                    >
                      [{l.nivel.toUpperCase()}]
                    </span>{" "}
                    {l.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Motor de Pendências (tela/modal principal)
// ---------------------------------------------------------------------------

function MotorPendencias({ pendencia }: { pendencia: PendenciaInput }) {
  const cfg = pendingRequirementConfig[pendencia.configKey];
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Cabeçalho */}
      <header
        style={{
          background: "#0A0A0A",
          color: "#fff",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.14em", opacity: 0.7 }}>
          {cfg.categoria.toUpperCase()} · PROCESSO {pendencia.processo.numero} · {pendencia.processo.etapa}
        </div>
        <h1
          style={{
            fontFamily: "'Oswald','Barlow Condensed',sans-serif",
            fontSize: 34,
            margin: "6px 0 4px",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {cfg.titulo}
        </h1>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{cfg.subtitulo}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <StatusBadge status={pendencia.status} />
          <span style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.08em" }}>
            {pendencia.processo.tipo}
          </span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 10, letterSpacing: "0.04em" }}>
          BASE LEGAL: {cfg.baseLegal}
        </div>
      </header>

      {/* Documento + Análise */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <PainelDocumento p={pendencia} />
        <PainelAnalise p={pendencia} />
      </div>

      {/* Ação contextual */}
      {cfg.profissional ? (
        <BuscaProfissional tipo={cfg.profissional} cliente={pendencia.cliente} config={cfg} />
      ) : (
        <section style={{ background: "#fff", border: "1px solid #e5e2da", padding: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, color: "#7A1F2B" }}>
            COMO EMITIR
          </div>
          <h3
            style={{
              fontFamily: "'Oswald','Barlow Condensed',sans-serif",
              fontSize: 20,
              margin: "4px 0 8px",
              color: "#0A0A0A",
              textTransform: "uppercase",
            }}
          >
            Instruções de emissão
          </h3>
          <p style={{ fontSize: 13, color: "#333", margin: 0 }}>{cfg.instrucaoEmissao}</p>
          {cfg.validade && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              <strong>Validade:</strong> {cfg.validade}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página do mockup — troca entre as 3 pendências de exemplo
// ---------------------------------------------------------------------------

export default function MotorPendenciasMockPage() {
  const [ativa, setAtiva] = useState<string>(pendenciasMock[0].id);
  const pendencia = pendenciasMock.find((p) => p.id === ativa)!;

  return (
    <div style={{ background: "#f6f5f1", minHeight: "100vh", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 20,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", fontWeight: 700, color: "#7A1F2B" }}>
              MOCKUP FUNCIONAL · APROVAÇÃO
            </div>
            <h1
              style={{
                fontFamily: "'Oswald','Barlow Condensed',sans-serif",
                fontSize: 32,
                margin: "4px 0 0",
                textTransform: "uppercase",
                color: "#0A0A0A",
              }}
            >
              Motor de Pendências
            </h1>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Camada visual/contextual sobre o Hub Documental — mesma IA, mesmos logs, mesmas métricas.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pendenciasMock.map((p) => {
              const cfg = pendingRequirementConfig[p.configKey];
              const on = ativa === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setAtiva(p.id)}
                  style={{
                    background: on ? "#0A0A0A" : "#fff",
                    color: on ? "#fff" : "#0A0A0A",
                    border: "1px solid #0A0A0A",
                    padding: "8px 14px",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {cfg.titulo}
                </button>
              );
            })}
          </div>
        </div>

        <MotorPendencias pendencia={pendencia} />
      </div>
    </div>
  );
}
