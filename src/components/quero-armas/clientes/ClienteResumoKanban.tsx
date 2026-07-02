import { useEffect, useMemo, useState } from "react";

import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { calcularPrazosProcessuais } from "@/lib/quero-armas/prazosProcessuais";
import { getNomeDocumentoDisplay, getTipoDocumentoMeta } from "@/lib/quero-armas/documentosHubCatalogo";
import { useNavigate } from "react-router-dom";
import { AgendarExameModal } from "./AgendarExame/AgendarExameModal";

// Rótulo canônico do Hub de Documentos para um tipo conhecido.
// Mantemos as 5 frentes alinhadas com o Hub: mesma fonte de verdade.
// Rótulo can\u00f4nico do Hub, mantendo a caixa original (mixed case)
function hubLabel(tipo: string, fallback: string) {
  const meta = getTipoDocumentoMeta(tipo);
  return meta?.label || fallback;
}

interface Props {
  cliente: any;
  vendas: any[];
  itens: any[];
  processos?: any[];
  crafs: any[];
  gtes: any[];
  filiacoes: any[];
  cadastro: any;
  examesAtuais?: any[];
  armasManual?: any[];
  meusDocs?: any[];
  processoDocs?: any[];
  onNavigate: (tab: string) => void;
  onOpenCadastro?: () => void;
  onOpenComprar?: () => void;
  onOpenDocsHub?: () => void;
}

type FrontTone = "bordo" | "amber" | "green";
type FrontItem = { label: string; status: string; tone: "bad" | "warn" | "ok" | "muted"; stack?: boolean };
type Front = { key: string; title: string; count: number; tone: FrontTone; status: "bad" | "warn" | "ok" | "muted"; items: FrontItem[]; navTo: string };
type Urgent = { label: string; sub: string; days: number; navTo: string; ctaLabel: string; frontKey: "arsenal" | "exames" | "filiacao" | "documentos" | "processos"; examTipo?: "psicologo" | "instrutor_tiro" };

const ACTIVE_FINAL_STATUSES = ["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"];

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (!raw) return null;
  let parsed: Date | null = null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (iso) parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (br) parsed = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.floor((parsed.getTime() - today.getTime()) / 86400000);
}

function frontStatus(days: number | null): FrontItem["tone"] {
  if (days === null) return "muted";
  if (days < 0 || days <= 7) return "bad";
  if (days <= 45) return "warn";
  return "ok";
}

