import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, Globe, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CmsPage } from "@/lib/cmsTypes";
import { fetchCmsPages } from "@/lib/cmsApi";

const SITEMAP_FILES = [
  { name: "sitemap.xml", label: "Índice Principal", type: "index" },
  { name: "sitemap-pages.xml", label: "Páginas Estáticas", type: "static" },
  { name: "sitemap-blog.xml", label: "Blog", type: "blog" },
  { name: "sitemap-programmatic.xml", label: "Programático", type: "programmatic" },
  { name: "sitemap-segments.xml", label: "Segmentos", type: "segments" },
  { name: "sitemap-problems.xml", label: "Problemas", type: "problems" },
];

export default function SitemapManager() {
  const [cmsPages, setCmsPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const pages = await fetchCmsPages();
      setCmsPages(pages);
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const publishedPages = cmsPages.filter(p => p.status === "published" && !p.noindex);
  const noindexPages = cmsPages.filter(p => p.noindex);

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Sitemaps</p>
            <p className="text-xl font-bold font-mono text-foreground">{SITEMAP_FILES.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">CMS Publicadas</p>
            <p className="text-xl font-bold font-mono text-emerald-400">{publishedPages.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Noindex</p>
            <p className="text-xl font-bold font-mono text-amber-400">{noindexPages.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total CMS</p>
            <p className="text-xl font-bold font-mono text-foreground">{cmsPages.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sitemap Files */}
      <Card className="border-border/60">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs">Arquivos de Sitemap</CardTitle>
          <Button variant="ghost" size="sm" onClick={load} className="h-7 text-[10px] gap-1">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {SITEMAP_FILES.map(file => (
            <div key={file.name} className="flex items-center justify-between p-2 rounded border border-border/30">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-foreground">{file.name}</span>
                <Badge variant="secondary" className="text-[8px]">{file.type}</Badge>
              </div>
              <a href={`https://www.wmti.com.br/${file.name}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Ver
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CMS Pages in Sitemap */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : publishedPages.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" /> Páginas CMS no Sitemap
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            {publishedPages.map(page => (
              <div key={page.id} className="flex items-center justify-between p-2 rounded border border-border/20">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-foreground">/{page.slug}</span>
                  <Badge variant="outline" className="text-[8px]">{page.page_type}</Badge>
                  <Badge variant="secondary" className="text-[8px]">p:{page.sitemap_priority}</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {page.updated_at ? new Date(page.updated_at).toLocaleDateString("pt-BR") : "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        Sitemaps estáticos gerados por <code className="bg-muted/30 px-1 rounded">generate-sitemaps.mjs</code> · Edge function <code className="bg-muted/30 px-1 rounded">sitemap</code> para dinâmicos
      </div>
    </div>
  );
}
