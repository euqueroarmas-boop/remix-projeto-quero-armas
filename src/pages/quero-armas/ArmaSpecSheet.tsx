import { Loader2, Sparkles, Globe, RefreshCcw, Image as ImageIcon, X, AlertCircle, Crosshair, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIPOS = ["pistola","revolver","espingarda","carabina","fuzil","submetralhadora","outra"];

const STAT_LABELS: Record<string,string> = {
  stat_dano: "DANO",
  stat_precisao: "PRECISÃO",
  stat_alcance: "ALCANCE",
  stat_cadencia: "CADÊNCIA",
  stat_mobilidade: "MOBILIDADE",
  stat_controle: "CONTROLE",
};

interface Props {
  editing: any;
  setF: (k: any, v: any) => void;
  scrapeUrl: string;
  setScrapeUrl: (v: string) => void;
  aiBusy: boolean;
  scrapeBusy: boolean;
  saving: boolean;
  imgBusy: boolean;
  onClose: () => void;
  onSave: () => void;
  onAI: () => void;
  onScrape: () => void;
  onGerarImagem: () => void;
  imagensFabricante?: string[];
  carregandoImagens?: boolean;
  onSelecionarImagem?: (src: string) => void;
  onAbrirGaleria?: () => void;
}

export function ArmaSpecSheet({
  editing, setF, scrapeUrl, setScrapeUrl,
  aiBusy, scrapeBusy, saving, imgBusy,
  onClose, onSave, onAI, onScrape, onGerarImagem,
  imagensFabricante = [], carregandoImagens = false, onSelecionarImagem, onAbrirGaleria,
}: Props) {
  const id = editing.id ? String(editing.id).slice(0, 8).toUpperCase() : "NOVO";
  return (
    <div className="flex flex-col h-full bg-[#f6f5f1] text-zinc-900">
      {/* HEADER STICKY — SOC strip */}
      <header className="sticky top-0 z-30 bg-[#f6f5f1]/95 backdrop-blur border-b border-zinc-300 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center border border-zinc-300 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 font-mono truncate">
            <span>ARSENAL</span>
            <span className="text-zinc-400">/</span>
            <span>FICHA</span>
            <span className="text-zinc-400">/</span>
            <span className="text-amber-600">{id}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-zinc-600 border border-zinc-300 px-2 py-1 font-mono">
            <span className={`size-1.5 rounded-full ${editing.status_revisao === "verificado" ? "bg-emerald-500" : editing.status_revisao === "rejeitado" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
            {editing.status_revisao === "verificado" ? "VERIFICADO" : editing.status_revisao === "rejeitado" ? "REJEITADO" : "PENDENTE"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="hidden sm:inline-flex text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 px-3 py-2 font-mono"
          >
            [ Cancelar ]
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-amber-500 text-zinc-900 text-[11px] font-bold uppercase tracking-[0.15em] px-4 sm:px-6 py-2.5 hover:bg-amber-400 transition-colors disabled:opacity-60 font-mono shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </button>
        </div>
      </header>

      {/* CONTEÚDO ROLÁVEL */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-32">

          {/* COLUNA ESQUERDA: visual + identidade + ações */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* IMAGEM com crosshairs */}
            <div className="relative bg-white border border-zinc-300 p-3 aspect-[4/3] flex items-center justify-center">
              <div className="absolute top-2 left-2 size-3 border-t border-l border-zinc-900" />
              <div className="absolute top-2 right-2 size-3 border-t border-r border-zinc-900" />
              <div className="absolute bottom-2 left-2 size-3 border-b border-l border-zinc-900" />
              <div className="absolute bottom-2 right-2 size-3 border-b border-r border-zinc-900" />
              <div className="absolute top-1/2 left-3 right-3 h-px bg-zinc-200 border-dashed" />
              <div className="absolute left-1/2 top-3 bottom-3 w-px bg-zinc-200 border-dashed" />

              {editing.imagem ? (
                <img src={editing.imagem} alt={`${editing.marca || ""} ${editing.modelo || ""}`} className="relative z-10 max-w-[88%] max-h-[88%] object-contain" />
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-2 text-zinc-300">
                  <Crosshair className="h-12 w-12" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]">SEM IMAGEM</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 z-20 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500 bg-white/90 px-2 py-0.5">
                FIG.01 · PERFIL
              </div>
            </div>

            <button
              onClick={onGerarImagem}
              disabled={!editing.id || imgBusy}
              className="w-full bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-widest font-mono py-3 hover:bg-amber-500 hover:text-zinc-900 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (editing.imagem ? <RefreshCcw className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />)}
              {editing.imagem ? "Regerar imagem (IA)" : "Gerar imagem (IA)"}
            </button>

            {/* IDENTIDADE — barra preta lateral */}
            <div className="border-l-2 border-zinc-900 pl-4 py-1 flex flex-col">
              <div className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-zinc-500 mb-1">FABRICANTE / MODELO</div>
              <input
                value={editing.marca || ""}
                onChange={(e) => setF("marca", e.target.value)}
                placeholder="MARCA"
                className="w-full bg-transparent text-lg font-bold uppercase text-zinc-900 placeholder:text-zinc-300 outline-none border-b border-transparent focus:border-amber-500 transition-colors py-1"
              />
              <input
                value={editing.modelo || ""}
                onChange={(e) => setF("modelo", e.target.value)}
                placeholder="MODELO"
                className="w-full bg-transparent text-3xl sm:text-4xl font-bold tracking-tighter text-zinc-900 placeholder:text-zinc-300 outline-none border-b border-transparent focus:border-amber-500 transition-colors py-1 -mt-1"
              />
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-zinc-500 shrink-0">APELIDO</span>
                <input
                  value={editing.apelido || ""}
                  onChange={(e) => setF("apelido", e.target.value)}
                  placeholder="—"
                  className="flex-1 bg-white border border-zinc-300 px-2 py-1 text-xs font-mono font-bold text-zinc-900 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* AÇÕES — IA / FABRICANTE */}
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={onAI}
                disabled={aiBusy}
                className="flex flex-col items-start gap-1 p-3 border border-zinc-300 bg-white hover:border-amber-500 transition-colors group disabled:opacity-50"
              >
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500 group-hover:text-amber-600">FERRAMENTA · IA</span>
                <span className="text-xs font-mono font-bold text-zinc-900 inline-flex items-center gap-2">
                  {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Gerar / Regerar dados
                </span>
              </button>
              <div className="flex flex-col gap-2 p-3 border border-zinc-300 bg-white">
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500">REPOSITÓRIO · FABRICANTE</span>
                <input
                  placeholder="https://taurusarmas.com.br/..."
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-2 py-1.5 text-xs font-mono text-zinc-900 outline-none focus:border-amber-500"
                />
                <button
                  onClick={onScrape}
                  disabled={scrapeBusy}
                  className="text-xs font-mono font-bold text-zinc-900 hover:text-amber-600 inline-flex items-center gap-2 self-start disabled:opacity-50"
                >
                  {scrapeBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                  Buscar especificações
                </button>

                {/* IMAGENS ENCONTRADAS NO FABRICANTE */}
                {(carregandoImagens || imagensFabricante.length > 0 || (scrapeUrl && !scrapeBusy && !carregandoImagens && imagensFabricante.length === 0)) && (
                  <div className="mt-3 pt-3 border-t border-zinc-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500">
                        IMAGENS ENCONTRADAS {imagensFabricante.length > 0 && `· ${imagensFabricante.length}`}
                      </span>
                      {imagensFabricante.length > 4 && onAbrirGaleria && (
                        <button onClick={onAbrirGaleria} className="text-[10px] font-mono font-bold text-amber-700 hover:text-amber-900 uppercase tracking-wider">
                          Ver todas →
                        </button>
                      )}
                    </div>

                    {carregandoImagens ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[0,1,2,3].map((i) => (
                          <div key={i} className="aspect-square bg-zinc-200 animate-pulse border border-zinc-300" />
                        ))}
                      </div>
                    ) : imagensFabricante.length === 0 ? (
                      <div className="text-[10px] font-mono text-zinc-500 py-3 text-center border border-dashed border-zinc-300 bg-zinc-50">
                        Nenhuma imagem encontrada nesta página
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {imagensFabricante.slice(0, 6).map((src, idx) => {
                          const selecionada = editing?.imagem === src;
                          return (
                            <button
                              key={idx}
                              onClick={() => onSelecionarImagem?.(src)}
                              type="button"
                              className={`group relative bg-white border-2 transition-all ${selecionada ? "border-amber-500 ring-2 ring-amber-500/30" : "border-zinc-200 hover:border-amber-500"}`}
                              title={`Usar como imagem principal`}
                            >
                              <img
                                src={src}
                                alt={`Opção ${idx + 1}`}
                                className="w-full h-20 object-contain p-1"
                                loading="lazy"
                                onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = "0.2")}
                              />
                              {selecionada && (
                                <div className="absolute top-0.5 right-0.5 bg-amber-500 text-white text-[8px] font-mono font-bold uppercase px-1 py-0.5">✓</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: specs + stats + textos */}
          <div className="lg:col-span-7 flex flex-col gap-8">

            {editing.status_revisao === "pendente_revisao" && (
              <div className="flex items-center gap-2 text-amber-700 text-xs font-mono bg-amber-50 border-l-2 border-amber-500 px-3 py-2">
                <AlertCircle className="h-4 w-4" /> DADOS PENDENTES — confirme antes de marcar como verificado.
              </div>
            )}

            {/* SECTION HEADER */}
            <Section title="Especificações Mecânicas">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-300 border border-zinc-300">
                <SpecCell label="Tipo">
                  <Select value={editing.tipo || "pistola"} onValueChange={(v) => setF("tipo", v)}>
                    <SelectTrigger className="bg-transparent border-0 h-auto p-0 text-sm font-mono font-bold uppercase text-zinc-900 focus:ring-0 shadow-none [&>svg]:hidden"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </SpecCell>
                <SpecCell label="Calibre *">
                  <BareInput value={editing.calibre || ""} onChange={(e) => setF("calibre", e.target.value)} placeholder="9MM" />
                </SpecCell>
                <SpecCell label="Capacidade">
                  <BareInput type="number" value={editing.capacidade_carregador ?? ""} onChange={(e) => setF("capacidade_carregador", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" suffix="rds" />
                </SpecCell>
                <SpecCell label="Peso">
                  <BareInput type="number" value={editing.peso_gramas ?? ""} onChange={(e) => setF("peso_gramas", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" suffix="g" />
                </SpecCell>
                <SpecCell label="Comp. Cano">
                  <BareInput type="number" value={editing.comprimento_cano_mm ?? ""} onChange={(e) => setF("comprimento_cano_mm", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" suffix="mm" />
                </SpecCell>
                <SpecCell label="Origem">
                  <BareInput value={editing.origem || ""} onChange={(e) => setF("origem", e.target.value)} placeholder="—" />
                </SpecCell>
                <SpecCell label="Alcance Efetivo">
                  <BareInput type="number" value={editing.alcance_efetivo_m ?? ""} onChange={(e) => setF("alcance_efetivo_m", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" suffix="m" />
                </SpecCell>
                <SpecCell label="Velocidade Saída">
                  <BareInput type="number" value={editing.velocidade_projetil_ms ?? ""} onChange={(e) => setF("velocidade_projetil_ms", e.target.value === "" ? null : Number(e.target.value))} placeholder="—" suffix="m/s" />
                </SpecCell>
                <SpecCell label="Class. Legal" highlighted>
                  <Select value={editing.classificacao_legal || ""} onValueChange={(v) => setF("classificacao_legal", v)}>
                    <SelectTrigger className="bg-transparent border-0 h-auto p-0 text-sm font-mono font-bold uppercase text-zinc-900 focus:ring-0 shadow-none [&>svg]:hidden"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Uso Permitido">Uso Permitido</SelectItem>
                      <SelectItem value="Uso Restrito">Uso Restrito</SelectItem>
                    </SelectContent>
                  </Select>
                </SpecCell>
              </div>
            </Section>

            {/* MÉTRICAS DE DESEMPENHO */}
            <Section title="Métricas de Desempenho">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border border-zinc-300 bg-white p-5 font-mono">
                {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>).map(k => {
                  const v = (editing as any)[k] ?? 0;
                  const pct = Math.min(100, Math.max(0, Number(v) || 0));
                  return (
                    <div key={k} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-zinc-500">{STAT_LABELS[k]}</span>
                        <input
                          type="number" min={0} max={100}
                          value={(editing as any)[k] ?? ""}
                          onChange={(e) => setF(k as any, e.target.value === "" ? null : Number(e.target.value))}
                          className="w-10 text-right text-zinc-900 outline-none focus:text-amber-600 tabular-nums bg-transparent"
                        />
                      </div>
                      <div className="h-1.5 w-full bg-zinc-100 border border-zinc-200 overflow-hidden">
                        <div className="h-full bg-zinc-900 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* DESCRIÇÃO */}
            <Section title="Dossiê Analítico">
              <Textarea
                rows={5}
                value={editing.descricao || ""}
                onChange={(e) => setF("descricao", e.target.value)}
                placeholder="Descreva características técnicas, histórico, contexto operacional…"
                className="bg-white border border-zinc-300 text-zinc-900 placeholder:text-zinc-400 leading-relaxed focus-visible:ring-amber-500"
              />
            </Section>

            {/* META — fonte / status / observações */}
            <Section title="Metadados Editoriais">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-300 border border-zinc-300">
                <SpecCell label="Status Revisão">
                  <Select value={editing.status_revisao || "rascunho"} onValueChange={(v) => setF("status_revisao", v)}>
                    <SelectTrigger className="bg-transparent border-0 h-auto p-0 text-sm font-mono font-bold uppercase text-zinc-900 focus:ring-0 shadow-none [&>svg]:hidden"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="pendente_revisao">Pendente</SelectItem>
                      <SelectItem value="verificado">Verificado</SelectItem>
                      <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    </SelectContent>
                  </Select>
                </SpecCell>
                <SpecCell label="Fonte dos Dados">
                  <Select value={editing.fonte_dados || "curado"} onValueChange={(v) => setF("fonte_dados", v)}>
                    <SelectTrigger className="bg-transparent border-0 h-auto p-0 text-sm font-mono font-bold uppercase text-zinc-900 focus:ring-0 shadow-none [&>svg]:hidden"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curado">Curado</SelectItem>
                      <SelectItem value="ia_gerado">IA</SelectItem>
                      <SelectItem value="scrape_fabricante">Scrape</SelectItem>
                      <SelectItem value="importado">Importado</SelectItem>
                    </SelectContent>
                  </Select>
                </SpecCell>
                <SpecCell label="URL Fonte">
                  <BareInput value={editing.fonte_url || ""} onChange={(e) => setF("fonte_url", e.target.value)} placeholder="—" />
                </SpecCell>
              </div>
              <Textarea
                rows={2}
                value={editing.observacoes || ""}
                onChange={(e) => setF("observacoes", e.target.value)}
                placeholder="Observações internas (não exibidas ao cliente)…"
                className="bg-white border border-zinc-300 text-zinc-900 placeholder:text-zinc-400 mt-3 text-xs font-mono focus-visible:ring-amber-500"
              />
            </Section>
          </div>
        </div>
      </div>

      {/* AÇÕES MOBILE STICKY (somente <sm) */}
      <div className="sm:hidden sticky bottom-0 z-20 bg-[#f6f5f1]/95 backdrop-blur border-t border-zinc-300 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-700 border border-zinc-300 py-3"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-[2] inline-flex items-center justify-center gap-2 bg-amber-500 text-zinc-900 text-[11px] font-mono font-bold uppercase tracking-[0.15em] py-3 disabled:opacity-60 shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar Calibração
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="size-1.5 bg-zinc-900" />
        <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-900">{title}</h2>
        <div className="flex-1 h-px bg-zinc-300" />
      </div>
      {children}
    </section>
  );
}

function SpecCell({ label, children, highlighted }: { label: string; children: React.ReactNode; highlighted?: boolean }) {
  return (
    <div className={`p-3 sm:p-4 flex flex-col group focus-within:ring-1 focus-within:ring-amber-500 focus-within:z-10 relative ${highlighted ? "bg-amber-50 border-b-2 border-amber-500" : "bg-white"}`}>
      <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</label>
      {children}
    </div>
  );
}

function BareInput({ suffix, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { suffix?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <input
        {...props}
        className="flex-1 min-w-0 bg-transparent text-sm font-mono font-bold text-zinc-900 placeholder:text-zinc-300 outline-none border-b border-transparent focus:border-amber-500 transition-colors pb-0.5"
      />
      {suffix && <span className="text-[10px] font-mono text-zinc-400 shrink-0">{suffix}</span>}
    </div>
  );
}