function compactStatus(days: number | null, percent?: number | null) {
  if (typeof percent === "number") return `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
  if (days === null) return "—";
  if (days < 0) return `Venc. - ${Math.abs(days)} dias`;
  return `${days} dias`;
}

function shortName(value: string, fallback: string) {
  return String(value || fallback).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

// Title Case pt-BR para nomes de serviço/processo.
// Mantém preposições/artigos em minúsculas (exceto quando é a primeira palavra).
// Também garante espaços em volta de "/" para evitar quebras feias tipo
// "AQUISIÇÃO/REGISTRO/POSSE" empilhado verticalmente.
const LOWER_WORDS = new Set([
  "de", "da", "do", "das", "dos",
  "e", "em", "no", "na", "nos", "nas",
  "para", "por", "a", "o", "as", "os",
]);
function titleCaseServico(value: string, fallback: string): string {
  const raw = shortName(value, fallback);
  const spaced = raw.replace(/\s*\/\s*/g, " / ");
  return spaced
    .split(" ")
    .map((token, idx) => {
      if (token === "/") return "/";
      const lower = token.toLocaleLowerCase("pt-BR");
      if (idx > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

function firstName(cliente: any) {
  const nome = String(cliente?.nome_completo || cliente?.nome || cliente?.name || "WILLIAN").trim();
  return (nome.split(/\s+/)[0] || "WILLIAN").toUpperCase();
}

function serviceProgress(item: any) {
  const marks = [!!item?.data_protocolo, !!item?.numero_processo, !!item?.data_ultima_atualizacao, !!item?.data_deferimento];
  return Math.round((marks.filter(Boolean).length / marks.length) * 100);
}

export default function ClienteResumoKanban({
  cliente,
  itens,
  processos = [],
  crafs,
  gtes,
  filiacoes,
  cadastro,
  examesAtuais = [],
  armasManual = [],
  meusDocs = [],
  processoDocs = [],
  onNavigate,
  onOpenCadastro,
  onOpenComprar,
  onOpenDocsHub,
}: Props) {
  const { map: SERVICO_MAP } = useQAServicosMap();

  // Detecta primeiro acesso vs retorno para alternar a saudação do resumo.
  // Usa localStorage por cliente (chave estável); se não houver id, cai no nome.
  const welcomeKey = `qa_welcomed_${cliente?.id || cliente?.id_legado || cliente?.cpf || firstName(cliente)}`;
  const [isReturning, setIsReturning] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return !!window.localStorage.getItem(welcomeKey); } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem(welcomeKey)) {
        window.localStorage.setItem(welcomeKey, new Date().toISOString());
      }
    } catch { /* ignore */ }
    // Não muda isReturning nesta sessão: só ficará true no próximo login.
  }, [welcomeKey]);
  const greetingTitle = isReturning
    ? `BEM-VINDO DE VOLTA, ${firstName(cliente)}! ESTE É O SEU RESUMO DE TUDO`
    : `BEM-VINDO, ${firstName(cliente)}! ESTE É O RESUMO DE TUDO`;

  const URG_SUB: Record<string, string> = {
    cr: "Certificado de Registro · sem ele toda atividade na PF trava",
    craf: "Sem CRAF vigente o transporte da arma é ilegal",
    gte: "Guia de Tráfego expirada bloqueia movimentações",
    psicologico: "Exame obrigatório · sem ele, processos travam na PF",
    tiro: "Capacidade técnica obrigatória · renove para manter o CR",
    filiacao: "Filiação vigente é exigida para CAC ativo",
    documento: "Certidão ou regularidade próxima do vencimento",
    processo: "Prazo processual crítico · ação imediata na PF",
  };

  const snapshot = useMemo(() => {
    const activeItems = itens.filter((i: any) => !ACTIVE_FINAL_STATUSES.includes(String(i.status || "").toUpperCase()));
    const PROCESSO_FINAL_STATUSES = new Set(["concluido", "deferido", "finalizado", "indeferido", "cancelado", "arquivado", "desistiu", "restituido"]);
    const activeProcessos = processos.filter((p: any) => !PROCESSO_FINAL_STATUSES.has(String(p.status || "").toLowerCase()));
    const prazosProc = calcularPrazosProcessuais(
      itens.map((it: any) => ({
        id: it.id,
        servico_id: it.servico_id,
        servico_nome: SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`,
        status: it.status,
        numero_processo: it.numero_processo,
        data_notificacao: it.data_notificacao,
        data_indeferimento: it.data_indeferimento,
        data_recurso_administrativo: it.data_recurso_administrativo,
        data_indeferimento_recurso: it.data_indeferimento_recurso,
      })),
    );

    const arsenalItems: FrontItem[] = [];
    const arsenalKeys = new Set<string>();
    const normArsenalKey = (value: unknown) => String(value || "").trim().toUpperCase();
    const registerArsenalKey = (...values: unknown[]) => {
      values.map(normArsenalKey).filter(Boolean).forEach((key) => arsenalKeys.add(key));
    };
    const addArsenal = (label: string, date: string | null | undefined) => {
      const days = daysUntil(date);
      arsenalItems.push({ label, status: compactStatus(days), tone: frontStatus(days) });
    };
    if (cadastro?.validade_cr) addArsenal(hubLabel("cr", "CR — Certificado de Registro"), cadastro.validade_cr);
    crafs.forEach((cr: any) => {
      registerArsenalKey(cr.numero_arma, cr.numero_sigma, cr.numero_registro_sigma, cr.numero_cad_sinarm, cr.nome_arma);
      addArsenal(
        `${hubLabel("craf", "CRAF — Certificado de Registro de Arma de Fogo")} — ${shortName(cr.nome_arma || cr.nome_craf, "Arma")}`,
        cr.data_validade,
      );
    });
    gtes.forEach((g: any) => {
      registerArsenalKey(g.numero_arma, g.numero_sigma, g.numero_registro_sigma, g.numero_gte, g.nome_arma);
      addArsenal(
        `${hubLabel("gte", "GTE — Guia de Tráfego Eventual")} — ${shortName(g.nome_arma || g.nome_gte, "Arma")}`,
        g.data_validade,
      );
    });
    meusDocs.forEach((doc: any) => {
      const tipo = String(doc?.tipo_documento || "").toLowerCase();
      if (tipo !== "craf" && tipo !== "sinarm") return;
      const keys = [doc?.arma_numero_serie, doc?.numero_registro_sigma, doc?.numero_cad_sinarm]
        .map(normArsenalKey)
        .filter(Boolean);
      if (keys.some((key) => arsenalKeys.has(key))) return;

      const nomeArma = [doc?.arma_marca, doc?.arma_modelo, doc?.arma_calibre]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .join(" ");
      const labelBase = tipo === "sinarm"
        ? hubLabel("sinarm", "SINARM — Registro de Arma de Fogo")
        : hubLabel("craf", "CRAF — Certificado de Registro de Arma de Fogo");
      addArsenal(`${labelBase} — ${shortName(nomeArma || doc?.nome_documento || doc?.nome_original, "Arma")}`, doc?.data_validade_efetiva || doc?.data_validade);
      registerArsenalKey(...keys, nomeArma);
    });
    armasManual.forEach((arma: any) => {
      const nome = shortName(arma?.modelo || arma?.nome || arma?.tipo || "Arma manual", "Arma manual");
      arsenalItems.push({ label: nome, status: "—", tone: "muted" });
    });

    const exameByTipo = new Map<string, any>();
    for (const e of examesAtuais) if (e?.tipo && !exameByTipo.has(e.tipo)) exameByTipo.set(e.tipo, e);
    const examesItems: FrontItem[] = [
      exameByTipo.get("psicologico") && {
        label: getNomeDocumentoDisplay({ tipo_documento: "laudo_psicologico" }, "Laudo de Avaliação Psicológica para Aquisição/Porte de Arma de Fogo"),
        status: compactStatus(daysUntil(exameByTipo.get("psicologico")?.data_vencimento)),
        tone: frontStatus(daysUntil(exameByTipo.get("psicologico")?.data_vencimento)),
      },
      exameByTipo.get("tiro") && {
        label: getNomeDocumentoDisplay({ tipo_documento: "laudo_capacidade_tecnica" }, "Atestado de Capacidade Técnica para Manuseio de Arma de Fogo"),
        status: compactStatus(daysUntil(exameByTipo.get("tiro")?.data_vencimento)),
        tone: frontStatus(daysUntil(exameByTipo.get("tiro")?.data_vencimento)),
      },
    ].filter(Boolean) as FrontItem[];

    const filiacaoItems = filiacoes.map((f: any) => {
      const days = daysUntil(f.validade_filiacao);
      return {
        label: shortName(f.nome_filiacao || f.nome_clube || `Clube #${f.clube_id || ""}`, "Clube"),
        status: compactStatus(days),
        tone: frontStatus(days),
      };
    });

    const processoItems = (activeProcessos.length ? activeProcessos : activeItems).map((item: any) => {
      const nome = SERVICO_MAP[item.servico_id] || item.servico_nome || `Serviço #${item.servico_id || ""}`;
      const prazo = prazosProc.find((p: any) =>
        p.id === item.id ||
        p.servicoId === item.servico_id ||
        (item.venda_id != null && p.vendaId === item.venda_id && p.servicoId === item.servico_id),
      );
      const statusProcesso = String(item.status || "").toLowerCase();
      const nomeProcesso = titleCaseServico(nome, "Processo");
      if (activeProcessos.length && (statusProcesso === "aguardando_documentos" || statusProcesso === "aguardando_documentacao")) {
        return { label: nomeProcesso, status: "Checklist documental aberto", tone: "warn" as const, stack: true };
      }
      if (activeProcessos.length && (statusProcesso === "aguardando_pagamento" || statusProcesso === "em_preparacao" || statusProcesso === "preparando")) {
        return { label: nomeProcesso, status: "Processo em preparação", tone: "warn" as const, stack: true };
      }
      if (prazo?.diasRestantes !== undefined) {
        return { label: nomeProcesso, status: compactStatus(Number(prazo.diasRestantes)), tone: frontStatus(Number(prazo.diasRestantes)) };
      }
      return { label: nomeProcesso, status: compactStatus(null, serviceProgress(item)), tone: "warn" as const };
    });

    const docItems: FrontItem[] = meusDocs
      .filter((doc: any) => {
        // Laudos psicológicos e exames de tiro já aparecem na frente EXAMES.
        const tipo = String(doc?.tipo_documento || "").toLowerCase();
        return tipo !== "laudo_psicologico" && tipo !== "laudo_capacidade_tecnica";
      })
      .map((doc: any) => {
        const nomeBruto = getNomeDocumentoDisplay(doc, "Documento");
        const nome = shortName(nomeBruto, "Documento");
        const days = daysUntil(doc?.data_validade_efetiva || doc?.data_validade);
        return { label: nome, status: compactStatus(days), tone: frontStatus(days) };
      })
      .sort((a, b) => (a.tone === "bad" ? -1 : b.tone === "bad" ? 1 : 0));

    // Agrega o pior status entre os itens da frente: bad > warn > ok > muted.
    const aggregateStatus = (items: FrontItem[]): "bad" | "warn" | "ok" | "muted" => {
      if (items.some((i) => i.tone === "bad")) return "bad";
      if (items.some((i) => i.tone === "warn")) return "warn";
      if (items.some((i) => i.tone === "ok")) return "ok";
      return "muted";
    };
    const fronts: Front[] = [
      { key: "arsenal", title: "ARSENAL", count: arsenalItems.length, tone: "bordo", status: aggregateStatus(arsenalItems), items: arsenalItems.slice(0, 3), navTo: "arsenal" },
      { key: "exames", title: "EXAMES", count: examesItems.length, tone: "amber", status: aggregateStatus(examesItems), items: examesItems.slice(0, 3), navTo: "documentos" },
      { key: "filiacao", title: "FILIAÇÃO", count: filiacaoItems.length, tone: "amber", status: aggregateStatus(filiacaoItems), items: filiacaoItems.slice(0, 3), navTo: "documentos" },
      { key: "documentos", title: "DOCUMENTOS", count: docItems.length, tone: "amber", status: aggregateStatus(docItems), items: docItems.slice(0, 3), navTo: "documentos" },
      { key: "processos", title: "PROCESSOS", count: activeProcessos.length || activeItems.length, tone: "bordo", status: aggregateStatus(processoItems), items: processoItems.slice(0, 3), navTo: "processos" },
    ];

    const urgents: Urgent[] = [];
    const pushUrgent = (
      label: string,
      sub: string,
      date: string | null | undefined,
      navTo: string,
      ctaLabel: string,
      frontKey: Urgent["frontKey"],
      examTipo?: Urgent["examTipo"],
    ) => {
      const days = daysUntil(date);
      if (days === null || days > 7) return;
      urgents.push({ label, sub, days, navTo, ctaLabel, frontKey, examTipo });
    };
    if (cadastro?.validade_cr) pushUrgent("CR — Certificado", URG_SUB.cr, cadastro.validade_cr, "arsenal", "RENOVAR AGORA →", "arsenal");
    crafs.forEach((cr: any) => pushUrgent(`CRAF — ${shortName(cr.nome_arma || cr.nome_craf, "Arma")}`, URG_SUB.craf, cr.data_validade, "arsenal", "RENOVAR AGORA →", "arsenal"));
    gtes.forEach((g: any) => pushUrgent(`GTE — ${shortName(g.nome_arma || g.nome_gte, "Arma")}`, URG_SUB.gte, g.data_validade, "arsenal", "RENOVAR AGORA →", "arsenal"));
    filiacoes.forEach((f: any) => pushUrgent(`Filiação — ${shortName(f.nome_filiacao || f.nome_clube, "Clube")}`, URG_SUB.filiacao, f.validade_filiacao, "documentos", "ATUALIZAR AGORA →", "filiacao"));
    // Exames psicológico/tiro NÃO entram em "Próximo Vencimento": já são
    // contabilizados via qa_documentos_cliente (laudo_psicologico /
    // laudo_capacidade_tecnica). Empurrá-los aqui gera duplicação no banner.
    // Mantemos os cards da frente "EXAMES" intactos — só removemos o push
    // duplicado para a fila de urgentes.
    meusDocs.forEach((doc: any) => {
      const tipo = String(doc?.tipo_documento || "").toLowerCase();
      const isLaudo = tipo === "laudo_psicologico" || tipo === "laudo_capacidade_tecnica";
      const fk: Urgent["frontKey"] = isLaudo ? "exames" : "documentos";
      const cta = isLaudo ? "AGENDAR AGORA →" : "ATUALIZAR AGORA →";
      const examTipo: Urgent["examTipo"] | undefined =
        tipo === "laudo_psicologico" ? "psicologo"
          : tipo === "laudo_capacidade_tecnica" ? "instrutor_tiro"
          : undefined;
      pushUrgent(
        shortName(getNomeDocumentoDisplay(doc, "Documento"), "Documento"),
        isLaudo ? URG_SUB.psicologico : URG_SUB.documento,
        doc?.data_validade_efetiva || doc?.data_validade,
        "documentos",
        cta,
        fk,
        examTipo,
      );
    });
    processoDocs.forEach((doc: any) => pushUrgent(
      shortName(getNomeDocumentoDisplay(doc, "Documento do processo"), "Documento do processo"),
      URG_SUB.documento,
      doc?.data_validade_efetiva || doc?.data_validade,
      "processos",
      "ATUALIZAR AGORA →",
      "processos",
    ));
    prazosProc.forEach((p: any) => {
      if (typeof p.diasRestantes === "number" && p.diasRestantes <= 7) {
        urgents.push({
          label: `${p.evento} — ${p.servicoNome || "Processo"}`,
          sub: URG_SUB.processo,
          days: p.diasRestantes,
          navTo: "processos",
          ctaLabel: "AGENDAR AGORA →",
          frontKey: "processos",
        });
      }
    });

    const sortedUrgents = urgents.sort((a, b) => a.days - b.days);
    const nextDue = [...arsenalItems, ...examesItems, ...filiacaoItems]
      .map((item) => {
        const match = item.status.match(/^(\d+)D$/);
        return match ? Number(match[1]) : null;
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)[0];
    const totalFronts = fronts.reduce((sum, front) => sum + front.count, 0);
    const redCount = sortedUrgents.length;
    const activeProcessosCount = activeProcessos.length || activeItems.length;
    const totalTasks = Math.max(totalFronts + activeProcessosCount, redCount + activeProcessosCount);
    const summary: Array<[string, string, string]> = [
      ["TAREFAS ABERTAS", String(redCount + activeProcessosCount), `de ${totalTasks}`],
      ["PRÓXIMO VENCIMENTO", nextDue !== undefined ? String(nextDue) : "—", nextDue !== undefined ? "dias" : ""],
      ["DOCUMENTOS A RENOVAR", String(redCount), redCount > 0 ? "urgente" : ""],
      ["PROCESSOS ATIVOS", String(activeProcessosCount), activeProcessos.length ? "checklist aberto" : ""],
    ];

    return { fronts, urgents: sortedUrgents, totalFronts, activeItems, activeProcessos, summary };
  }, [SERVICO_MAP, armasManual, cadastro, crafs, examesAtuais, filiacoes, gtes, itens, meusDocs, processoDocs, processos]);

  const [focusIndex, setFocusIndex] = useState(0);
  const [chipFilter, setChipFilter] = useState<"todos" | Urgent["frontKey"]>("todos");
  const [autoPaused, setAutoPaused] = useState(false);
  const [exameModal, setExameModal] = useState<{ tipo: "psicologo" | "instrutor_tiro" } | null>(null);
  const [atalhosOpen, setAtalhosOpen] = useState(false);
  useEffect(() => {
    if (!atalhosOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-qa-atalhos-root]')) return;
      setAtalhosOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAtalhosOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [atalhosOpen]);
  const navigate = useNavigate();
  const clienteCep = (cadastro?.cep || (cliente as any)?.cep || "") as string;
  const clienteUf = (cadastro?.estado || (cliente as any)?.estado || "") as string;

  const filteredUrgents = useMemo(
    () => (chipFilter === "todos" ? snapshot.urgents : snapshot.urgents.filter((u) => u.frontKey === chipFilter)),
    [chipFilter, snapshot.urgents],
  );

  useEffect(() => setFocusIndex(0), [filteredUrgents.length, chipFilter]);
  useEffect(() => {
    if (filteredUrgents.length <= 1 || autoPaused) return;
    const id = window.setInterval(() => setFocusIndex((current) => (current + 1) % filteredUrgents.length), 6000);
    return () => window.clearInterval(id);
  }, [filteredUrgents.length, autoPaused]);

  // Trava o scroll da página apenas no desktop (>=1024px).
  // No mobile/tablet o conteúdo precisa rolar para acessar os cards e o rodapé.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const { body, documentElement: html } = document;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;

    const apply = () => {
      if (mq.matches) {
        body.style.overflow = "hidden";
        html.style.overflow = "hidden";
        body.style.overscrollBehavior = "";
      } else {
        body.style.overflow = prevBody;
        html.style.overflow = prevHtml;
        // Evita "bounce" elástico no mobile, mantendo a tela contida e estética.
        body.style.overscrollBehavior = "contain";
      }
    };

    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const activeUrgent = filteredUrgents[focusIndex] || null;
  const memberSince = (() => {
    const d = (cliente as any)?.created_at || (cliente as any)?.data_cadastro;
    if (!d) return null;
    const p = new Date(d);
    if (isNaN(p.getTime())) return null;
    const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${meses[p.getMonth()]}/${p.getFullYear()}`;
  })();
  // Categoria do titular: usa categoria_titular do cadastro/cliente.
  // Se ainda não houver CR enviado, exibe "SEM CATEGORIA" (sem inventar valor padrão).
  const CATEGORIA_LABELS: Record<string, string> = {
    pessoa_fisica: "PESSOA FÍSICA",
    pessoa_juridica: "PESSOA JURÍDICA",
    seguranca_publica: "SEGURANÇA PÚBLICA",
    magistrado_mp: "MAGISTRADO/MP",
    militar: "MILITAR",
  };
  const rawCategoria = (cadastro?.categoria_titular || (cliente as any)?.categoria_titular || "") as string;
  const temCR = Boolean(cadastro?.numero_cr);
  const categoriaLabel = rawCategoria
    ? (CATEGORIA_LABELS[rawCategoria] || rawCategoria.replace(/_/g, " ").toUpperCase())
    : (temCR ? "TITULAR" : "SEM CATEGORIA");
  const processosEmAndamento = snapshot.activeProcessos.length || snapshot.activeItems.length;
  const statusLine = `${categoriaLabel}${temCR ? ` · CR ${cadastro?.numero_cr}` : ""}${memberSince ? ` · MEMBRO DESDE ${memberSince}` : ""} · ${processosEmAndamento} PROCESSOS EM ANDAMENTO`;
  const filters: Array<{ key: "todos" | Urgent["frontKey"]; label: string }> = [
    { key: "todos", label: `TODOS ${snapshot.urgents.length}` },
    { key: "arsenal", label: `ARSENAL ${snapshot.urgents.filter((u) => u.frontKey === "arsenal").length}` },
    { key: "exames", label: `EXAMES ${snapshot.urgents.filter((u) => u.frontKey === "exames").length}` },
    { key: "documentos", label: `DOCUMENTOS ${snapshot.urgents.filter((u) => u.frontKey === "documentos").length}` },
    { key: "processos", label: `PROCESSOS ${Math.max(snapshot.urgents.filter((u) => u.frontKey === "processos").length, processosEmAndamento)}` },
  ];
  const updated = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()).replace(/\./g, "").toUpperCase();
  const updatedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());

  return (
    <main className="qa-client-summary-print">
      <style>{`
        @keyframes qa-recoil{0%{transform:scale(1) translateX(0)}15%{transform:scale(1.08) translateX(-4px)}30%{transform:scale(1.14) translateX(3px)}45%{transform:scale(1.1) translateX(-2px)}60%{transform:scale(1.12) translateX(1px)}100%{transform:scale(1.12) translateX(0)}}
        @keyframes qa-descend{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
        @keyframes qa-pulse-ring{0%{transform:scale(.6);opacity:.85}80%,100%{transform:scale(2.2);opacity:0}}
        .qa-client-summary-print__cadastro-wrap{position:relative;display:inline-flex;flex-shrink:0;animation:qa-descend 2.4s ease-in-out infinite}
        .qa-client-summary-print__cadastro-pulse{position:absolute;top:2px;right:2px;width:12px;height:12px;pointer-events:none;z-index:2}
        .qa-client-summary-print__cadastro-pulse:before{content:"";position:absolute;inset:0;border-radius:999px;background:#E11D48;animation:qa-pulse-ring 1.6s cubic-bezier(0,0,.2,1) infinite}
        .qa-client-summary-print__cadastro-pulse:after{content:"";position:absolute;inset:0;border-radius:999px;background:#E11D48;box-shadow:0 0 0 2px #fff}
        .qa-client-summary-print__cadastro-wrap:hover{animation-play-state:paused}
        .qa-atalhos-pop{position:absolute;top:calc(100% + 8px);right:0;min-width:240px;background:#fff;border:1px solid #1a1a1a;border-radius:4px;box-shadow:0 18px 40px rgba(0,0,0,.18);z-index:40;padding:6px;text-transform:none}
        .qa-atalhos-pop__head{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:9px;font-weight:900;letter-spacing:.22em;color:#7A1F2B;padding:8px 10px 6px;text-transform:uppercase}
        .qa-atalhos-pop__item{display:block;width:100%;text-align:left;border:0;background:transparent;padding:9px 10px;border-radius:3px;cursor:pointer;transition:background .12s}
        .qa-atalhos-pop__item:hover{background:#f4efe6}
        .qa-atalhos-pop__k{display:block;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:.18em;color:#0A0A0A;text-transform:uppercase}
        .qa-atalhos-pop__d{display:block;font-family:Arial,sans-serif;font-size:11px;color:#6A6A6A;margin-top:3px;letter-spacing:0}
        .qa-client-summary-print{--paper:#f3f3f2;--card:#ffffff;--ink:#111111;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;--amber:#d5a33d;--green:#278652;--red:#df2727;color:var(--ink);font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:.02em;padding:0;min-height:560px;border:0;border-radius:0;box-shadow:none;text-transform:uppercase}
        .qa-client-summary-print *{box-sizing:border-box}.qa-client-summary-print__wrap{max-width:none;margin:0}.qa-client-summary-print__top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.qa-client-summary-print h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:24px;line-height:1.05;margin:0;letter-spacing:.04em;color:#0A0A0A;text-transform:uppercase}.qa-client-summary-print__meta{display:flex;align-items:center;gap:8px;margin-top:11px;font-size:10px;font-weight:900;letter-spacing:.22em;color:var(--muted)}.qa-client-summary-print__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo);display:inline-block}.qa-client-summary-print__updated{text-align:right;font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:10px;line-height:1.4;letter-spacing:.22em;padding-top:6px;white-space:nowrap;color:var(--muted);text-transform:uppercase}.qa-client-summary-print__updated small{display:block;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:.22em;margin-bottom:4px}.qa-client-summary-print__updated{display:flex;align-items:center;gap:12px;justify-content:flex-end}.qa-client-summary-print__updated-text{display:block}.qa-client-summary-print__cadastro-btn{display:inline-flex;align-items:center;justify-content:center;width:64px;height:52px;border:none;background:transparent;padding:0;border-radius:0;overflow:hidden;cursor:pointer;transition:transform .2s ease,filter .2s ease;flex-shrink:0}.qa-client-summary-print__cadastro-btn:hover{animation:qa-recoil .45s ease-out forwards}.qa-client-summary-print__toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.qa-client-summary-print__chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:8px 13px 7px;font-size:9px;font-weight:900;letter-spacing:.18em;color:#303030;box-shadow:0 1px 1px rgba(0,0,0,.04)}.qa-client-summary-print__chip{cursor:pointer}.qa-client-summary-print__chip.is-active{background:#111;color:#fff;border-color:#111}.qa-client-summary-print__label{font-size:12px;font-weight:900;letter-spacing:.22em;margin:0 0 15px}.qa-client-summary-print__fronts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.qa-front-card{background:var(--card);border:1px solid var(--line);border-radius:3px;min-height:200px;padding:20px 14px 14px;box-shadow:0 6px 14px rgba(17,17,17,.04);position:relative}.qa-front-card:before{content:"";position:absolute;left:-1px;right:-1px;top:-1px;height:4px;background:#cfcfcf;border-radius:3px 3px 0 0}.qa-front-card.s-bad:before{background:var(--red)}.qa-front-card.s-warn:before{background:var(--amber)}.qa-front-card.s-ok:before{background:var(--green)}.qa-front-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #ededed;padding-bottom:9px;margin-bottom:9px}.qa-front-card h2{font-family:Oswald,'Arial Narrow',Arial,sans-serif;margin:0;font-size:13px;font-weight:900;letter-spacing:.24em;line-height:1}.qa-front-card__sub{font-size:11px;letter-spacing:0;text-transform:none;color:#9a9a9f;margin-top:5px}.qa-front-card__num{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:28px;line-height:.82;font-weight:900;color:var(--muted);letter-spacing:0}.qa-front-card.s-bad .qa-front-card__num{color:var(--red)}.qa-front-card.s-warn .qa-front-card__num{color:var(--amber)}.qa-front-card.s-ok .qa-front-card__num{color:var(--green)}.qa-front-card__item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;padding:6px 0;font-size:11px;font-weight:900;letter-spacing:-.01em;text-transform:none;border-bottom:1px solid #f1f1f1}.qa-front-card__item:last-child{border-bottom:0}.qa-front-card__item span:first-child{white-space:normal;overflow:visible;text-overflow:clip;text-transform:none;font-weight:600;letter-spacing:0}.qa-front-card__item strong{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:.08em;color:var(--muted);white-space:nowrap}.qa-front-card__item strong.bad{color:var(--red)}.qa-front-card__item strong.warn{color:var(--amber)}.qa-front-card__item strong.ok{color:var(--green)}.qa-client-summary-print__focus{margin-top:0;margin-bottom:24px;background:var(--card);border:1px solid var(--line);border-radius:3px;min-height:78px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:18px 18px 18px 22px;position:relative}.qa-client-summary-print__focus:before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:4px;background:var(--red);border-radius:3px 0 0 3px}.qa-focus__k{font-size:10px;font-weight:900;letter-spacing:.24em;color:var(--red);margin-bottom:8px}.qa-focus__text{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:0;text-transform:none}.qa-focus__actions{display:flex;align-items:center;gap:10px}.qa-focus__pages{display:flex;gap:5px}.qa-focus__page{width:22px;height:22px;border:1px solid var(--line);background:#fff;color:var(--muted);font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;cursor:pointer}.qa-focus__page.is-active{background:var(--bordo);border-color:var(--bordo);color:#fff}.qa-focus__btn{border:0;background:var(--bordo);color:#fff;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:900;letter-spacing:.18em;padding:8px 12px;cursor:pointer}.qa-client-summary-print__summary{display:grid;grid-template-columns:repeat(4,1fr);margin-top:22px;border:1px solid var(--line);border-radius:3px;overflow:hidden;background:var(--card)}.qa-client-summary-print__sm{padding:16px 18px;border-right:1px solid var(--line);min-height:82px}.qa-client-summary-print__sm:last-child{border-right:0}.qa-client-summary-print__k{font-size:10px;font-weight:900;letter-spacing:.24em;color:var(--muted);margin-bottom:9px}.qa-client-summary-print__v{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:26px;line-height:1;font-weight:900;letter-spacing:0}.qa-client-summary-print__v small{font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-left:0;margin-top:4px;display:block;text-transform:none}.qa-client-summary-print__footer{text-align:center;margin-top:21px;color:#b1b1b1;font-size:9px;font-weight:900;letter-spacing:.22em}@media (max-width:1399px){.qa-client-summary-print__fronts{grid-template-columns:repeat(3,1fr)}}@media (max-width:900px){.qa-client-summary-print__fronts{grid-template-columns:repeat(2,1fr)}.qa-client-summary-print__summary{grid-template-columns:repeat(2,1fr)}.qa-client-summary-print__sm:nth-child(2){border-right:0}.qa-client-summary-print__sm:nth-child(-n+2){border-bottom:1px solid var(--line)}}.qa-urgbanner{position:relative;background:var(--card);border:1px solid var(--line);border-radius:3px;padding:18px 22px 18px 26px;margin-bottom:18px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;box-shadow:0 6px 14px rgba(17,17,17,.04)}.qa-urgbanner:before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:5px;background:var(--red);border-radius:3px 0 0 3px}.qa-urgbanner__kicker{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.28em;color:var(--red);margin-bottom:10px;text-transform:uppercase}.qa-urgbanner__title{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;line-height:1.05;margin:0 0 6px;color:#0c0c0c;text-transform:none;letter-spacing:-.01em}.qa-urgbanner__sub{margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:#5a5a5a;text-transform:none;letter-spacing:0}.qa-urgbanner__actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.qa-urgbanner__cta{border:0;background:var(--bordo);color:#fff;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;padding:11px 16px;cursor:pointer;border-radius:2px;text-transform:uppercase}.qa-urgbanner__ghost{border:1px solid #d6d6d4;background:transparent;color:#111;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;padding:10px 16px;cursor:pointer;border-radius:2px;text-transform:uppercase}.qa-urgbanner__pages{display:flex;gap:14px;margin-top:4px;flex-wrap:wrap;align-items:baseline;justify-content:flex-end}.qa-urgbanner__page{min-width:auto;height:auto;border:0;background:transparent;color:#b8b1a6;font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:.08em;cursor:pointer;border-radius:0;padding:0;line-height:1;transition:color .15s ease,font-size .15s ease}.qa-urgbanner__page:hover{color:var(--bordo)}.qa-urgbanner__page.is-active{background:transparent;border-color:transparent;color:var(--bordo);font-size:14px;font-weight:900}.qa-urgbanner__count{text-align:right;padding-left:18px}.qa-urgbanner__num{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:78px;line-height:.82;color:var(--red);letter-spacing:-.02em}.qa-urgbanner__numk{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.32em;color:#0c0c0c;margin-top:14px}@media (max-width:880px){.qa-urgbanner{grid-template-columns:1fr;padding:20px 18px 18px 24px}.qa-urgbanner__count{text-align:left;padding-left:0}.qa-urgbanner__num{font-size:72px}.qa-urgbanner__title{font-size:26px}}@media (max-width:680px){.qa-client-summary-print{padding:20px 14px 28px}.qa-client-summary-print__top{flex-direction:column;gap:8px}.qa-client-summary-print__updated{text-align:left;padding-top:0}.qa-client-summary-print h1{font-size:24px}.qa-client-summary-print__fronts{grid-template-columns:1fr}.qa-client-summary-print__focus{grid-template-columns:1fr}.qa-focus__actions{justify-content:space-between;flex-wrap:wrap}.qa-client-summary-print__summary{grid-template-columns:1fr}.qa-client-summary-print__sm,.qa-client-summary-print__sm:nth-child(2){border-right:0;border-bottom:1px solid var(--line)}.qa-client-summary-print__sm:last-child{border-bottom:0}}
      `}</style>
      <div className="qa-client-summary-print__wrap">
        <header className="qa-client-summary-print__top">
          <div>
            <h1>{greetingTitle}</h1>
            <div className="qa-client-summary-print__meta"><span className="qa-client-summary-print__dot" />{statusLine}</div>
          </div>
          <div className="qa-client-summary-print__updated">
            <span className="qa-client-summary-print__updated-text"><small>ATUALIZADO</small>{updated} · {updatedTime}</span>
          </div>
        </header>

        <div className="qa-client-summary-print__toolbar" aria-label="Filtros do resumo">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.key}
              className={`qa-client-summary-print__chip ${chipFilter === filter.key ? "is-active" : ""}`}
              onClick={() => { setChipFilter(filter.key); setAutoPaused(true); }}
              aria-pressed={chipFilter === filter.key}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <section className="qa-urgbanner" aria-label="Próximo vencimento" aria-live="polite">
          <div className="qa-urgbanner__body">
            <div className="qa-urgbanner__kicker">PRÓXIMO VENCIMENTO · AÇÃO IMEDIATA</div>
            <h2 className="qa-urgbanner__title">{activeUrgent ? activeUrgent.label : "Nenhum documento crítico"}</h2>
            <p className="qa-urgbanner__sub">{activeUrgent ? activeUrgent.sub : "Tudo em dia · nenhum item em status vermelho nesta semana."}</p>
            <div className="qa-urgbanner__actions">
              <button className="qa-urgbanner__cta" type="button" onClick={() => {
                if (activeUrgent?.examTipo) { setExameModal({ tipo: activeUrgent.examTipo }); return; }
                onNavigate(activeUrgent?.navTo || "documentos");
              }}>
                {activeUrgent?.ctaLabel || "ATUALIZAR AGORA →"}
              </button>
              <button className="qa-urgbanner__ghost" type="button" onClick={() => { if (onOpenDocsHub) { onOpenDocsHub(); } else { onNavigate("documentos"); } }}>ANEXAR</button>
            </div>
          </div>
          <div className="qa-urgbanner__count" aria-hidden={!activeUrgent}>
            <div className="qa-urgbanner__num">{activeUrgent ? (activeUrgent.days < 0 ? "!!" : String(Math.max(0, activeUrgent.days)).padStart(2, "0")) : "--"}</div>
            <div className="qa-urgbanner__numk">{activeUrgent && activeUrgent.days < 0 ? "VENCIDO" : "DIAS RESTANTES"}</div>
            {filteredUrgents.length > 1 && (
              <div className="qa-urgbanner__pages" role="tablist" aria-label="Documentos críticos">
                {filteredUrgents.map((urgent, index) => (
                  <button
                    className={`qa-urgbanner__page ${index === focusIndex ? "is-active" : ""}`}
                    key={`${urgent.label}-${index}`}
                    type="button"
                    aria-label={`Ir para ${urgent.label}`}
                    onClick={() => { setFocusIndex(index); setAutoPaused(true); }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="qa-client-summary-print__label" style={{ marginTop: 24 }}>SUAS CINCO FRENTES</div>
        <section className="qa-client-summary-print__fronts" aria-label="Suas quatro frentes">
          {snapshot.fronts.map((front) => (
            <article className={`qa-front-card s-${front.status}`} key={front.key} onClick={() => onNavigate(front.navTo)} role="button" tabIndex={0}>
              <div className="qa-front-card__head">
                <div><h2>{front.title}</h2><div className="qa-front-card__sub">Total de itens monitorados</div></div>
                <div className="qa-front-card__num">{front.count}</div>
              </div>
              {front.items.length === 0 && <div className="qa-front-card__item"><span>Nenhum item monitorado</span><strong>—</strong></div>}
              {front.items.map((item, index) => (
                <div
                  className={`qa-front-card__item${item.stack ? " qa-front-card__item--stack" : ""}`}
                  key={`${front.key}-${index}-${item.label}`}
                >
                  <span>{item.label}</span><strong className={item.tone}>{item.status}</strong>
                </div>
              ))}
            </article>
          ))}
        </section>

        <section className="qa-client-summary-print__summary" aria-label="Indicadores do resumo">
          {snapshot.summary.map(([label, value, small]) => (
            <div className="qa-client-summary-print__sm" key={label}>
              <div className="qa-client-summary-print__k">{label}</div>
              <div className="qa-client-summary-print__v">{value}{small && <small>{small}</small>}</div>
            </div>
          ))}
        </section>
        <div className="qa-client-summary-print__footer">QUERO ARMAS · COCKPIT Z6 · RESUMO · DECK V29</div>
      </div>
      {exameModal && (
        <AgendarExameModal
          open
          tipo={exameModal.tipo}
          cep={clienteCep}
          uf={clienteUf}
          onClose={() => setExameModal(null)}
          onVerListaCompleta={() => {
            const qs = new URLSearchParams();
            qs.set("tipo", exameModal.tipo);
            if (clienteCep) qs.set("cep", String(clienteCep));
            if (clienteUf) qs.set("uf", String(clienteUf));
            navigate(`/area-do-cliente/agendar-exame?${qs.toString()}`);
            setExameModal(null);
          }}
        />
      )}
      {(onOpenCadastro || onOpenComprar) && (
        <div
          data-qa-atalhos-root
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
        >
          {atalhosOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                bottom: 32,
                right: 62,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0,
              }}
            >
              {onOpenComprar && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setAtalhosOpen(false); onOpenComprar(); }}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: '2px 0',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      color: '#1c1c1c',
                      textTransform: 'none',
                      lineHeight: 1.3,
                      textAlign: 'right',
                      transition: 'color 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#7A1F2B'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#1c1c1c'; }}
                  >
                    Novo serviço
                  </button>
                  <div style={{ width: 40, height: 1, background: 'rgba(0,0,0,0.08)', margin: '1px 0 1px auto' }} />
                </>
              )}
              {onOpenCadastro && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setAtalhosOpen(false); onOpenCadastro(); }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    padding: '2px 0',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: '#1c1c1c',
                    textTransform: 'none',
                    lineHeight: 1.3,
                    textAlign: 'right',
                    transition: 'color 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#7A1F2B'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#1c1c1c'; }}
                >
                  Cadastro
                </button>
              )}
            </div>
          )}
          <div style={{ position: 'relative', animation: atalhosOpen ? undefined : 'qa-descend 2.4s ease-in-out infinite' }}>
            {!atalhosOpen && (
              <span aria-hidden style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, pointerEvents: 'none', zIndex: 2 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: '#7A1F2B', animation: 'qa-pulse-ring 1.6s cubic-bezier(0,0,.2,1) infinite' }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: '#7A1F2B', boxShadow: '0 0 0 2px #fff' }} />
              </span>
            )}
            <button
              type="button"
              onClick={() => setAtalhosOpen((v) => !v)}
              aria-label="Abrir atalhos"
              aria-expanded={atalhosOpen}
              title="Atalhos"
              style={{ width: 52, height: 52, border: '1px solid #e3e3e1', background: '#fff', borderRadius: 999, padding: 7, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img src="/icone-arma-cadastro-squircle.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', filter: 'grayscale(30%)' }} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}