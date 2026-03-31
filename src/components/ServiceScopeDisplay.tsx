import { CheckCircle2, XCircle, Clock, Shield, Users } from "lucide-react";
import type { ServiceScope } from "@/data/serviceScopes";

interface ServiceScopeDisplayProps {
  scope: ServiceScope;
  compact?: boolean;
}

/**
 * Componente reutilizável que renderiza o escopo de um serviço.
 * Usado nas páginas de serviço para exibir o que está/não está incluso.
 */
export default function ServiceScopeDisplay({ scope, compact = false }: ServiceScopeDisplayProps) {
  return (
    <div className="space-y-6" data-testid="scope-section">
      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed" data-testid="scope-description">{scope.description}</p>

      <div className={`grid gap-6 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {/* Included */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-mono font-bold text-foreground uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Incluso no escopo
          </h4>
          <ul className="space-y-2" data-testid="scope-included-list">
            {scope.included.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Not included */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-mono font-bold text-foreground uppercase tracking-wider">
            <XCircle className="w-4 h-4 text-destructive/70" />
            Não incluso
          </h4>
          <ul className="space-y-2" data-testid="scope-not-included-list">
            {scope.not_included.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-destructive/50 mt-0.5 shrink-0">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* SLA + Frequency + Dependencies */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">SLA</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed" data-testid="scope-sla">{scope.sla}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Frequência</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed" data-testid="scope-frequency">{scope.frequency}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Responsabilidades</span>
          </div>
          <ul className="space-y-1" data-testid="scope-dependencies">
            {scope.client_dependencies.map((dep, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {dep}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
