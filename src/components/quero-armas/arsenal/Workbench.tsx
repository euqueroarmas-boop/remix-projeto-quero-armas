import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Crosshair, Layers, ShieldAlert, Star, Radio, X } from "lucide-react";
import {
  buildWeaponInfo,
  maskSerial,
  TACTICAL,
  urgencyTone,
  normalizeCalibre,
  WeaponInfo,
  WEAPON_KIND_LABEL,
  GT_STATUS_LABEL,
  gtChipTone,
  type GtDocStatus,
  type WeaponRegime,
} from "./utils";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";
import { backgroundForKind, renderForKind } from "./weaponAssets";
import { usePrivateStorageUrl } from "@/hooks/usePrivateStorageUrl";
import { useArsenalCardSize, ArsenalCardSizeToggle } from "./useArsenalCardSize";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface WorkbenchWeapon {
  id: number | string;
  source: "CRAF" | "GTE";
  nome_arma: string | null;
  numero_arma: string | null;
  numero_sigma: string | null;
  /** Nº Cad. SINARM extraído do CRAF — prova canônica de SINARM. */
  numero_cad_sinarm?: string | null;
  /** Nº de registro SIGMA explícito (Exército/CAC). */
  numero_registro_sigma?: string | null;
  /** Regime canônico já decidido pela IA / equipe (SINARM/SIGMA/REVISAR). */
  sistema_registro?: "SINARM" | "SIGMA" | "REVISAR" | string | null;
  /** Espécie/tipo do documento (ESPINGARDA, REVÓLVER, PISTOLA, etc.). */
  arma_especie?: string | null;
  data_validade: string | null;
  daysToExpire: number | null;
  hasGte?: boolean;
  hasCraf?: boolean;
  crafStatus?: "valido" | "ativo" | "vencido" | "ausente" | "revisar";
  gteStatus?: "valido" | "ativo" | "vencido" | "ausente" | "revisar";
  crafLabel?: string;
  gteLabel?: string;
  linkReview?: boolean;
  catalogo_id?: string | null;
  /** Regime/sistema do registro (SINARM, SIGMA, etc) e finalidade declarada. */
  sistema?: string | null;
  finalidade?: string | null;
  /** Indica se a GTE é documento permanente exigível para esta arma. */
  gteExigivel?: boolean;
  /** Regime canônico inferido (SIGMA / SINARM / REVISAR). */
  regime?: WeaponRegime;
  /**
   * GT (Guia de Tráfego de retirada/transporte inicial da loja).
   * Documento histórico/informativo — NÃO é GTE e sua ausência NÃO pinta
   * a KPI ARMAS de vermelho.
   */
  gtStatus?: GtDocStatus;
  hasGt?: boolean;
  gtDeclaradaNaoPossui?: boolean;
  /**
   * Quando o card representa um documento enviado pelo próprio cliente
   * (GTE/CRAF/AC em qa_documentos_cliente), exibimos um thumbnail do
   * documento no lugar da silhueta do catálogo, para deixar claro que
   * é um documento e não outra arma cadastrada.
   */
  documentPreview?: {
    bucket: string;
    storagePath: string;
    mime?: string | null;
  } | null;
}

interface DocCard {
  id: string;
  category: string;
  title: string;
  date: string | null;
  daysToExpire: number | null;
  onOpen?: () => void;
  onDelete?: () => void;
}

interface Props {
  weapons: WorkbenchWeapon[];
  documents: DocCard[];
  ammoByCalibre: { calibre: string; quantidade: number }[];
  onSelectWeapon: (w: WorkbenchWeapon, info: WeaponInfo) => void;
  headerAction?: React.ReactNode;
  clienteId?: number | null;
}

