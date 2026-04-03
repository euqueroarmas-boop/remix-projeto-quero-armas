
## CIPA Pulse — Plano de Implementação

### FASE 1 — Termômetro + Motor Básico
**Tabelas novas:**
- `emotion_logs` (user_id, manual_level, status_label, timestamp)
- `emotion_events` (user_id, started_at, peak_level, ended_at, duration_minutes, conflict_flag)

**Arquivos novos:**
- `src/components/cipa/pulse/PulseThermometer.tsx` — Termômetro touch 0-100 com zonas (Calmo/Atenção/Tensão/Crítico/Conflito)
- `src/components/cipa/pulse/PulseScoreEngine.ts` — Motor de score inicial
- `src/components/cipa/pulse/PulseDailyChart.tsx` — Gráfico de linha diário
- `src/components/cipa/pulse/PulseHeatmap.tsx` — Heatmap mensal
- `src/components/cipa/pulse/PulseEventDetector.ts` — Lógica de detecção de eventos (inicia >60, encerra <40)
- `src/components/cipa/pulse/usePulseLogger.ts` — Hook de persistência

**Arquivos alterados:**
- `src/pages/CipaPage.tsx` — Adicionar aba/seção "CIPA Pulse" (sem tocar no existente)

---

### FASE 2 — Motor de Tendência
**Arquivos novos:**
- `src/components/cipa/pulse/PulseTrendEngine.ts` — Cálculo de delta, aceleração, cooldown
- `src/components/cipa/pulse/PulseTrendIndicator.tsx` — Indicadores visuais (↑ ↓ →)

---

### FASE 3 — Integração Biológica (Apple Watch / HealthKit)
**Alteração de tabela:**
- Adicionar campos em `emotion_logs`: heart_rate, hrv, sleep_score

**Arquivos novos:**
- `src/components/cipa/pulse/PulseHealthKit.ts` — Interface com HealthKit (preparação para PWA/nativo)
- `src/components/cipa/pulse/PulseCompositeScore.ts` — Score composto (manual + bio + histórico)
- `src/components/cipa/pulse/PulseWatchButton.tsx` — Botão "Estou esquentando"

---

### FASE 4 — Motor Químico (Acúmulo e Recuperação)
**Arquivos novos:**
- `src/components/cipa/pulse/PulseChemicalEngine.ts` — Acúmulo de stress com decay (0.95/hora)

---

### FASE 5 — Estatística Avançada
**Tabelas novas:**
- `emotion_statistics` (user_id, month, average_score, max_score, critical_events, conflict_events, cooldown_avg)
- `emotion_triggers` (user_id, trigger_name, frequency, avg_intensity)

**Arquivos novos:**
- `src/components/cipa/pulse/PulseStatistics.tsx` — Painel de estatísticas mensais
- `src/components/cipa/pulse/PulseStatsAggregator.ts` — Motor de agregação

---

### FASE 6 — UI Premium
**Arquivos novos:**
- `src/components/cipa/pulse/PulseDashboard.tsx` — Dashboard principal (score, tendência, risco)
- `src/components/cipa/pulse/PulseWeeklyBars.tsx` — Gráfico de barras semanal

---

### FASE 7 — Previsão (IA Simplificada)
**Arquivos novos:**
- `src/components/cipa/pulse/PulsePredictionEngine.ts` — Motor de previsão baseado em histórico + tendência + frequência
- `src/components/cipa/pulse/PulseRiskBadge.tsx` — Badge de risco (Baixo/Moderado/Alto)

---

### Regras
- ✅ 100% incremental — zero alteração no CIPA existente
- ✅ Todos os novos arquivos dentro de `src/components/cipa/pulse/`
- ✅ Integração via aba separada no CipaPage
- ✅ Retrocompatibilidade total
- ✅ Estrutura modular preparada para SaaS

**Posso iniciar pela Fase 1 após sua aprovação.**
