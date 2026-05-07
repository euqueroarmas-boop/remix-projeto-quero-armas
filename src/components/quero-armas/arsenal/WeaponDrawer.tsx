import { X, ShieldCheck, Calendar, Hash, FileBadge, Crosshair, Layers, AlertTriangle, Gauge, Weight, Ruler, Zap, MapPin, BadgeCheck, Trash2, Loader2, Eye, Download } from "lucide-react";
import { WeaponSilhouette } from "./WeaponSilhouette";
import { backgroundForKind, renderForKind } from "./weaponAssets";
import {
  buildWeaponInfo,
  maskSerial,
  TACTICAL,
  urgencyTone,
  WEAPON_KIND_LABEL,
  GT_STATUS_LABEL,
  gtChipTone,
  type GtDocStatus,
  type WeaponRegime,
} from "./utils";
import { declararNaoPossuoGt, reverterDeclaracaoGt } from "./gtDeclaracoes";
import { toast } from "sonner";
import type { WorkbenchWeapon } from "./Workbench";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";
import { useEffect, useMemo, useState } from "react";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";
import { supabase } from "@/integrations/supabase/client";

interface RelatedDoc {
  category: string;
  title: string;
  date: string | null;
  bucket?: string;
  path?: string | null;
  fileName?: string | null;
}

interface Props {
  open: boolean;
  weapon: WorkbenchWeapon | null;
  relatedDocs: RelatedDoc[];
  ammoSameCalibre: number;
  onClose: () => void;
  onDelete?: (weapon: WorkbenchWeapon) => Promise<void> | void;
  /** Cliente atual — usado para persistir a declaração "não possuo mais a GT". */
  clienteId?: number | string;
  /** Notifica o pai para recarregar dados após declaração. */
  onGtDeclaracaoChange?: () => void;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const p = new Date(d);
    return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

export function WeaponDrawer({ open, weapon, relatedDocs, ammoSameCalibre, onClose, onDelete, clienteId, onGtDeclaracaoChange }: Props) {
  const { items, match } = useArmamentoCatalogo();
  const viewer = useDocumentoViewer();
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gtConfirm, setGtConfirm] = useState(false);
  const [gtSaving, setGtSaving] = useState(false);
  useEffect(() => { setConfirmDel(false); setDeleting(false); }, [weapon?.id, open]);
  const info = weapon ? buildWeaponInfo(weapon.nome_arma, weapon.numero_arma) : null;
  const catalog: ArmamentoCatalogo | null = useMemo(
    () => (weapon ? match(weapon.nome_arma) : null),
    [weapon, match],
  );
  const variants = useMemo(() => {
    if (!info) return [] as ArmamentoCatalogo[];
    return items.filter((it) => it.tipo === info.kind && (!catalog || it.id !== catalog.id)).slice(0, 4);
  }, [items, info, catalog]);

  // Lock background scroll while drawer is open + ESC to close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !weapon || !info) return null;
  const tone = urgencyTone(weapon.daysToExpire);

  const sanitizeFs = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();

  const friendlyName = (category: string, originalName?: string | null, doc?: RelatedDoc) => {
    // Extensão: preserva original se houver, senão tenta inferir, fallback .pdf
    const ext = (() => {
      const m = (originalName || "").match(/\.([A-Za-z0-9]{2,5})$/);
      if (m) return `.${m[1].toLowerCase()}`;
      const lower = (originalName || "").toLowerCase();
      if (lower.includes("png")) return ".png";
      if (lower.includes("jpg") || lower.includes("jpeg")) return ".jpg";
      return ".pdf";
    })();

    const cat = sanitizeFs(category || "DOCUMENTO");
    const marca = sanitizeFs(catalog?.marca || info?.marca || "");
    const modeloRaw = catalog?.modelo || info?.modelo || "";
    const modelo = sanitizeFs(modeloRaw);
    const calibreRaw = catalog?.calibre || info?.calibre || "";
    const calibre = sanitizeFs(calibreRaw);
    const serie = sanitizeFs(weapon!.numero_arma || "");
    const sigma = sanitizeFs(weapon!.numero_sigma || "");

    const armParts: string[] = [];
    if (marca) armParts.push(marca);
    if (modelo && modelo !== marca) armParts.push(modelo);
    if (calibre) armParts.push(`CAL_${calibre}`);
    if (serie) armParts.push(`SERIE_${serie}`);
    else if (sigma) armParts.push(`SIGMA_${sigma}`);

    let body = armParts.join("_");
    if (!body) {
      // Sem dados da arma — tentar título / fileName / fallback
      const titleSan = sanitizeFs(doc?.title || "");
      const origSan = sanitizeFs((originalName || "").replace(/\.[A-Za-z0-9]{2,5}$/, ""));
      body = titleSan || origSan || "DOCUMENTO_ARMA";
    }

    const finalName = `${cat}_${body}`
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `${finalName || "DOCUMENTO_ARMA"}${ext}`;
  };