const toneClasses = {
  ok: { glow: "shadow-[0_8px_24px_-12px_rgba(16,185,129,0.30)]", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", ring: "ring-1 ring-emerald-300/60" },
  warn: { glow: "shadow-[0_10px_28px_-10px_rgba(245,158,11,0.45)]", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", ring: "ring-1 ring-amber-300/70" },
  danger: { glow: "shadow-[0_12px_30px_-8px_rgba(239,68,68,0.55)]", chip: "bg-red-50 text-red-700 border-red-300", dot: "bg-red-500", ring: "ring-2 ring-red-400/80" },
  muted: { glow: "shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]", chip: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400", ring: "" },
};

function urgencyText(days: number | null): string {
  if (days === null) return "SEM DATA";
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  if (days < 0) return `VENCIDO ${fmt(Math.abs(days))} DIAS`;
  if (days === 0) return "VENCE HOJE";
  return `${fmt(days)} DIAS RESTANTES`;
}

function WeaponCard({
  w,
  info,
  catalog,
  onClick,
  size = "md",
  ammoCount,
}: {
  w: WorkbenchWeapon;
  info: WeaponInfo;
  catalog: ArmamentoCatalogo | null;
  onClick: () => void;
  size?: "lg" | "md" | "sm";
  ammoCount?: number;
}) {
  const baseTone = urgencyTone(w.daysToExpire);
  // GT NUNCA participa do tom crítico do card.
  const gteAlerta = w.gteExigivel !== false && (w.gteStatus === "ausente" || w.gteStatus === "vencido" || w.gteStatus === "revisar");
  const tone = gteAlerta || w.crafStatus === "ausente" || w.crafStatus === "vencido" || w.crafStatus === "revisar"
    ? "danger"
    : baseTone;
  const c = toneClasses[tone];
  // Aura/fundo do card sempre neutro (sem amarelo/dourado).
  // Cores semânticas ficam apenas em chips, dots e badges de urgência.
  const accent =
    tone === "danger" ? "#ef4444"
    : tone === "ok" ? "#10b981"
    : "#94a3b8";
  // Prioridade crítica: valor confirmado/manual no documento prevalece.
  // Catálogo nunca substitui marca/modelo/calibre do card; serve só para imagem/stats.
  const marca = info.marca || catalog?.marca || info.label;
  const modeloRaw = (info.modelo || "").toString();
  // Espingardas com espaços; demais armas compactadas (TS9, RT838, T4).
  const isEspingarda = info.kind === "espingarda";
  const modelo = isEspingarda
    ? modeloRaw
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
    : modeloRaw.replace(/\s+/g, "").trim();
  const calibre = info.calibre || catalog?.calibre || "—";
  const bg = backgroundForKind(info.kind);
  const render = catalog?.imagem || renderForKind(info.kind);
  const docPreviewUrl = usePrivateStorageUrl(
    w.documentPreview?.bucket || "qa-documentos",
    w.documentPreview?.storagePath || null,
    3600,
  );
  const isDocCard = !!w.documentPreview;
  const isDocImage = (w.documentPreview?.mime || "").startsWith("image/");
  const borderColor =
    tone === "danger" ? "border-red-400"
    : tone === "warn" ? "border-amber-300"
    : tone === "ok" ? "border-emerald-200"
    : "border-slate-200";
  const isSm = size === "sm";
  const isMd = size === "md";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border-2 ${borderColor} bg-white text-left transition-all hover:-translate-y-[2px] ${c.glow} ${c.ring} ${
        isSm ? "min-h-[260px]" : isMd ? "min-h-[440px]" : "min-h-[520px]"
      }`}
    >
      {/* Cinematic background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(248,250,252,0.85) 100%), radial-gradient(circle at 50% 60%, ${accent}14, transparent 70%)`,
        }}
      />
      {/* Scanline subtle */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(15,23,42,0.35) 2px, rgba(15,23,42,0.35) 3px)",
        }}
      />
      {/* Corner ticks */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-2 top-2 h-3 w-6 border-l border-t border-slate-300" />
        <div className="absolute right-2 top-2 h-3 w-6 border-r border-t border-slate-300" />
        <div className="absolute bottom-2 left-2 h-3 w-6 border-b border-l border-slate-300" />
        <div className="absolute bottom-2 right-2 h-3 w-6 border-b border-r border-slate-300" />
      </div>

      <div className={`relative flex h-full flex-1 flex-col ${isSm ? "p-2" : isMd ? "p-3" : "p-4"}`}>
        <div className={`flex items-start justify-between ${isSm ? "gap-1.5" : "gap-3"} ${isSm ? "" : isMd ? "min-h-[64px]" : "min-h-[72px]"}`}>
          <div className="min-w-0 flex-1">
            <div className={`flex flex-wrap items-center ${isSm ? "gap-1" : "gap-1.5"}`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot} animate-pulse`} />
              {!isSm && (
                <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  {WEAPON_KIND_LABEL[info.kind]}
                </span>
              )}
              {catalog && !isSm && (
                <span className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">
                  <Star className="h-2 w-2 fill-emerald-500 text-emerald-500" /> ID
                </span>
              )}
            </div>
            <div className={`mt-1 truncate font-black uppercase tracking-tight text-slate-900 leading-tight ${isSm ? "text-[10px]" : isMd ? "text-[12px]" : "text-[15px]"}`}>
              {marca}
            </div>
            {!isSm && (
              <div className={`truncate font-semibold uppercase tracking-[0.18em] text-[#7A1F2B] ${isMd ? "text-[10px]" : "text-[11px]"}`}>
                {modelo}
              </div>
            )}
            {!isSm && (
              <div className={`mt-1 font-bold uppercase tracking-[0.18em] text-slate-500 ${isMd ? "text-[9px]" : "text-[10px]"}`}>
                CAL · {calibre}
              </div>
            )}
          </div>
          <div className={`flex shrink-0 flex-col items-end gap-1 ${isSm ? "max-w-[55%]" : "max-w-[40%]"}`}>
            <span
              className={`rounded-sm border px-1 py-0.5 ${isSm ? "text-[7px]" : "text-[8px]"} font-black uppercase tracking-[0.04em] leading-tight text-right ${c.chip}`}
            >
              {urgencyText(w.daysToExpire)}
            </span>
            {!isSm && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
                {w.source}
                {w.hasGte && (
                  <span className="rounded bg-[#FBF3F4] px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                    + GTE
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Weapon render with glow — transparent, large, detailed */}
        <div
          className={`relative mx-auto overflow-hidden rounded-xl w-full ${
            isSm ? "my-1 h-28" : isMd ? "my-3 h-40 md:h-44" : size === "lg" ? "my-4 h-52 md:h-56" : "my-4 h-60 md:h-64"
          }`}
          style={{ background: "transparent", backgroundImage: "none" }}
        >
          {isDocCard ? (
            <div className="relative h-full w-full">
              {/* Folha de papel sutil para indicar documento */}
              <div className="absolute inset-2 rounded-md border border-slate-200 bg-white shadow-[0_6px_18px_-8px_rgba(15,23,42,0.25)] overflow-hidden">
                {docPreviewUrl && isDocImage ? (
                  <img
                    src={docPreviewUrl}
                    alt={`Documento ${w.source} enviado`}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : docPreviewUrl ? (
                  <object
                    data={`${docPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    type={w.documentPreview?.mime || "application/pdf"}
                    className="h-full w-full pointer-events-none"
                    aria-label={`Pré-visualização do ${w.source}`}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                      <FileText className="h-8 w-8" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">{w.source} ENVIADO</span>
                    </div>
                  </object>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
                    <FileText className="h-10 w-10" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{w.source} ENVIADO</span>
                  </div>
                )}
              </div>
              {/* Selo "DOC" sobreposto */}
              <span className="absolute right-3 top-3 rounded-sm border border-slate-300 bg-white/95 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-slate-700 shadow-sm">
                DOC · {w.source}
              </span>
            </div>
          ) : (() => {
            const isLonga = ["espingarda", "fuzil", "carabina", "submetralhadora"].includes(info.kind);
            const longaScale = info.kind === "espingarda"
              ? "scale-150 md:scale-[2.05]"
              : "scale-110 md:scale-[1.65]";
            return (
              <img
                src={render}
                alt={`${marca} ${modelo}`}
                loading="lazy"
                style={{ background: "transparent" }}
                className={`relative h-full w-full max-w-full object-contain px-2 py-3 drop-shadow-[0_10px_18px_rgba(15,23,42,0.25)] ${isLonga ? longaScale : ""}`}
              />
            );
          })()}
        </div>

        {/* Mini stats armory */}
        {!isSm && (
          <div className="grid min-h-[44px] grid-cols-3 gap-2 border-t border-slate-200 pt-2">
            {catalog ? (
              <>
                <MiniStat label="DMG" value={catalog.stat_dano} color="#ef4444" />
                <MiniStat label="PRC" value={catalog.stat_precisao} color="#0ea5e9" />
                <MiniStat label="MOB" value={catalog.stat_mobilidade} color="#10b981" />
              </>
            ) : (
              <div className="col-span-3" />
            )}
          </div>
        )}

        {!isSm && (
          <div className={`mt-2 grid min-h-[44px] grid-cols-3 gap-2 border-t border-slate-200 pt-2 ${isMd ? "text-[9px]" : "text-[10px]"}`}>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">CAL</div>
              <div className="font-bold text-slate-800">{calibre}</div>
            </div>
            {(() => {
              // Regra: "Nº do Registro" do CRAF SINARM NÃO é SIGMA.
              // Só rotulamos como SIGMA quando o regime é SIGMA explícito
              // (numero_registro_sigma presente). Caso contrário, exibimos
              // o Nº Cad. SINARM (quando houver) ou o Nº do Registro neutro.
              const regime = w.regime || (w.sistema_registro as any) || "REVISAR";
              if (regime === "SIGMA" && w.numero_registro_sigma) {
                return (
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">SIGMA</div>
                    <div className="truncate font-mono text-slate-700">{w.numero_registro_sigma}</div>
                  </div>
                );
              }
              if (w.numero_cad_sinarm) {
                return (
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Nº CAD. SINARM</div>
                    <div className="truncate font-mono text-slate-700">{w.numero_cad_sinarm}</div>
                  </div>
                );
              }
              return (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Nº REGISTRO</div>
                  <div className="truncate font-mono text-slate-700">{w.numero_sigma || "—"}</div>
                </div>
              );
            })()}
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">N° SÉRIE</div>
              <div className="truncate font-mono text-slate-700">{w.numero_arma || "—"}</div>
            </div>
          </div>
        )}

        <div className={`mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 ${isSm ? "text-[7px]" : isMd ? "text-[9px] min-h-[56px] content-start" : "text-[10px] min-h-[60px] content-start"}`}>
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider ${w.hasCraf ? "bg-emerald-50 text-emerald-700" : w.crafStatus === "revisar" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
            CRAF · {w.crafLabel || (w.hasCraf ? "VÁLIDO" : "AUSENTE")}
          </span>
          {(() => {
            const status: GtDocStatus = w.gtStatus
              || (w.gtDeclaradaNaoPossui ? "nao_possuo" : (w.hasGt ? "enviada" : "nao_enviada"));
            const t = gtChipTone(status);
            const cls = t === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : t === "warn"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600";
            return (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider ${cls}`}
                title="GT — Guia de Tráfego (retirada/transporte inicial da loja). Documento histórico, não é GTE.">
                GT · {GT_STATUS_LABEL[status]}
              </span>
            );
          })()}
          {(() => {
            const regime = w.regime || "REVISAR";
            // Regra: NÃO EXIGÍVEL só para SINARM. SIGMA sem GTE = AUSENTE/VENCIDA.
            // REVISAR (regime indefinido) = REVISAR REGIME.
            let label: string;
            let cls: string;
            if (regime === "SINARM") {
              label = w.hasGte ? (w.gteLabel || "ATIVA") : "NÃO EXIGÍVEL";
              cls = w.hasGte ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
            } else if (regime === "REVISAR") {
              label = "REVISAR REGIME";
              cls = "bg-amber-50 text-amber-700";
            } else {
              // SIGMA — GTE é exigível.
              label = w.gteLabel || (w.hasGte ? "ATIVA" : "AUSENTE");
              cls = w.hasGte
                ? "bg-emerald-50 text-emerald-700"
                : w.gteStatus === "revisar"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700";
            }
            return (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider ${cls}`}
                title="GTE — Guia de Tráfego Especial (SIGMA/CAC). Aplicável conforme regime do acervo.">
                GTE · {label}
              </span>
            );
          })()}
          {(() => {
            const regime = w.regime || "REVISAR";
            const cls = regime === "SIGMA"
              ? "bg-[#7A1F2B]/10 text-[#7A1F2B] border border-[#7A1F2B]/30"
              : regime === "SINARM"
                ? "bg-slate-900 text-white"
                : "bg-amber-50 text-amber-800 border border-amber-300";
            const label = regime === "SIGMA" ? "SIGMA" : regime === "SINARM" ? "SINARM" : "REVISAR";
            return (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider ${cls}`}
                title="Regime do registro da arma — define exigibilidade da GTE.">
                SISTEMA · {label}
              </span>
            );
          })()}
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-700">
            MUN · {(ammoCount ?? 0).toLocaleString("pt-BR")}
          </span>
        </div>

        {!isSm && (
          <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-[#7A1F2B] ml-auto">
              INSPECIONAR <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div>
      <div className="flex items-center justify-between text-[8px]">
        <span className="font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-slate-700">{value ?? "—"}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color, boxShadow: `0 0 6px ${color}66` }} />
      </div>
    </div>
  );
}

function DocumentTag({ d }: { d: DocCard }) {
  const tone = urgencyTone(d.daysToExpire);
  const c = toneClasses[tone];
  const accent =
    tone === "ok" ? "#10b981"
    : tone === "warn" ? "#f59e0b"
    : tone === "danger" ? "#ef4444"
    : "#0ea5e9";
  return (
    <div className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: accent, boxShadow: `0 0 8px ${accent}55` }} />
      <button
        type="button"
        onClick={d.onOpen}
        className="flex flex-1 items-center gap-2.5 text-left min-w-0"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FBF3F4] text-[#7A1F2B]">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
              {d.category}
            </span>
            <span className={`rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase ${c.chip}`}>
              {urgencyText(d.daysToExpire)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide text-slate-800">{d.title}</div>
        </div>
      </button>
      {d.onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); d.onDelete?.(); }}
          aria-label="Excluir documento"
          title="Excluir"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Wrapper sortable em volta do WeaponCard. O drag dispara apenas após
 * mover ~6px (PointerSensor activationConstraint), então o clique normal
 * para abrir o drawer continua funcionando.
 */
