import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, AlertTriangle, RotateCcw, Clock, Trophy, BarChart3, Edit3, Trash2, Play, Timer, X, History, Download, Share2 } from "lucide-react";
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
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

  // PWA: manifest, meta tags, service worker, install prompt
  useEffect(() => {
    // Detect standalone mode
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    // Show install banner if not already installed
    if (!standalone) {
      const dismissed = sessionStorage.getItem("cipa-install-dismissed");
      if (!dismissed) setShowInstallBanner(true);
    }

    // Manifest link
    let link = document.querySelector('link[rel="manifest"][data-cipa]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.setAttribute("data-cipa", "true");
      link.href = "/cipa-manifest.json";
      document.head.appendChild(link);
    }

    // Theme color
    let meta = document.querySelector('meta[name="theme-color"][data-cipa]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.setAttribute("data-cipa", "true");
      meta.content = "#0A0A0A";
      document.head.appendChild(meta);
    }

    // Apple meta tags
    const appleMetas: { name: string; content: string }[] = [
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "CIPA" },
    ];
    const createdMetas: HTMLMetaElement[] = [];
    appleMetas.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const m = document.createElement("meta");
        m.name = name;
        m.content = content;
        document.head.appendChild(m);
        createdMetas.push(m);
      }
    });

    // Apple touch icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"][data-cipa]') as HTMLLinkElement | null;
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      appleIcon.setAttribute("data-cipa", "true");
      appleIcon.href = "/cipa-icon-512.png";
      document.head.appendChild(appleIcon);
    }

    // Service worker — only register in production, not in iframe/preview
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isPreview = window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com");
    if (!isInIframe && !isPreview && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/cipa-sw.js", { scope: "/cipa" }).catch(() => {});
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      link?.remove();
      meta?.remove();
      createdMetas.forEach(m => m.remove());
      appleIcon?.remove();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
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
      <div className="flex items-center justify-center bg-background" style={{ height: "100dvh" }}>
        <div className="animate-pulse text-primary text-base font-mono font-medium tracking-wider">CARREGANDO</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-background overflow-hidden"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      <SeoHead title="CIPA — Contador de Dias" description="Acompanhe dias sem briga" noindex />

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pt-4 pb-3 overflow-hidden">

        {/* ═══ Header ═══ */}
        <div className="text-center mb-3 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 backdrop-blur mb-2">
            <Heart className="w-3 h-3 text-primary" fill="currentColor" />
            <span className="text-[10px] font-mono font-bold text-primary tracking-[0.2em] uppercase">CIPA</span>
          </div>
          <h1 className="text-sm font-mono font-bold text-foreground tracking-wide uppercase">Contador de Dias sem Briga</h1>
          <p className="mt-1 text-xs text-muted-foreground italic tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
            Bate-Seva &amp; Davão
          </p>
        </div>

        {/* ═══ Main Counter Card ═══ */}
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 mb-2.5 text-center shrink-0">
          {/* Subtle orange glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
          <div className="relative">
            <div className="text-6xl font-mono font-extrabold text-foreground tabular-nums leading-none tracking-tight">
              {days}
            </div>
            <p className="text-sm text-muted-foreground font-medium mt-1.5 tracking-wide">
              {days === 1 ? "dia" : "dias"} sem briga
            </p>
            {currentCycle && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                  <Clock className="w-3 h-3 text-primary/60" />
                  <span>Desde {formatDate(currentCycle.started_at)}</span>
                  <button
                    onClick={() => { setEditingStart(true); setEditStartValue(currentCycle.started_at.slice(0, 16)); }}
                    className="ml-0.5 text-primary/40 hover:text-primary transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Chronometer ═══ */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border px-4 py-2.5 mb-2.5 shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/3 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="absolute w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping opacity-30" />
                <Play className="w-3 h-3 text-emerald-500 relative" fill="currentColor" />
              </div>
              <span className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-wider">Ativo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-foreground tabular-nums tracking-tight">
                {totalHoursRaw}:{pad2(minutes)}:{pad2(seconds)}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{days}d {hours}h</span>
          </div>
        </div>

        {/* ═══ Interrupt Button ═══ */}
        <button
          onClick={() => setShowConfirmInterrupt(true)}
          className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/30 text-primary font-mono font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl hover:bg-primary/20 hover:border-primary/50 transition-all mb-2.5 shrink-0"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Registrar interrupção
        </button>

        {/* ═══ Stats Grid ═══ */}
        <div className="grid grid-cols-4 gap-2 mb-2 shrink-0">
          <StatMini icon={Trophy} value={bestStreak ? durationText(bestStreak) : "—"} label="Recorde" accent="text-amber-500" />
          <StatMini icon={BarChart3} value={avgStreak ? durationText(avgStreak) : "—"} label="Média" accent="text-blue-400" />
          <StatMini icon={AlertTriangle} value={String(totalInterruptions)} label="Paradas" accent="text-destructive" />
          <StatMini icon={Heart} value={durationText(elapsed)} label="Atual" accent="text-emerald-500" />
        </div>

        {/* ═══ Footer Actions ═══ */}
        <div className="flex items-center justify-center gap-5 shrink-0 pt-1">
          {history.length > 0 && (
            <button onClick={() => setShowHistoryModal(true)} className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5">
              <History className="w-3 h-3" />
              Histórico ({history.length})
            </button>
          )}
          {!showConfirmReset ? (
            <button onClick={() => setShowConfirmReset(true)} className="text-[11px] font-mono text-muted-foreground/50 hover:text-destructive transition-colors inline-flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" />
              Reiniciar
            </button>
          ) : (
            <span className="flex items-center gap-3">
              <button onClick={handleResetAll} disabled={saving} className="text-[11px] font-mono text-destructive font-bold disabled:opacity-50">
                {saving ? "..." : "Confirmar reset"}
              </button>
              <button onClick={() => setShowConfirmReset(false)} className="text-[11px] font-mono text-muted-foreground">Cancelar</button>
            </span>
          )}
        </div>

        {/* ═══ Install Banner ═══ */}
        {showInstallBanner && !isStandalone && (
          <div className="shrink-0 mt-1">
            {isIos ? (
              <button
                onClick={() => setShowIosGuide(true)}
                className="w-full flex items-center justify-center gap-2 bg-card border border-border text-foreground font-mono text-[11px] py-2.5 rounded-xl hover:border-primary/30 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                Instalar app
              </button>
            ) : deferredPrompt ? (
              <button
                onClick={async () => {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (outcome === "accepted") setShowInstallBanner(false);
                  setDeferredPrompt(null);
                }}
                className="w-full flex items-center justify-center gap-2 bg-card border border-border text-foreground font-mono text-[11px] py-2.5 rounded-xl hover:border-primary/30 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                Instalar app
              </button>
            ) : (
              <button
                onClick={() => {
                  sessionStorage.setItem("cipa-install-dismissed", "1");
                  setShowInstallBanner(false);
                }}
                className="w-full flex items-center justify-center gap-2 text-muted-foreground/50 font-mono text-[10px] py-2 transition-all"
              >
                <Download className="w-3 h-3" />
                Para instalar, use o menu do navegador
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ iOS Install Guide — Bottom Sheet ═══ */}
      <AnimatePresence>
        {showIosGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowIosGuide(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono font-bold text-foreground">Instalar no iPhone</h3>
                <button onClick={() => setShowIosGuide(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Toque no botão Compartilhar</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> O ícone de compartilhar na barra do Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Selecione "Adicionar à Tela de Início"</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Role para baixo no menu se necessário</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">Toque em "Adicionar"</p>
                    <p className="text-xs text-muted-foreground mt-0.5">O app CIPA será instalado na sua tela inicial</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowIosGuide(false); sessionStorage.setItem("cipa-install-dismissed", "1"); setShowInstallBanner(false); }}
                className="w-full mt-5 py-3 bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider rounded-xl"
              >
                Entendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Interrupt Confirm — Bottom Sheet ═══ */}
      <AnimatePresence>
        {showConfirmInterrupt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => { setShowConfirmInterrupt(false); setInterruptNote(""); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card border-t border-border rounded-t-2xl w-full max-w-lg p-5 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <p className="text-sm font-mono font-bold text-foreground mb-1">Registrar interrupção</p>
              <p className="text-xs text-muted-foreground mb-4">
                Ciclo atual ({durationText(elapsed)}) será salvo no histórico.
              </p>
              <textarea
                value={interruptNote}
                onChange={e => setInterruptNote(e.target.value)}
                placeholder="O que aconteceu? (opcional)"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground mb-4 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleInterrupt}
                  disabled={saving}
                  className="flex-1 bg-primary text-primary-foreground text-sm font-mono font-bold py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Confirmar"}
                </button>
                <button
                  onClick={() => { setShowConfirmInterrupt(false); setInterruptNote(""); }}
                  className="flex-1 bg-muted text-muted-foreground text-sm font-mono font-bold py-3 rounded-lg hover:bg-border transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Edit Start — Modal ═══ */}
      <AnimatePresence>
        {editingStart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
              <p className="text-sm font-mono font-bold text-foreground mb-3">Editar início do ciclo</p>
              <input
                type="datetime-local"
                value={editStartValue}
                onChange={e => setEditStartValue(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground mb-4 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button onClick={handleEditStart} className="flex-1 bg-primary text-primary-foreground text-sm font-mono font-bold py-2.5 rounded-lg">Salvar</button>
                <button onClick={() => setEditingStart(false)} className="flex-1 bg-muted text-muted-foreground text-sm font-mono font-bold py-2.5 rounded-lg">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ History — Bottom Sheet ═══ */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card border-t border-border rounded-t-2xl w-full max-w-lg shadow-2xl"
              style={{ maxHeight: "75dvh" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <span className="text-sm font-mono font-bold text-foreground">
                  Histórico ({history.length} ciclo{history.length !== 1 ? "s" : ""})
                </span>
                <button onClick={() => setShowHistoryModal(false)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "calc(75dvh - 48px)" }}>
                {[...history].reverse().map((cycle, i) => {
                  const dur = (cycle.duration_seconds || 0) * 1000;
                  const cycleNum = history.length - i;
                  return (
                    <div key={cycle.id} className="px-5 py-3.5 border-b border-border/50 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-bold text-foreground">Ciclo {cycleNum}</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {formatDate(cycle.started_at)} → {cycle.ended_at ? formatDate(cycle.ended_at) : "—"}
                          </p>
                          <p className="text-sm font-bold text-primary mt-1">{cycle.duration_label || durationText(dur)}</p>
                          {cycle.note && <p className="text-[11px] text-muted-foreground mt-1 italic">"{cycle.note}"</p>}
                        </div>
                        <button onClick={() => handleDeleteCycle(cycle.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors p-1 shrink-0">
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

/* ═══ Stat Mini Card ═══ */
const StatMini = ({ icon: Icon, value, label, accent }: { icon: typeof Trophy; value: string; label: string; accent: string }) => (
  <div className="bg-card border border-border rounded-xl px-2 py-2.5 text-center">
    <Icon className={`w-3 h-3 ${accent} mx-auto mb-1`} />
    <p className="text-xs font-mono font-bold text-foreground leading-tight truncate">{value}</p>
    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
  </div>
);

export default CipaPage;
