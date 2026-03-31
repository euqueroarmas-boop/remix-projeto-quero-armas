import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, AlertTriangle, RotateCcw, Clock, Trophy, BarChart3, Edit3, Trash2, ChevronDown, ChevronUp, Sparkles, Play, Timer } from "lucide-react";
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
  if (days > 0) parts.push(`${days} dia${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  return parts.join(" ") || "0min";
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
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  // Tick every second
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // Load from DB
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

  /* Actions */
  const handleInterrupt = useCallback(async () => {
    if (!currentCycle || saving) return;
    setSaving(true);
    const endedAt = new Date().toISOString();
    const ms = new Date(endedAt).getTime() - new Date(currentCycle.started_at).getTime();
    const durDays = Math.floor(ms / 86400000);
    const durSeconds = Math.floor(ms / 1000);
    const label = durationLabelFull(ms);

    // Close current cycle
    await supabase.from("cipa_cycles").update({
      is_current: false,
      ended_at: endedAt,
      duration_days: durDays,
      duration_seconds: durSeconds,
      duration_label: label,
      note: interruptNote.trim() || null,
      updated_at: endedAt,
    }).eq("id", currentCycle.id);

    // Create new cycle
    await supabase.from("cipa_cycles").insert({
      started_at: endedAt,
      is_current: true,
    });

    setShowConfirmInterrupt(false);
    setInterruptNote("");
    setSaving(false);
    await fetchData();
  }, [currentCycle, interruptNote, saving, fetchData]);

  const handleResetAll = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    // Delete all cycles
    await supabase.from("cipa_cycles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // Create fresh cycle
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
        started_at: d.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", currentCycle.id);
      await fetchData();
    }
    setEditingStart(false);
  }, [editStartValue, currentCycle, fetchData]);

  const handleDeleteCycle = useCallback(async (id: string) => {
    await supabase.from("cipa_cycles").delete().eq("id", id);
    await fetchData();
  }, [fetchData]);

  /* Stats */
  const durations = history.map(c => (c.duration_seconds || 0) * 1000);
  const bestStreak = durations.length > 0 ? Math.max(...durations) : 0;
  const avgStreak = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const totalInterruptions = history.length;
  const totalAccumulated = durations.reduce((a, b) => a + b, 0) + elapsed;

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50" style={{ minHeight: "100dvh" }}>
        <div className="animate-pulse text-rose-400 text-lg font-medium">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 overflow-x-hidden" style={{ minHeight: "100dvh" }}>
      <SeoHead title="CIPA — Contador de Dias" description="Acompanhe dias sem briga" noindex />

      <div className="max-w-lg mx-auto px-3 py-5 pb-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-rose-200 mb-3">
            <Heart className="w-4 h-4 text-rose-500" fill="currentColor" />
            <span className="text-xs font-semibold text-rose-700 tracking-wide uppercase">CIPA</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Contador de Dias sem Briga</h1>
          <p className="mt-1.5 text-sm italic text-rose-400/80 tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>Bate-Seva &amp; Davão</p>
        </motion.div>

        {/* ── Main Counter Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-rose-100/50 border border-rose-100 p-6 mb-3 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-amber-500/5" />
          <div className="relative">
            <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-3" />
            <div className="text-7xl font-extrabold text-gray-800 mb-1 tabular-nums">{days}</div>
            <p className="text-lg text-gray-500 font-medium mb-2">{days === 1 ? "dia" : "dias"} sem briga</p>

            {currentCycle && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Iniciado em {formatDate(currentCycle.started_at)}</span>
                  <button
                    onClick={() => { setEditingStart(true); setEditStartValue(currentCycle.started_at.slice(0, 16)); }}
                    className="ml-1 text-rose-400 hover:text-rose-600 transition-colors"
                    title="Editar data de início"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Chronometer Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="relative overflow-hidden rounded-2xl bg-white shadow-lg shadow-emerald-100/30 border border-emerald-100 p-6 mb-6 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-40" />
                <Play className="w-4 h-4 text-emerald-500 relative" fill="currentColor" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Contagem em andamento</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <Timer className="w-5 h-5 text-emerald-400 mr-2" />
              <span className="text-4xl font-mono font-bold text-gray-800 tabular-nums tracking-tight">
                {totalHoursRaw}:{pad2(minutes)}:{pad2(seconds)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">{days}d {hours}h {minutes}m {seconds}s</p>
          </div>
        </motion.div>

        {/* Edit start date modal */}
        <AnimatePresence>
          {editingStart && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">Editar início do ciclo atual</p>
              <input type="datetime-local" value={editStartValue} onChange={e => setEditStartValue(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 mb-3 focus:outline-none focus:ring-2 focus:ring-rose-300" />
              <div className="flex gap-2">
                <button onClick={handleEditStart} className="flex-1 bg-rose-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-rose-600 transition-colors">Salvar</button>
                <button onClick={() => setEditingStart(false)} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Interrupt Button ── */}
        <AnimatePresence mode="wait">
          {!showConfirmInterrupt ? (
            <motion.button
              key="trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmInterrupt(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-rose-300 text-rose-500 font-semibold py-4 rounded-2xl hover:border-rose-400 hover:bg-rose-50/50 transition-all mb-6"
            >
              <AlertTriangle className="w-4 h-4" />
              Registrar interrupção
            </motion.button>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-2xl border border-rose-200 shadow-lg p-5 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-1">Registrar interrupção?</p>
              <p className="text-xs text-gray-400 mb-3">
                O ciclo atual ({durationText(elapsed)}) será salvo no histórico e um novo ciclo começará agora.
              </p>
              <textarea
                value={interruptNote}
                onChange={e => setInterruptNote(e.target.value)}
                placeholder="O que aconteceu? (opcional)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 mb-3 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <div className="flex gap-2">
                <button onClick={handleInterrupt} disabled={saving} className="flex-1 bg-rose-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-50">
                  {saving ? "Salvando..." : "Confirmar"}
                </button>
                <button onClick={() => { setShowConfirmInterrupt(false); setInterruptNote(""); }} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon={Trophy} label="Melhor período" value={bestStreak ? durationText(bestStreak) : "—"} color="text-amber-500" bg="bg-amber-50" />
          <StatCard icon={BarChart3} label="Média dos ciclos" value={avgStreak ? durationText(avgStreak) : "—"} color="text-blue-500" bg="bg-blue-50" />
          <StatCard icon={AlertTriangle} label="Interrupções" value={String(totalInterruptions)} color="text-rose-500" bg="bg-rose-50" />
          <StatCard icon={Heart} label="Ciclo atual" value={durationText(elapsed)} color="text-emerald-500" bg="bg-emerald-50" />
          <div className="col-span-2">
            <StatCard icon={Timer} label="Tempo total acumulado" value={durationText(totalAccumulated)} color="text-purple-500" bg="bg-purple-50" />
          </div>
        </motion.div>

        {/* ── History ── */}
        {history.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <button onClick={() => setShowHistory(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              <span>Histórico ({history.length} ciclo{history.length !== 1 ? "s" : ""})</span>
              {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t border-gray-100">
                    {[...history].reverse().map((cycle, i) => {
                      const dur = (cycle.duration_seconds || 0) * 1000;
                      const cycleNum = history.length - i;
                      return (
                        <div key={cycle.id} className="px-5 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-600 mb-0.5">Ciclo {cycleNum}</p>
                              <p className="text-[11px] text-gray-400">
                                {formatDate(cycle.started_at)} → {cycle.ended_at ? formatDate(cycle.ended_at) : "—"}
                              </p>
                              <p className="text-sm font-semibold text-rose-500 mt-0.5">{cycle.duration_label || durationText(dur)}</p>
                              {cycle.note && <p className="text-[11px] text-gray-400 mt-1 italic">"{cycle.note}"</p>}
                            </div>
                            <button onClick={() => handleDeleteCycle(cycle.id)} className="text-gray-300 hover:text-rose-400 transition-colors p-1 shrink-0" title="Remover do histórico">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Reset all ── */}
        <div className="text-center">
          {!showConfirmReset ? (
            <button onClick={() => setShowConfirmReset(true)} className="text-xs text-gray-300 hover:text-rose-400 transition-colors inline-flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Reiniciar tudo
            </button>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-rose-700 mb-1">Tem certeza?</p>
              <p className="text-xs text-rose-400 mb-4">Isso apagará todo o histórico permanentemente.</p>
              <div className="flex gap-2 justify-center">
                <button onClick={handleResetAll} disabled={saving} className="px-6 py-2 bg-rose-500 text-white text-sm font-semibold rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-50">
                  {saving ? "Apagando..." : "Sim, reiniciar tudo"}
                </button>
                <button onClick={() => setShowConfirmReset(false)} className="px-6 py-2 bg-white text-gray-600 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">Cancelar</button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Stat Card ── */
const StatCard = ({ icon: Icon, label, value, color, bg }: { icon: typeof Trophy; label: string; value: string; color: string; bg: string }) => (
  <div className={`${bg} rounded-2xl p-4 border border-white`}>
    <Icon className={`w-4 h-4 ${color} mb-2`} />
    <p className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</p>
    <p className="text-sm font-bold text-gray-700">{value}</p>
  </div>
);

export default CipaPage;