function SortableWeaponCard({
  id,
  ...rest
}: {
  id: string;
  w: WorkbenchWeapon;
  info: WeaponInfo;
  catalog: ArmamentoCatalogo | null;
  onClick: () => void;
  size?: "lg" | "md" | "sm";
  ammoCount?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <WeaponCard {...rest} />
    </div>
  );
}

export function Workbench({ weapons, documents, ammoByCalibre, onSelectWeapon, headerAction }: Props) {
  const [showAll, setShowAll] = useState(false);
  const { match, byId, resolveCraf, loading: catLoading } = useArmamentoCatalogo();
  const { size: cardSize, setSize: setCardSize } = useArsenalCardSize();
  // Ordem manual dos cards (drag & drop) — persistida por cliente em localStorage.
  // Chave única usa qualquer cliente_id disponível na lista de armas (todas as
  // armas exibidas pertencem ao mesmo cliente neste contexto).
  const orderStorageKey = "qa_arsenal_workbench_order";
  const [manualOrder, setManualOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(orderStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const persistOrder = (next: string[]) => {
    setManualOrder(next);
    try {
      window.localStorage.setItem(orderStorageKey, JSON.stringify(next));
    } catch {
      // ignora
    }
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // Mapeia o tamanho global do Arsenal (lg/md/sm) para o tamanho do card da bancada.
  // Cards "longos" usam lg por padrão; quando o cliente escolhe md/sm, reduzimos.
  const longaSize: "lg" | "md" | "sm" = cardSize === "sm" ? "sm" : cardSize === "md" ? "md" : "lg";
  const curtaSize: "lg" | "md" | "sm" = cardSize === "sm" ? "sm" : "md";
  // No mobile (440px) o grid normalmente é 1 coluna — para o toggle ter efeito
  // visual real, aumentamos a quantidade de colunas conforme o tamanho diminui.
  const curtaCols =
    cardSize === "sm"
      ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      : cardSize === "md"
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  const longaCols =
    cardSize === "sm"
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      : cardSize === "md"
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2";

  const enriched = useMemo(
    () => weapons.map((w) => ({
      w,
      info: buildWeaponInfo(w.nome_arma, w.numero_arma, w.arma_especie || null),
      // Catálogo é enriquecimento visual, nunca fonte de verdade para marca/modelo.
      catalog: byId(w.catalogo_id || null) || match(w.nome_arma),
    })),
    [weapons, match, byId],
  );

  // Total de munições por calibre usando a mesma normalização forte da KPI CALIBRES.
  const ammoCountFor = (calibre: string | null | undefined): number => {
    const target = normalizeCalibre(calibre);
    if (!target) return 0;
    return ammoByCalibre
      .filter((a) => normalizeCalibre(a.calibre) === target)
      .reduce((s, a) => s + a.quantidade, 0);
  };

  // Para CRAFs/GTEs ainda não vinculados ao catálogo: dispara resolução IA (1× por arma).
  useEffect(() => {
    if (catLoading) return;
    enriched.forEach(({ w }) => {
      if (!w.catalogo_id && w.nome_arma) {
        if (w.source === "CRAF" && typeof w.id === "number") {
          resolveCraf({ craf_id: w.id });
        } else if (w.source === "GTE" && typeof w.id === "number") {
          resolveCraf({ gte_id: w.id });
        } else {
          resolveCraf({ nome_arma: w.nome_arma });
        }
      }
    });
  }, [enriched, catLoading, resolveCraf]);

  const longas = enriched.filter((e) => ["fuzil", "carabina", "espingarda"].includes(e.info.kind));
  const curtas = enriched.filter((e) => ["pistola", "revolver", "submetralhadora"].includes(e.info.kind));
  const outras = enriched.filter((e) => e.info.kind === "outra");

  const grupoCurtas = [...curtas, ...outras];
  // Aplica a ordem manual salva (qualquer item não listado fica no final, na ordem original).
  const applyManualOrder = <T extends { w: { source: string; id: number | string } }>(items: T[]): T[] => {
    if (!manualOrder.length) return items;
    const keyOf = (e: T) => `${e.w.source}-${e.w.id}`;
    const idx = new Map(manualOrder.map((k, i) => [k, i]));
    return [...items].sort((a, b) => {
      const ia = idx.has(keyOf(a)) ? (idx.get(keyOf(a)) as number) : Number.MAX_SAFE_INTEGER;
      const ib = idx.has(keyOf(b)) ? (idx.get(keyOf(b)) as number) : Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  };
  const longasOrdered = applyManualOrder(longas);
  const curtasOrdered = applyManualOrder(grupoCurtas);
  const visibleLongas = showAll ? longasOrdered : longasOrdered.slice(0, 2);
  const visibleCurtas = showAll ? curtasOrdered : curtasOrdered.slice(0, 4);
  const overflow = longas.length + grupoCurtas.length - (visibleLongas.length + visibleCurtas.length);

  const handleDragEnd =
    (items: typeof longas) =>
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = items.map((e) => `${e.w.source}-${e.w.id}`);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const reorderedIds = arrayMove(ids, oldIndex, newIndex);
      // Mescla com a ordem global mantendo demais grupos intactos.
      const allKeys = enriched.map((e) => `${e.w.source}-${e.w.id}`);
      const fullOrder = [
        ...reorderedIds,
        ...allKeys.filter((k) => !reorderedIds.includes(k)),
      ];
      persistOrder(fullOrder);
    };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Top HUD strip */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF3F4] text-[#7A1F2B] ring-1 ring-[#7A1F2B]">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-900">
              ARMORY · BANCADA TÁTICA
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Arsenal interpretado a partir do seu cadastro</div>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600">
            <Radio className="h-3 w-3 animate-pulse" />
            ONLINE
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {enriched.length.toString().padStart(2, "0")} ITEM(S)
          </div>
          {manualOrder.length > 0 && (
            <button
              type="button"
              onClick={() => persistOrder([])}
              title="Restaurar ordem padrão"
              className="text-[9px] font-bold uppercase tracking-wider text-slate-500 underline hover:text-[#7A1F2B]"
            >
              Restaurar ordem
            </button>
          )}
          <ArsenalCardSizeToggle size={cardSize} onChange={setCardSize} />
          {headerAction}
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {manualOrder.length > 0 && (
            <button
              type="button"
              onClick={() => persistOrder([])}
              title="Restaurar ordem padrão"
              className="text-[9px] font-bold uppercase tracking-wider text-slate-500 underline"
            >
              Restaurar
            </button>
          )}
          <ArsenalCardSizeToggle size={cardSize} onChange={setCardSize} />
          {headerAction}
        </div>
      </div>

      {/* Bench body */}
      <div className="relative px-4 py-6 md:px-6 md:py-7">
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(14,165,233,0.06), transparent 70%)" }}
        />

        {enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <ShieldAlert className="h-10 w-10 text-slate-300" />
            <div className="max-w-xl">
              <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">
                CADASTRE SEU PRIMEIRO ARMAMENTO
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Para organizar seu Arsenal, envie os documentos principais da arma.
                Você poderá cadastrar CRAF, GT e GTE quando aplicável.
              </p>
              <div className="mt-3 grid gap-2 text-left sm:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-white p-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">CRAF</div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    Certificado de Registro de Arma de Fogo. Identifica a arma, titular,
                    nº de série, calibre e validade. <b>Documento principal.</b>
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-700">GT</div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    Guia usada para retirar a arma da loja e transportar até o destino
                    autorizado. Documento histórico — se não tiver mais, é possível declarar.
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#7A1F2B]">GTE</div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-600">
                    Guia de Tráfego Especial. Pode ser exigida em acervos vinculados ao
                    SIGMA/CAC, conforme o regime do acervo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative space-y-4">
            {visibleLongas.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(longasOrdered)}>
                <SortableContext items={visibleLongas.map((e) => `${e.w.source}-${e.w.id}`)} strategy={rectSortingStrategy}>
                  <div className={`grid gap-3 ${longaCols}`}>
                    {visibleLongas.map(({ w, info, catalog }) => (
                      <SortableWeaponCard
                        key={`${w.source}-${w.id}`}
                        id={`${w.source}-${w.id}`}
                        w={w}
                        info={info}
                        catalog={catalog}
                        onClick={() => onSelectWeapon(w, info)}
                        size={longaSize}
                        ammoCount={ammoCountFor(catalog?.calibre || info.calibre)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {visibleCurtas.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(curtasOrdered)}>
                <SortableContext items={visibleCurtas.map((e) => `${e.w.source}-${e.w.id}`)} strategy={rectSortingStrategy}>
                  <div className={`grid gap-3 ${curtaCols}`}>
                    {visibleCurtas.map(({ w, info, catalog }) => (
                      <SortableWeaponCard
                        key={`${w.source}-${w.id}`}
                        id={`${w.source}-${w.id}`}
                        w={w}
                        info={info}
                        catalog={catalog}
                        onClick={() => onSelectWeapon(w, info)}
                        size={curtaSize}
                        ammoCount={ammoCountFor(catalog?.calibre || info.calibre)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {overflow > 0 && !showAll && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded-full border border-[#E5C2C6] bg-[#FBF3F4] px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A1F2B] hover:bg-[#FBF3F4]"
                >
                  Ver todos (+{overflow})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Caixas de munição + cartões de documento (rodapé da bancada) */}
        <div className="relative mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-700">
                Munições · Por Calibre
              </div>
            </div>
            {ammoByCalibre.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
                Nenhuma munição cadastrada
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ammoByCalibre.slice(0, 6).map((a) => (
                  <div
                    key={a.calibre}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      {a.calibre}
                    </div>
                    <div className="mt-0.5 font-mono text-[15px] font-bold text-slate-900">
                      {a.quantidade.toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7A1F2B] to-[#641722]"
                        style={{ width: `${Math.min(100, (a.quantidade / 200) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}