import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BLOCK_TYPES } from "@/lib/cmsTypes";
import { LayoutTemplate, AlertTriangle, CheckCircle2, Star, Calculator, Quote, HelpCircle, Megaphone, Target, FileText } from "lucide-react";

const BLOCK_ICONS: Record<string, any> = {
  HeroContainer: LayoutTemplate,
  PainContainer: AlertTriangle,
  SolutionContainer: CheckCircle2,
  BenefitsContainer: Star,
  CalculatorContainer: Calculator,
  ProofContainer: Quote,
  FAQContainer: HelpCircle,
  CTAContainer: Megaphone,
  SegmentFitContainer: Target,
  ContractPreviewContainer: FileText,
};

export default function BlockLibrary() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Biblioteca de Blocos</h3>
        <p className="text-[10px] text-muted-foreground">Blocos reutilizáveis disponíveis para composição de páginas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BLOCK_TYPES.map(block => {
          const Icon = BLOCK_ICONS[block.type] || LayoutTemplate;
          return (
            <Card key={block.type} className="border-border/60 hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{block.label}</span>
                      <Badge variant="outline" className="text-[8px]">{block.type}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{block.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[8px]">Variante: default</Badge>
                      <Badge variant="secondary" className="text-[8px]">Reutilizável</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-[10px] text-muted-foreground text-center border-t border-border/30 pt-3 mt-4">
        {BLOCK_TYPES.length} blocos disponíveis · Drag-and-drop em versão futura
      </div>
    </div>
  );
}
