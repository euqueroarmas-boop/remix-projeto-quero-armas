import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, AlertTriangle, RotateCcw, Clock, Trophy, BarChart3, Edit3, Trash2, Sparkles, Play, Timer, X, History } from "lucide-react";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */
interface CipaCycle {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_days: number | null;
  duration_seconds: number | null;
  duration_label: string | null;
  note: string | null;
  is_current: boolean;
}

/* ── Helpers ── */
function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function durationText(ms: number) {
  const { days, hours, minutes } = formatDuration(ms);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
}

function durationLabelFull(ms: number) {
  const { days, hours, minutes, seconds } = formatDuration(ms);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} dia${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

/* ── Component ── */
const CipaPage = () => {
  const [currentCycle, setCurrentCycle] = useState<CipaCycle | null>(null);
  const [history, setHistory] = useState<CipaCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showConfirmInterrupt, setShowConfirmInterrupt] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [interruptNote, setInterruptNote] = useState("");
  const [editingStart, setEditingStart] = useState(false);
  const [editStartValue, setEditStartValue] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const fetchData = useCallback(async () => {
    const { data: all } = await supabase
      .from("cipa_cycles")
      .select("*")
      .order("started_at", { ascending: true });
    if (all) {
      const current = all.find((c: any) => c.is_current);
      const past = all.filter((c: any) => !c.is_current);
      setCurrentCycle(current as CipaCycle || null);
      setHistory(past as CipaCycle[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // PWA manifest
  useEffect(() => {
    let link = document.querySelector('link[rel="manifest"][data-cipa]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.setAttribute("data-cipa", "true");
      link.href = "/cipa-manifest.json";
      document.head.appendChild(link);
    }
    let meta = document.querySelector('meta[name="theme-color"][data-cipa]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.setAttribute("data-cipa", "true");
      meta.content = "#F43F5E";
      document.head.appendChild(meta);
    }
    let metaCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]') as HTMLMetaElement | null;
    if (!metaCapable) {
      metaCapable = document.createElement("meta");
      metaCapable.name = "apple-mobile-web-app-capable";
      metaCapable.content = "yes";
      document.head.appendChild(metaCapable);
    }
    return () => { link?.remove(); meta?.remove(); metaCapable?.remove(); };
  }, []);

  const elapsed = currentCycle ? now - new Date(currentCycle.started_at).getTime() : 0;
  const { days, hours, minutes, seconds } = formatDuration(elapsed);
  const totalHoursRaw = Math.floor(elapsed / 3600000);

  const handleInterrupt = useCallback(async () => {
    if (!currentCycle || saving) return;
    setSaving(true);
    const endedAt = new Date().toISOString();
    const ms = new Date(endedAt).getTime() - new Date(currentCycle.started_at).getTime();
    const durDays = Math.floor(ms / 86400000);
    const durSeconds = Math.floor(ms / 1000);
    const label = durationLabelFull(ms);
    await supabase.from("cipa_cycles").update({
      is_current: false, ended_at: endedAt, duration_days: durDays,
      duration_seconds: durSeconds, duration_label: label,
      note: interruptNote.trim() || null, updated_at: endedAt,
    }).eq("id", currentCycle.id);
    await supabase.from("cipa_cycles").insert({ started_at: endedAt, is_current: true });
    setShowConfirmInterrupt(false);
    setInterruptNote("");
    setSaving(false);
    await fetchData();
  }, [currentCycle, interruptNote, saving, fetchData]);

  const handleResetAll = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    await supabase.from("cipa_cycles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("cipa_cycles").insert({ started_at: new Date().toISOString(), is_current: true });
    setShowConfirmReset(false);
    setSaving(false);
    await fetchData();
  }, [saving, fetchData]);

  const handleEditStart = useCallback(async () => {
    if (!currentCycle) return;
    const d = new Date(editStartValue);
    if (!isNaN(d.getTime())) {
      await supabase.from("cipa_cycles").update({
        started_at: d.toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", currentCycle.id);
      await fetchData();
    }
    setEditingStart(false);
  }, [editStartValue, currentCycle, fetchData]);

  const handleDeleteCycle = useCallback(async (id: string) => {
    await supabase.from("cipa_cycles").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  const durations = history.map(c => (c.duration_seconds || 0) * 1000);
  const bestStreak = durations.length > 0 ? Math.max(...durations) : 0;
  const avgStreak = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const totalInterruptions = history.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50" style={{ height: "100dvh" }}>
        <div className="animate-pulse text-rose-400 text-base font-medium">Carregando...</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 overflow-hidden"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      <SeoHead title="CIPA — Contador de Dias" description="Acompanhe dias sem briga" noindex />

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-3 pt-3 pb-2 overflow-hidden">
        {/* Header — compact */}
        <div className="text-center mb-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 backdrop-blur border border-rose-200 mb-1.5">
            <Heart className="w-3 h-3 text-rose-500" fill="currentColor" />
            <span className="text-[10px] font-semibold text-rose-700 tracking-wide uppercase">CIPA</span>
          </div>
          <h1 className="text-base font-bold text-gray-800 leading-tight">Contador de Dias sem Briga</h1>
          <p className="mt-0.5 text-xs italic text-rose-400/80 tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>Bate-Seva &amp; Davão</p>
        </div>

        {/* Main counter — compact */}
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg shadow-rose-100/50 border border-rose-100 px-4 py-3 mb-2 text-center shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-amber-500/5" />
          <div className="relative">
            <Sparkles className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <div className="text-5xl font-extrabold text-gray-800 tabular-nums leading-none">{days}</div>
            <p className="text-sm text-gray-500 font-medium mt-0.5">{days === 1 ? "dia" : "dias"} sem briga</p>
            {currentCycle && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Desde {formatDate(currentCycle.started_at)}</span>
                  <button
                    onClick={() => { setEditingStart(true); setEditStartValue(currentCycle.started_at.slice(0, 16)); }}
                    className="ml-0.5 text-rose-400 hover:text-rose-600 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chronometer — compact */}
        <div className="relative overflow-hidden rounded-xl bg-white shadow-md shadow-emerald-100/30 border border-emerald-100 px-4 py-2.5 mb-2 text-center shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
          <div className="relative flex items-center justify-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-40" />
              <Play className="w-3 h-3 text-emerald-500 relative" fill="currentColor" />
            </div>
            <span className="text-2xl font-mono font-bold text-gray-800 tabular-nums tracking-tight">
              {totalHoursRaw}:{pad2(minutes)}:{pad2(seconds)}
            </span>
            <span className="text-[10px] text-gray-400">{days}d {hours}h {minutes}m</span>
          </div>
        </div>

        {/* Edit start date overlay */}
        <AnimatePresence>
          {editingStart && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
                <p className="text-sm font-semibold text-gray-700 mb-3">Editar início do ciclo</p>
                <input type="datetime-local" value={editStartValue} onChange={e => setEditStartValue(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 mb-3 focus:outline-none focus:ring-2 focus:ring-rose-300" />
                <div className="flex gap-2">
                  <button onClick={handleEditStart} className="flex-1 bg-rose-500 text-white text-sm font-semibold py-2 rounded-xl">Salvar</button>
                  <button onClick={() => setEditingStart(false)} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-2 rounded-xl">Cancelar</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interrupt button — compact */}
        <AnimatePresence mode="wait">
          {!showConfirmInterrupt ? (
            <motion.button
              key="trigger"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmInterrupt(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-rose-300 text-rose-500 font-semibold py-3 rounded-xl hover:border-rose-400 hover:bg-rose-50/50 transition-all mb-2 text-sm shrink-0"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Registrar interrupção
            </motion.button>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-3">
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-white rounded-2xl border border-rose-200 shadow-xl p-5 w-full max-w-lg">
                <p className="text-sm font-semibold text-gray-700 mb-1">Registrar interrupção?</p>
                <p className="text-xs text-gray-400 mb-3">
                  Ciclo atual ({durationText(elapsed)}) será salvo e um novo começará.
                </p>
                <textarea
                  value={interruptNote}
                  onChange={e => setInterruptNote(e.target.value)}
                  placeholder="O que aconteceu? (opcional)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 mb-3 resize-none h-14 focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
                <div className="flex gap-2">
                  <button onClick={handleInterrupt} disabled={saving} className="flex-1 bg-rose-500 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                    {saving ? "Salvando..." : "Confirmar"}
                  </button>
                  <button onClick={() => { setShowConfirmInterrupt(false); setInterruptNote(""); }} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-2.5 rounded-xl">Cancelar</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats — compact 2x2 */}
        <div className="grid grid-cols-4 gap-1.5 mb-2 shrink-0">
          <MiniStat icon={Trophy} value={bestStreak ? durationText(bestStreak) : "—"} label="Recorde" color="text-amber-500" />
          <MiniStat icon={BarChart3} value={avgStreak ? durationText(avgStreak) : "—"} label="Média" color="text-blue-500" />
          <MiniStat icon={AlertTriangle} value={String(totalInterruptions)} label="Paradas" color="text-rose-500" />
          <MiniStat icon={Heart} value={durationText(elapsed)} label="Atual" color="text-emerald-500" />
        </div>

        {/* Footer actions — compact */}
        <div className="flex items-center justify-center gap-4 shrink-0 pt-1">
          {history.length > 0 && (
            <button onClick={() => setShowHistoryModal(true)} className="text-[11px] text-gray-400 hover:text-rose-500 transition-colors inline-flex items-center gap-1">
              <History className="w-3 h-3" />
              Histórico ({history.length})
            </button>
          )}
          {!showConfirmReset ? (
            <button onClick={() => setShowConfirmReset(true)} className="text-[11px] text-gray-300 hover:text-rose-400 transition-colors inline-flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Reiniciar
            </button>
          ) : (
            <span className="flex items-center gap-2">
              <button onClick={handleResetAll} disabled={saving} className="text-[11px] text-rose-500 font-semibold disabled:opacity-50">
                {saving ? "..." : "Confirmar reset"}
              </button>
              <button onClick={() => setShowConfirmReset(false)} className="text-[11px] text-gray-400">Cancelar</button>
            </span>
          )}
        </div>
      </div>

      {/* History Modal (bottom sheet) */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowHistoryModal(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-2xl w-full max-w-lg shadow-xl"
              style={{ maxHeight: "70dvh" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Histórico ({history.length} ciclo{history.length !== 1 ? "s" : ""})</span>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "calc(70dvh - 48px)" }}>
                {[...history].reverse().map((cycle, i) => {
                  const dur = (cycle.duration_seconds || 0) * 1000;
                  const cycleNum = history.length - i;
                  return (
                    <div key={cycle.id} className="px-5 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-600">Ciclo {cycleNum}</p>
                          <p className="text-[11px] text-gray-400">
                            {formatDate(cycle.started_at)} → {cycle.ended_at ? formatDate(cycle.ended_at) : "—"}
                          </p>
                          <p className="text-sm font-semibold text-rose-500 mt-0.5">{cycle.duration_label || durationText(dur)}</p>
                          {cycle.note && <p className="text-[11px] text-gray-400 mt-0.5 italic">"{cycle.note}"</p>}
                        </div>
                        <button onClick={() => handleDeleteCycle(cycle.id)} className="text-gray-300 hover:text-rose-400 transition-colors p-1 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Mini Stat ── */
const MiniStat = ({ icon: Icon, value, label, color }: { icon: typeof Trophy; value: string; label: string; color: string }) => (
  <div className="bg-white/80 rounded-xl px-2 py-2 text-center border border-white">
    <Icon className={`w-3 h-3 ${color} mx-auto mb-0.5`} />
    <p className="text-xs font-bold text-gray-700 leading-tight truncate">{value}</p>
    <p className="text-[9px] text-gray-400">{label}</p>
  </div>
);

export default CipaPage;
