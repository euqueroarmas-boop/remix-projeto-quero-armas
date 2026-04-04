import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Copy, Archive, Eye, EyeOff, Pencil, Trash2, Search, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { CmsPage, PageType } from "@/lib/cmsTypes";
import { fetchCmsPages, updatePageStatus, duplicateCmsPage, deleteCmsPage } from "@/lib/cmsApi";

interface PageListProps {
  pageType: PageType;
  onEdit: (page: CmsPage) => void;
  onNew: () => void;
}

// Known legacy pages mapping
const LEGACY_SERVICES: Record<string, string> = {
  "administracao-de-servidores": "AdministracaoServidoresPage",
  "monitoramento-de-servidores": "MonitoramentoServidoresPage",
  "backup-corporativo": "BackupCorporativoPage",
  "seguranca-de-rede": "SegurancaDeRedePage",
  "monitoramento-de-rede": "MonitoramentoDeRedePage",
  "suporte-tecnico-emergencial": "SuporteEmergencialPage",
  "suporte-windows-server": "SuporteWindowsServerPage",
  "suporte-linux": "SuporteLinuxPage",
  "manutencao-de-infraestrutura-de-ti": "ManutencaoInfraestruturaPage",
  "suporte-tecnico-para-redes-corporativas": "SuporteRedesCorporativasPage",
  "reestruturacao-completa-de-rede-corporativa": "ReestruturacaoRedePage",
  "desenvolvimento-de-sites-e-sistemas-web": "DesenvolvimentoWebPage",
  "automacao-de-ti-com-inteligencia-artificial": "AutomacaoIaPage",
  "automacao-alexa-casa-empresa-inteligente": "AutomacaoAlexaPage",
  "firewall-pfsense-jacarei": "FirewallPfsensePage",
  "servidor-dell-poweredge-jacarei": "ServidoresDellPage",
  "microsoft-365-para-empresas-jacarei": "Microsoft365Page",
  "montagem-e-monitoramento-de-redes-jacarei": "MontagemRedesPage",
  "locacao-de-computadores-para-empresas-jacarei": "LocacaoComputadoresPage",
  "suporte-ti-jacarei": "SuporteTiPage",
  "infraestrutura-ti-corporativa-jacarei": "InfraestruturaCorporativaPage",
  "terceirizacao-de-mao-de-obra-ti": "TerceirizacaoPage",
};

const LEGACY_SEGMENTS: Record<string, string> = {
  "ti-para-cartorios": "TiCartoriosPage",
  "ti-para-serventias-cartoriais": "TiServentiasCartoriaisPage",
  "ti-para-tabelionatos-de-notas": "TiTabelionatosNotasPage",
  "ti-para-oficios-de-registro": "TiTabelionatosRegistrosPage",
  "ti-para-tabelionatos-de-protesto": "TiTabelionatosProtestoPage",
  "ti-para-industrias-alimenticias": "TiIndustriasAlimenticiaPage",
  "ti-para-industrias-petroliferas": "TiIndustriasPetroliferasPage",
  "ti-para-escritorios-de-advocacia": "TiEscritoriosAdvocaciaPage",
  "ti-para-contabilidades": "TiContabilidadesPage",
  "ti-para-escritorios-corporativos": "TiEscritoriosCorporativosPage",
  "ti-para-hospitais-e-clinicas": "TiHospitaisClinicasPage",
};

export default function PageList({ pageType, onEdit, onNew }: PageListProps) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const legacyMap = pageType === "service" ? LEGACY_SERVICES : LEGACY_SEGMENTS;

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCmsPages(pageType);
      setPages(data);
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [pageType]);

  // Merge CMS pages with legacy pages that aren't in CMS yet
  const cmsSlugs = new Set(pages.map(p => p.slug));
  const legacyOnly = Object.entries(legacyMap)
    .filter(([slug]) => !cmsSlugs.has(slug))
    .map(([slug, component]) => ({
      id: `legacy-${slug}`,
      slug,
      title: slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      status: "published" as const,
      legacy_component: component,
      page_type: pageType,
      updated_at: "",
      created_at: "",
    } as CmsPage));

  const allPages = [...pages, ...legacyOnly];
  const filtered = allPages.filter(p => 
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase())
  );

  const handleAction = async (action: string, page: CmsPage) => {
    try {
      switch (action) {
        case "publish":
          await updatePageStatus(page.id, "published");
          toast.success("Publicada!");
          break;
        case "unpublish":
          await updatePageStatus(page.id, "draft");
          toast.success("Despublicada!");
          break;
        case "archive":
          await updatePageStatus(page.id, "archived");
          toast.success("Arquivada!");
          break;
        case "duplicate":
          await duplicateCmsPage(page.id);
          toast.success("Duplicada!");
          break;
        case "delete":
          if (confirm("Excluir permanentemente?")) {
            await deleteCmsPage(page.id);
            toast.success("Excluída!");
          }
          break;
      }
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs pl-8" placeholder="Buscar por título ou slug..." />
          </div>
        </div>
        <Button size="sm" onClick={onNew} className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nova Página
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-xs">Nenhuma página encontrada</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(page => {
            const isLegacy = page.id.startsWith("legacy-");
            return (
              <Card key={page.id} className="p-3 border-border/60">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{page.title}</span>
                        {isLegacy && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">Legado</Badge>}
                        <Badge variant={page.status === "published" ? "default" : page.status === "archived" ? "destructive" : "secondary"} className="text-[9px]">
                          {page.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">/{page.slug}</span>
                        {page.updated_at && (
                          <span className="text-[10px] text-muted-foreground">· {new Date(page.updated_at).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isLegacy ? (
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onEdit(page)}>
                        <Pencil className="h-3 w-3" /> Migrar para CMS
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(page)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleAction("duplicate", page)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {page.status === "published" ? (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleAction("unpublish", page)}>
                            <EyeOff className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleAction("publish", page)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleAction("archive", page)}>
                          <Archive className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleAction("delete", page)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted/50">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        {filtered.length} páginas · {filtered.filter(p => p.id.startsWith("legacy-")).length} legadas · {filtered.filter(p => !p.id.startsWith("legacy-")).length} CMS
      </div>
    </div>
  );
}
