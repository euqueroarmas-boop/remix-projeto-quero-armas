import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink, Wrench, Loader2, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionHeader from "../shared/SectionHeader";
import type { CustomerData } from "@/pages/AreaDoClientePage";

interface SupportTool {
  id: string;
  name: string;
  description: string | null;
  tool_type: "upload" | "link";
  file_url: string | null;
  external_url: string | null;
  icon_url: string | null;
}

export default function PortalSuporte({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<SupportTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("support_tools")
        .select("id, name, description, tool_type, file_url, external_url, icon_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setTools((data as SupportTool[]) || []);
      setLoading(false);
    })();
  }, []);

  const handleDownload = (tool: SupportTool) => {
    const url = tool.tool_type === "link" ? tool.external_url : tool.file_url;
    if (url) window.open(url, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Suporte Remoto"
        description="Ferramentas de acesso remoto para atendimento técnico"
        icon={Headphones}
      />

      {/* Instruction banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Headphones size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Tudo pronto! Baixe a ferramenta abaixo e nos envie o ID para iniciarmos o suporte.
            </p>
            <p className="text-xs text-muted-foreground">
              Após instalar, abra o programa e envie o número de ID e senha exibidos para nossa equipe via WhatsApp ou chat.
            </p>
          </div>
        </div>
      </div>

      {/* Tools grid */}
      {tools.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma ferramenta disponível no momento.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="group relative rounded-xl border border-border bg-card p-5 sm:p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-start gap-4">
                {tool.icon_url ? (
                  <img
                    src={tool.icon_url}
                    alt={tool.name}
                    className="w-12 h-12 rounded-xl object-contain bg-muted/30 p-1.5 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench size={22} className="text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {tool.name}
                  </h3>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                      {tool.description}
                    </p>
                  )}
                  <Button
                    onClick={() => handleDownload(tool)}
                    size="sm"
                    className="gap-2"
                  >
                    {tool.tool_type === "link" ? (
                      <>
                        <ExternalLink size={14} />
                        Acessar download
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        Baixar e instalar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
