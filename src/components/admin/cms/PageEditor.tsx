import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, Trash2, Plus, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { CmsPage, FaqItem, BenefitItem, PainItem, PageType } from "@/lib/cmsTypes";
import { createEmptyPage, BLOCK_TYPES } from "@/lib/cmsTypes";
import { saveCmsPage, updatePageStatus } from "@/lib/cmsApi";

interface PageEditorProps {
  page?: CmsPage;
  pageType: PageType;
  onBack: () => void;
  onSaved: () => void;
}

export default function PageEditor({ page, pageType, onBack, onSaved }: PageEditorProps) {
  const isNew = !page;
  const [form, setForm] = useState<Partial<CmsPage>>(page || createEmptyPage(pageType));
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof CmsPage>(key: K, value: CmsPage[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateNested = <K extends keyof CmsPage>(key: K, path: string, value: unknown) => {
    setForm(prev => ({
      ...prev,
      [key]: { ...(prev[key] as Record<string, unknown> || {}), [path]: value },
    }));
  };

  const handleSave = async (publish = false) => {
    if (!form.slug || !form.title) {
      toast.error("Slug e título são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCmsPage(form as Partial<CmsPage> & { id?: string });
      if (publish) {
        await updatePageStatus(saved.id, "published");
      }
      toast.success(publish ? "Página publicada!" : "Página salva!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  // ─── FAQ helpers ───
  const faqs = (form.faq_data || []) as FaqItem[];
  const addFaq = () => update("faq_data", [...faqs, { question: "", answer: "" }] as any);
  const removeFaq = (i: number) => update("faq_data", faqs.filter((_, idx) => idx !== i) as any);
  const updateFaq = (i: number, field: keyof FaqItem, val: string) => {
    const next = [...faqs];
    next[i] = { ...next[i], [field]: val };
    update("faq_data", next as any);
  };

  // ─── Pain helpers ───
  const pains = (form.pain_data || []) as PainItem[];
  const addPain = () => update("pain_data", [...pains, { text: "" }] as any);
  const removePain = (i: number) => update("pain_data", pains.filter((_, idx) => idx !== i) as any);

  // ─── Benefits helpers ───
  const benefits = (form.benefits_data || []) as BenefitItem[];
  const addBenefit = () => update("benefits_data", [...benefits, { title: "", text: "" }] as any);
  const removeBenefit = (i: number) => update("benefits_data", benefits.filter((_, idx) => idx !== i) as any);

  // ─── Solution helpers ───
  const solutions = ((form.solution_data as any)?.items || []) as string[];
  const addSolution = () => updateNested("solution_data", "items", [...solutions, ""]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <h2 className="text-sm font-bold text-foreground">
            {isNew ? "Nova Página" : `Editar: ${form.title}`}
          </h2>
          {form.status && (
            <Badge variant={form.status === "published" ? "default" : "secondary"} className="text-[10px]">
              {form.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="h-8 gap-1 text-xs">
            <Save className="h-3.5 w-3.5" /> Salvar Draft
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="h-8 gap-1 text-xs">
            <Eye className="h-3.5 w-3.5" /> Publicar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1 rounded-lg">
          <TabsTrigger value="identity" className="text-[11px] h-7">Identidade</TabsTrigger>
          <TabsTrigger value="seo" className="text-[11px] h-7">SEO</TabsTrigger>
          <TabsTrigger value="hero" className="text-[11px] h-7">Hero</TabsTrigger>
          <TabsTrigger value="content" className="text-[11px] h-7">Conteúdo</TabsTrigger>
          <TabsTrigger value="faq" className="text-[11px] h-7">FAQ</TabsTrigger>
          <TabsTrigger value="calculator" className="text-[11px] h-7">Calculadora</TabsTrigger>
          <TabsTrigger value="relations" className="text-[11px] h-7">Relações</TabsTrigger>
          {pageType === "segment" && (
            <TabsTrigger value="niche" className="text-[11px] h-7">Nicho</TabsTrigger>
          )}
          <TabsTrigger value="blocks" className="text-[11px] h-7">Blocos</TabsTrigger>
        </TabsList>

        {/* IDENTITY */}
        <TabsContent value="identity" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4"><CardTitle className="text-xs">Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Título</label>
                <Input value={form.title || ""} onChange={e => update("title", e.target.value)} className="h-8 text-xs mt-1" placeholder="Ex: Administração de Servidores" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Slug (URL)</label>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <Input value={form.slug || ""} onChange={e => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="h-8 text-xs" placeholder="administracao-de-servidores" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Template</label>
                <Select value={form.template || "default"} onValueChange={v => update("template", v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Padrão</SelectItem>
                    <SelectItem value="service-advanced">Serviço Avançado</SelectItem>
                    <SelectItem value="segment-cartorio">Segmento Cartório</SelectItem>
                    <SelectItem value="segment-industry">Segmento Indústria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {page?.legacy_component && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3">
                  <p className="text-[10px] text-amber-400 font-medium">⚠️ Página legada: {page.legacy_component}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Esta página possui um componente legado. Ao publicar pelo CMS, o componente dinâmico terá prioridade.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4"><CardTitle className="text-xs">SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Meta Title <span className="text-muted-foreground/50">({(form.meta_title || "").length}/60)</span></label>
                <Input value={form.meta_title || ""} onChange={e => update("meta_title", e.target.value)} className="h-8 text-xs mt-1" maxLength={60} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Meta Description <span className="text-muted-foreground/50">({(form.meta_description || "").length}/160)</span></label>
                <Textarea value={form.meta_description || ""} onChange={e => update("meta_description", e.target.value)} className="text-xs mt-1 min-h-[60px]" maxLength={160} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">OG Image URL</label>
                <Input value={form.og_image || ""} onChange={e => update("og_image", e.target.value)} className="h-8 text-xs mt-1" placeholder="https://..." />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Noindex</label>
                <Switch checked={form.noindex || false} onCheckedChange={v => update("noindex", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Priority</label>
                  <Select value={form.sitemap_priority || "0.7"} onValueChange={v => update("sitemap_priority", v)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["1.0", "0.9", "0.8", "0.7", "0.6", "0.5"].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Changefreq</label>
                  <Select value={form.sitemap_changefreq || "monthly"} onValueChange={v => update("sitemap_changefreq", v)}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["daily", "weekly", "monthly", "yearly"].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HERO */}
        <TabsContent value="hero" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4"><CardTitle className="text-xs">Hero</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Tag</label>
                <Input value={(form.hero_data as any)?.tag || ""} onChange={e => updateNested("hero_data", "tag", e.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Headline</label>
                <Textarea value={(form.hero_data as any)?.headline || ""} onChange={e => updateNested("hero_data", "headline", e.target.value)} className="text-xs mt-1 min-h-[60px]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Descrição</label>
                <Textarea value={(form.hero_data as any)?.description || ""} onChange={e => updateNested("hero_data", "description", e.target.value)} className="text-xs mt-1 min-h-[60px]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Imagem URL</label>
                <Input value={(form.hero_data as any)?.image || ""} onChange={e => updateNested("hero_data", "image", e.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENT */}
        <TabsContent value="content" className="space-y-4 mt-4">
          {/* Pains */}
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs">Dores</CardTitle>
              <Button variant="ghost" size="sm" onClick={addPain} className="h-7 text-[10px] gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {pains.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <GripVertical className="h-3.5 w-3.5 mt-2.5 text-muted-foreground/40 shrink-0" />
                  <Input value={p.text} onChange={e => { const next = [...pains]; next[i] = { text: e.target.value }; update("pain_data", next as any); }} className="h-8 text-xs" />
                  <Button variant="ghost" size="sm" onClick={() => removePain(i)} className="h-8 w-8 p-0 shrink-0"><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Solutions */}
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs">Soluções</CardTitle>
              <Button variant="ghost" size="sm" onClick={addSolution} className="h-7 text-[10px] gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {solutions.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input value={s} onChange={e => { const next = [...solutions]; next[i] = e.target.value; updateNested("solution_data", "items", next); }} className="h-8 text-xs" />
                  <Button variant="ghost" size="sm" onClick={() => { const next = solutions.filter((_, idx) => idx !== i); updateNested("solution_data", "items", next); }} className="h-8 w-8 p-0 shrink-0"><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs">Benefícios</CardTitle>
              <Button variant="ghost" size="sm" onClick={addBenefit} className="h-7 text-[10px] gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {benefits.map((b, i) => (
                <div key={i} className="border border-border/30 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Benefício {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeBenefit(i)} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                  </div>
                  <Input value={b.title} onChange={e => { const next = [...benefits]; next[i] = { ...next[i], title: e.target.value }; update("benefits_data", next as any); }} className="h-8 text-xs" placeholder="Título" />
                  <Textarea value={b.text} onChange={e => { const next = [...benefits]; next[i] = { ...next[i], text: e.target.value }; update("benefits_data", next as any); }} className="text-xs min-h-[40px]" placeholder="Descrição" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs">Perguntas Frequentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={addFaq} className="h-7 text-[10px] gap-1"><Plus className="h-3 w-3" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {faqs.map((f, i) => (
                <div key={i} className="border border-border/30 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">FAQ {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeFaq(i)} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                  </div>
                  <Input value={f.question} onChange={e => updateFaq(i, "question", e.target.value)} className="h-8 text-xs" placeholder="Pergunta" />
                  <Textarea value={f.answer} onChange={e => updateFaq(i, "answer", e.target.value)} className="text-xs min-h-[60px]" placeholder="Resposta" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALCULATOR */}
        <TabsContent value="calculator" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4"><CardTitle className="text-xs">Configuração da Calculadora</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Calculadora habilitada</label>
                <Switch checked={(form.calculator_config as any)?.enabled !== false} onCheckedChange={v => updateNested("calculator_config", "enabled", v)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Modo</label>
                <Select value={(form.calculator_config as any)?.mode || "both"} onValueChange={v => updateNested("calculator_config", "mode", v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Recorrente + Sob Demanda</SelectItem>
                    <SelectItem value="recorrente_only">Apenas Recorrente</SelectItem>
                    <SelectItem value="sob_demanda_only">Apenas Sob Demanda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Calculadora de horas</label>
                <Switch checked={(form.calculator_config as any)?.showHoursCalculator || false} onCheckedChange={v => updateNested("calculator_config", "showHoursCalculator", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RELATIONS */}
        <TabsContent value="relations" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4"><CardTitle className="text-xs">Relações</CardTitle></CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Serviços relacionados (slugs, separados por vírgula)</label>
                <Input value={(form.related_services || []).join(", ")} onChange={e => update("related_services", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Segmentos relacionados (slugs, separados por vírgula)</label>
                <Input value={(form.related_segments || []).join(", ")} onChange={e => update("related_segments", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="h-8 text-xs mt-1" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NICHE (segment only) */}
        {pageType === "segment" && (
          <TabsContent value="niche" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardHeader className="py-3 px-4"><CardTitle className="text-xs">Dados do Nicho</CardTitle></CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Contexto da indústria</label>
                  <Textarea value={(form.niche_data as any)?.industryContext || ""} onChange={e => updateNested("niche_data", "industryContext", e.target.value)} className="text-xs mt-1 min-h-[60px]" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Detalhes operacionais</label>
                  <Textarea value={(form.niche_data as any)?.operationDetails || ""} onChange={e => updateNested("niche_data", "operationDetails", e.target.value)} className="text-xs mt-1 min-h-[60px]" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Regulações (uma por linha)</label>
                  <Textarea value={((form.compliance_data as any)?.regulations || []).join("\n")} onChange={e => updateNested("compliance_data", "regulations", e.target.value.split("\n").filter(Boolean))} className="text-xs mt-1 min-h-[60px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* BLOCKS */}
        <TabsContent value="blocks" className="space-y-4 mt-4">
          <Card className="border-border/60">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs">Composição de Blocos</CardTitle>
              <Select onValueChange={v => {
                const current = (form.blocks_order || []) as any[];
                update("blocks_order", [...current, { type: v, variant: "default", data: {} }] as any);
              }}>
                <SelectTrigger className="w-40 h-7 text-[10px]"><SelectValue placeholder="Adicionar bloco" /></SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map(b => (
                    <SelectItem key={b.type} value={b.type} className="text-xs">{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {((form.blocks_order || []) as any[]).map((block, i) => (
                <div key={i} className="flex items-center gap-2 border border-border/30 rounded p-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <Badge variant="secondary" className="text-[10px]">{block.type}</Badge>
                  <span className="text-[10px] text-muted-foreground flex-1">{BLOCK_TYPES.find(b => b.type === block.type)?.description || ""}</span>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const next = ((form.blocks_order || []) as any[]).filter((_, idx) => idx !== i);
                    update("blocks_order", next as any);
                  }} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
                </div>
              ))}
              {((form.blocks_order || []) as any[]).length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum bloco adicionado. A página usará o template padrão.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