  const handleDownload = async (d: RelatedDoc) => {
    if (!d.path) return;
    try {
      const { data, error } = await supabase.storage
        .from(d.bucket || "qa-documentos")
        .download(d.path);
      if (error || !data) throw error || new Error("download_failed");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = friendlyName(d.category, d.fileName, d);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar arquivo.");
    }
  };

  const accent =
    tone === "ok"
      ? TACTICAL.ok
      : tone === "warn"
      ? TACTICAL.warn
      : tone === "danger"
      ? TACTICAL.danger
      : TACTICAL.cyan;

  const displayMarca = catalog?.marca || info.marca || info.label;
  const displayModelo = catalog?.modelo || info.modelo || "";
  const displayCalibre = catalog?.calibre || info.calibre || "—";

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center">
      <aside
        className="relative flex h-full w-full flex-col overflow-y-auto overscroll-contain text-slate-900 bg-slate-50 shadow-2xl"
      >
        {/* Top bar estilo ARMORY */}
        <div className="relative flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 backdrop-blur shadow-sm">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-[#7A1F2B]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#7A1F2B]">
              ARMORY
            </span>
            <span className="ml-2 text-[9px] font-mono text-slate-400">
              / {WEAPON_KIND_LABEL[info.kind]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hero + status */}
        <div className="relative px-6 pt-5">
          {/* Marquee do nome (estilo CoD) */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[28px] font-black uppercase tracking-tight leading-none text-slate-900">
                {displayMarca}
              </div>
              <div className="mt-0.5 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
                {displayModelo || displayCalibre}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
              >
                <BadgeCheck className="h-3 w-3" />
                {weapon.source === "CRAF" ? "REGISTRADA" : "EM TRÁFEGO"}
              </span>
              {catalog && (
                <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  ★ BLUEPRINT
                </span>
              )}
            </div>
          </div>

          {/* Hero da arma com glow */}
          <div
            className="relative mt-4 h-[26rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="relative flex h-full items-center justify-center px-2 py-2">
              <img
                src={catalog?.imagem || renderForKind(info.kind)}
                alt={`${displayMarca} ${displayModelo}`}
                style={{ background: "transparent" }}
                className={
                  ["espingarda", "fuzil", "carabina", "submetralhadora"].includes(info.kind)
                    ? "h-auto max-h-full w-full max-w-[98%] object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                    : "h-full w-full max-w-full object-contain px-2 py-3 drop-shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                }
              />
            </div>
          </div>

          {/* Validade pill */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className="rounded-sm px-2 py-1 font-bold uppercase tracking-wider"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
            >
              {weapon.daysToExpire === null
                ? "SEM DATA"
                : weapon.daysToExpire < 0
                ? `VENCIDO ${Math.abs(weapon.daysToExpire)}D`
                : weapon.daysToExpire === 0
                ? "VENCE HOJE"
                : `${weapon.daysToExpire}D RESTANTES`}
            </span>
            <span className="rounded-sm bg-slate-100 px-2 py-1 font-mono text-slate-700">
              {formatDate(weapon.data_validade)}
            </span>
            {catalog?.classificacao_legal && (
              <span className="rounded-sm bg-slate-100 px-2 py-1 font-bold uppercase tracking-wider text-slate-700">
                {catalog.classificacao_legal}
              </span>
            )}
            {catalog?.origem && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-slate-100 px-2 py-1 font-bold uppercase tracking-wider text-slate-700">
                <MapPin className="h-3 w-3" /> {catalog.origem}
              </span>
            )}
          </div>
        </div>

        {/* WEAPON DETAILS — Stats estilo armory */}
        {catalog && (
          <div className="mt-5 px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
                Weapon Details
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <StatBar label="Damage"     value={catalog.stat_dano} accent="#ef4444" />
              <StatBar label="Precision"  value={catalog.stat_precisao} accent="#22d3ee" />
              <StatBar label="Range"      value={catalog.stat_alcance} accent="#a78bfa" />
              <StatBar label="Fire Rate"  value={catalog.stat_cadencia} accent="#f59e0b" />
              <StatBar label="Mobility"   value={catalog.stat_mobilidade} accent="#10b981" />
              <StatBar label="Control"    value={catalog.stat_controle} accent="#f472b6" />
            </div>
          </div>
        )}

        {/* Specs técnicos */}
        <div className="mt-4 grid grid-cols-2 gap-2 px-6">
          <SpecCell icon={<Hash className="h-3 w-3" />}    label="SIGMA"     value={weapon.numero_sigma || "—"} />
          <SpecCell icon={<FileBadge className="h-3 w-3" />} label="Nº SÉRIE" value={weapon.numero_arma || "—"} />
          <SpecCell icon={<Crosshair className="h-3 w-3" />} label="CALIBRE"  value={displayCalibre} />
          <SpecCell icon={<Calendar className="h-3 w-3" />}  label="VALIDADE" value={formatDate(weapon.data_validade)} />
          {catalog?.capacidade_carregador && (
            <SpecCell icon={<Layers className="h-3 w-3" />} label="CAPACIDADE" value={`${catalog.capacidade_carregador} TIROS`} />
          )}
          {catalog?.peso_gramas && (
            <SpecCell icon={<Weight className="h-3 w-3" />} label="PESO" value={`${catalog.peso_gramas} G`} />
          )}
          {catalog?.comprimento_cano_mm && (
            <SpecCell icon={<Ruler className="h-3 w-3" />} label="CANO" value={`${catalog.comprimento_cano_mm} MM`} />
          )}
          {catalog?.alcance_efetivo_m && (
            <SpecCell icon={<Crosshair className="h-3 w-3" />} label="ALCANCE EFETIVO" value={`${catalog.alcance_efetivo_m} M`} />
          )}
          {catalog?.velocidade_projetil_ms && (
            <SpecCell icon={<Zap className="h-3 w-3" />} label="VELOCIDADE" value={`${catalog.velocidade_projetil_ms} M/S`} />
          )}
        </div>

        {catalog?.descricao && (
          <p className="mt-4 px-6 text-[11px] leading-relaxed text-slate-600">
            {catalog.descricao}
          </p>
        )}

        {/* Variantes do mesmo tipo (estilo Sand Snake / Bengal / Piercer) */}
        {variants.length > 0 && (
          <div className="mt-5 px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
                Outras opções · {WEAPON_KIND_LABEL[info.kind]}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="group relative overflow-hidden rounded-md border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:border-[#7A1F2B]"
                >
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    {v.marca}
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 leading-tight">
                    {v.modelo}
                  </div>
                  <div className="mt-0.5 text-[9px] font-mono text-[#7A1F2B]">{v.calibre}</div>
                  <div className="mt-1 h-20 overflow-hidden rounded-md" style={{ background: "transparent", backgroundImage: "none" }}>
                    <img
                      src={v.imagem || renderForKind(v.tipo as any)}
                      alt={v.modelo}
                      className="h-full w-[112%] max-w-none -translate-x-[6%] object-contain opacity-95"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Munições compatíveis */}
        <div className="mt-5 px-6">
          <div className="mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
              Estoque · Mesmo calibre
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {displayCalibre}
              </div>
              <div className="font-mono text-2xl font-bold text-slate-900">
                {ammoSameCalibre.toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              {ammoSameCalibre === 0
                ? "Sem munição cadastrada"
                : "Munições disponíveis"}
            </div>
          </div>
        </div>

        {/* Documentos vinculados */}
        <div className="mt-5 px-6 pb-8">
          <div className="mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
              Documentos da arma
            </div>
          </div>

          {/* Bloco REGIME — SIGMA / SINARM / REVISAR */}
          {weapon && (() => {
            const regime: WeaponRegime = (weapon.regime as WeaponRegime) || "REVISAR";
            const regimeLabel = regime === "SIGMA"
              ? "SIGMA / CAC"
              : regime === "SINARM"
                ? "SINARM / DEFESA PESSOAL"
                : "REGIME INDEFINIDO — REVISAR CADASTRO";
            const exigivel = regime === "SIGMA";
            const motivo = regime === "SIGMA"
              ? "Acervo SIGMA/CAC: GTE é documento permanente exigível."
              : regime === "SINARM"
                ? "Registro SINARM para defesa pessoal: GTE não é exigível como documento permanente."
                : "Sem indício confiável (sistema, finalidade, GT/GTE ou nº SIGMA). Revisar o cadastro da arma.";
            const cls = regime === "SIGMA"
              ? "border-[#7A1F2B]/30 bg-[#FBF3F4] text-[#7A1F2B]"
              : regime === "SINARM"
                ? "border-slate-300 bg-slate-50 text-slate-800"
                : "border-amber-300 bg-amber-50 text-amber-900";
            return (
              <div className={`mb-3 rounded-md border p-3 shadow-sm ${cls}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                    REGIME DA ARMA
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                    {regimeLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug">
                  GTE / Guia · <b>{exigivel ? "EXIGÍVEL" : regime === "SINARM" ? "NÃO EXIGÍVEL" : "REVISAR REGIME"}</b>
                  {" "}— {motivo}
                </p>
              </div>
            );
          })()}

          {/* Bloco GT — Guia de Tráfego (retirada/transporte inicial) */}
          {weapon && (() => {
            const gtStatus: GtDocStatus = (weapon.gtStatus as GtDocStatus | undefined)
              || (weapon.gtDeclaradaNaoPossui ? "nao_possuo" : (weapon.hasGt ? "enviada" : "nao_enviada"));
            const tone = gtChipTone(gtStatus);
            const cls = tone === "ok"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : tone === "warn"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-600 border-slate-200";
            const podeDeclarar = gtStatus === "nao_enviada";
            const cidNum =
              typeof clienteId === "number" ? clienteId : Number(clienteId);
            const cidValid = Number.isFinite(cidNum);
            const declarar = async () => {
              if (!cidValid) {
                toast.error("Cliente inválido para registrar a declaração.");
                return;
              }
              setGtSaving(true);
              try {
                await declararNaoPossuoGt({ clienteId: cidNum as number, weapon });
                setGtConfirm(false);
                toast.success("Declaração registrada para a Equipe Quero Armas.");
                onGtDeclaracaoChange?.();
              } catch (e: any) {
                toast.error(e?.message || "Não foi possível registrar a declaração.");
              } finally {
                setGtSaving(false);
              }
            };
            const reverter = async () => {
              if (!cidValid) return;
              setGtSaving(true);
              try {
                await reverterDeclaracaoGt({ clienteId: cidNum as number, weapon });
                toast.success("Declaração revertida.");
                onGtDeclaracaoChange?.();
              } catch (e: any) {
                toast.error(e?.message || "Não foi possível reverter a declaração.");
              } finally {
                setGtSaving(false);
              }
            };
            const declaradaEm = (weapon as any).gtDeclaradaEm as string | null | undefined;
            return (
              <div className="mb-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700">GT</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}>
                      {GT_STATUS_LABEL[gtStatus]}
                    </span>
                  </div>
                  {gtStatus === "nao_possuo" && (
                    <button
                      type="button"
                      onClick={reverter}
                      disabled={gtSaving}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-500 underline hover:text-[#7A1F2B]"
                    >
                      Reverter declaração
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                  GT é a guia de retirada da arma na loja e do transporte inicial até o
                  destino autorizado. Documento histórico — sua ausência <b>não bloqueia</b>
                  o cadastro da arma e <b>não gera alerta crítico</b>.
                </p>
                {gtStatus === "nao_possuo" && (
                  <p className="mt-1 text-[10px] italic text-slate-500">
                    Cliente declarou que não possui mais este documento. Registrado para
                    análise documental da Equipe Quero Armas{declaradaEm ? ` · ${formatDate(declaradaEm)}` : ""}.
                  </p>
                )}
                {gtStatus === "nao_possuo" && (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Declaração já registrada"
                    className="mt-2 inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    Declaração já registrada
                  </button>
                )}
                {podeDeclarar && (
                  !gtConfirm ? (
                    <button
                      type="button"
                      onClick={() => setGtConfirm(true)}
                      disabled={gtSaving}
                      className="mt-2 inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Não possuo mais a GT
                    </button>
                  ) : (
                    <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2">
                      <p className="text-[11px] text-amber-900">
                        Tudo bem. Vamos registrar que você não possui mais a GT. Essa
                        informação não impedirá o cadastro da arma, mas ficará registrada
                        para análise documental da Equipe Quero Armas.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={declarar}
                          disabled={gtSaving}
                          className="rounded bg-amber-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-amber-700"
                        >
                          {gtSaving ? "Registrando…" : "Confirmar declaração"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setGtConfirm(false)}
                          disabled={gtSaving}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            );
          })()}

          {relatedDocs.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Nenhum documento vinculado a esta arma.
            </div>
          ) : (
            <div className="space-y-1.5">
              {relatedDocs.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-[#FBF3F4] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#7A1F2B] border border-[#E5C2C6]">
                      {d.category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800">{d.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.path ? (
                      <>
                        <button
                          type="button"
                          onClick={() => viewer.abrirStorage(d.bucket || "qa-documentos", d.path!, { fileName: friendlyName(d.category, d.fileName), title: `${d.category} · ${d.title}` })}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                          title="Visualizar arquivo original"
                        >
                          <Eye className="h-3 w-3" /> Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(d)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                          title={`Baixar ${friendlyName(d.category, d.fileName)}`}
                        >
                          <Download className="h-3 w-3" /> Baixar
                        </button>
                      </>
                    ) : (["CRAF", "GTE"].includes(d.category) && d.date) ? (
                      <span
                        className="text-[9px] uppercase tracking-wider text-amber-700"
                        title="Documento cadastrado, mas o arquivo original não foi localizado."
                      >
                        sem arquivo
                      </span>
                    ) : null}
                    <span className="font-mono text-[10px] text-slate-500">{formatDate(d.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Viewer interno (blob) — nunca expõe URL do storage */}
        <DocumentoViewerModal
          open={viewer.open}
          onClose={viewer.fechar}
          source={viewer.source}
          title={viewer.title}
        />

        {/* Zona de risco — Excluir armamento */}
        {onDelete && (
          <div className="mt-2 border-t border-slate-200 px-6 py-5">
            <div className="mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-700">
                Zona de Risco
              </div>
            </div>
            {!confirmDel ? (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir este armamento
              </button>
            ) : (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3">
                <p className="text-[11px] text-rose-800">
                  Tem certeza? Esta ação remove o registro <b>{displayMarca} {displayModelo}</b>{" "}
                  {weapon.numero_arma ? <>(série <span className="font-mono">{weapon.numero_arma}</span>)</> : null}
                  {" "}e seus documentos vinculados. Não pode ser desfeita.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!weapon || !onDelete) return;
                      try {
                        setDeleting(true);
                        await onDelete(weapon);
                        onClose();
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Sim, excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(false)}
                    disabled={deleting}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function StatBar({ label, value, accent }: { label: string; value: number | null; accent: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="grid grid-cols-[80px_1fr_28px] items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${accent}cc, ${accent})`, boxShadow: `0 0 6px ${accent}55` }}
        />
        {/* tick marks */}
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-white/70 last:border-r-0" />
          ))}
        </div>
      </div>
      <span className="text-right font-mono text-[9px] text-slate-700">{value ?? "—"}</span>
    </div>
  );
}

function SpecCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[12px] font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}