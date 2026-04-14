import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/* ── FormCard ── */
export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-5xl mx-auto space-y-0", className)}>
      {children}
    </div>
  );
}

/* ── FormHeader ── */
export function FormHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-4 mb-4 border-b border-border">
      <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* ── SectionHeader ── */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("pt-5 pb-2 border-b border-border mb-3", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c43b52]">{title}</h3>
    </div>
  );
}

/* ── FormGrid ── */
export function FormGrid({ children, cols = 2, className }: { children: React.ReactNode; cols?: 1 | 2 | 3 | 4; className?: string }) {
  const gridCls =
    cols === 1 ? "grid grid-cols-1 gap-x-4 gap-y-3"
    : cols === 3 ? "grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3"
    : cols === 4 ? "grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3"
    : "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3";
  return <div className={cn(gridCls, "items-end", className)}>{children}</div>;
}

/* ── FieldWrapper ── */
export function FieldWrapper({ label, children, span, className }: {
  label: string; children: React.ReactNode; span?: "full" | "half"; className?: string;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-1.5",
      span === "full" && "sm:col-span-full",
      className
    )}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ── FormInput ── */
export function FormInput({ label, value, onChange, type = "text", span, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; span?: "full" | "half"; placeholder?: string;
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </FieldWrapper>
  );
}

/* ── FormSelect ── */
export function FormSelect({ label, value, onValueChange, options, placeholder = "Selecionar", span }: {
  label: string; value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; span?: "full" | "half";
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/* ── FormTextarea ── */
export function FormTextarea({ label, value, onChange, span, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; span?: "full" | "half"; rows?: number;
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} />
    </FieldWrapper>
  );
}

/* ── FormCheckbox ── */
export function FormCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center h-10">
      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="accent-[#c43b52] w-4 h-4 rounded"
        />
        {label}
      </label>
    </div>
  );
}

/* ── FormActions ── */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5 mt-5 border-t border-border", className)}>
      {children}
    </div>
  );
}
