import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

/* ─────────── shared field height ─────────── */
const fieldH = "h-9 min-h-9 max-h-9 py-0";

/* ── FormCard ── */
export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full space-y-4", className)}>{children}</div>;
}

/* ── FormHeader ── */
export function FormHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-3 border-b border-border">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* ── SectionHeader ── */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("pt-4 pb-1.5 border-b border-border", className)}>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-destructive">{title}</h3>
    </div>
  );
}

/* ── FormGrid ── */
export function FormGrid({ children, cols = 2, className }: {
  children: React.ReactNode; cols?: 1 | 2 | 3; className?: string;
}) {
  const g =
    cols === 1 ? "grid grid-cols-1 gap-x-3 gap-y-2.5"
    : cols === 3 ? "grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5"
    : "grid grid-cols-2 gap-x-3 gap-y-2.5";
  return <div className={cn(g, className)}>{children}</div>;
}

/* ── FieldWrapper ── */
export function FieldWrapper({ label, children, span, className }: {
  label: string; children: React.ReactNode; span?: "full"; className?: string;
}) {
  return (
    <div className={cn("space-y-1", span === "full" && "col-span-full", className)}>
      <Label className="text-[10px] font-medium text-muted-foreground leading-none">{label}</Label>
      {children}
    </div>
  );
}

/* ── FormInput ── */
export function FormInput({ label, value, onChange, type = "text", span, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; span?: "full"; placeholder?: string;
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldH, "text-xs")}
      />
    </FieldWrapper>
  );
}

/* ── FormSelect ── */
export function FormSelect({ label, value, onValueChange, options, placeholder = "Selecionar", span }: {
  label: string; value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; span?: "full";
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn(fieldH, "text-xs")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/* ── FormTextarea ── */
export function FormTextarea({ label, value, onChange, span, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; span?: "full"; rows?: number;
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="text-xs min-h-[60px]"
      />
    </FieldWrapper>
  );
}

/* ── FormCheckbox ── */
export function FormCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn("flex items-center gap-2", fieldH)}>
      <Checkbox checked={checked} onCheckedChange={v => onChange(!!v)} />
      <Label className="text-xs text-foreground cursor-pointer select-none">{label}</Label>
    </div>
  );
}

/* ── FormActions ── */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border", className)}>
      {children}
    </div>
  );
}
