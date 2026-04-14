import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ── FormCard ── */
export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "w-full max-w-5xl mx-auto bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-5 sm:p-8 md:p-10 space-y-0",
      className
    )}>
      {children}
    </div>
  );
}

/* ── FormHeader ── */
export function FormHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-5 mb-2 border-b border-[#1a1a1a]">
      <h2 className="text-base sm:text-lg font-semibold text-neutral-100 tracking-tight">{title}</h2>
      {subtitle && <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

/* ── SectionHeader ── */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("pt-5 pb-2 border-b border-[#1a1a1a] mb-3", className)}>
      <h3 className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c43b52]">{title}</h3>
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
      "flex flex-col",
      span === "full" && "sm:col-span-full",
      className
    )}>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500 mb-1 leading-none h-3">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Shared style tokens ── */
const inputBase = "h-8 w-full text-xs bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200 rounded-md placeholder:text-neutral-600 focus:border-[#7a1528]/60 focus:ring-1 focus:ring-[#7a1528]/20 transition-colors px-2.5";

/* ── Styled Input ── */
export function FormInput({ label, value, onChange, type = "text", span, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; span?: "full" | "half"; placeholder?: string;
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} className={inputBase} placeholder={placeholder} />
    </FieldWrapper>
  );
}

/* ── Styled Select ── */
export function FormSelect({ label, value, onValueChange, options, placeholder = "Selecionar", span }: {
  label: string; value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; span?: "full" | "half";
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn(inputBase, "w-full")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-[#111] border-[#1c1c1c]">
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/* ── Styled Textarea ── */
export function FormTextarea({ label, value, onChange, span, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; span?: "full" | "half"; rows?: number;
}) {
  return (
    <FieldWrapper label={label} span={span}>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="text-xs bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200 rounded-md min-h-[64px] placeholder:text-neutral-600 focus:border-[#7a1528]/60 focus:ring-1 focus:ring-[#7a1528]/20 transition-colors px-2.5"
      />
    </FieldWrapper>
  );
}

/* ── Styled Checkbox Field ── */
export function FormCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center h-8">
      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="accent-amber-500 w-3.5 h-3.5 rounded"
        />
        {label}
      </label>
    </div>
  );
}

/* ── Action Footer ── */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-5 mt-5 border-t border-[#1a1a1a]", className)}>
      {children}
    </div>
  );
}
