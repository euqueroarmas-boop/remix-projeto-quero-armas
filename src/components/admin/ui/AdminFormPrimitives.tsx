import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ── FormCard ── */
export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "w-full max-w-5xl mx-auto bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-6 sm:p-8 md:p-10",
      className
    )}>
      {children}
    </div>
  );
}

/* ── FormHeader ── */
export function FormHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-6 mb-6 border-b border-[#1a1a1a]">
      <h2 className="text-lg sm:text-xl font-semibold text-neutral-100 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs sm:text-sm text-neutral-500 mt-1">{subtitle}</p>}
    </div>
  );
}

/* ── SectionHeader ── */
export function SectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("pt-6 pb-3 border-b border-[#1a1a1a] mb-4", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#c43b52]">{title}</h3>
    </div>
  );
}

/* ── FormGrid ── */
export function FormGrid({ children, cols = 2, className }: { children: React.ReactNode; cols?: 1 | 2 | 3 | 4; className?: string }) {
  const gridCls =
    cols === 1 ? "grid grid-cols-1 gap-x-5 gap-y-4"
    : cols === 3 ? "grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4"
    : cols === 4 ? "grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4"
    : "grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4";
  return <div className={cn(gridCls, className)}>{children}</div>;
}

/* ── FieldWrapper ── */
export function FieldWrapper({ label, children, span, className }: {
  label: string; children: React.ReactNode; span?: "full" | "half"; className?: string;
}) {
  return (
    <div className={cn(
      span === "full" && "sm:col-span-full",
      className
    )}>
      <label className="block text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Styled Input ── */
const inputBase = "h-9 text-xs sm:text-sm bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200 rounded-lg placeholder:text-neutral-600 focus:border-[#7a1528]/60 focus:ring-1 focus:ring-[#7a1528]/20 transition-colors";

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
        <SelectContent>
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
        className="text-xs sm:text-sm bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200 rounded-lg min-h-[72px] placeholder:text-neutral-600 focus:border-[#7a1528]/60 focus:ring-1 focus:ring-[#7a1528]/20 transition-colors"
      />
    </FieldWrapper>
  );
}

/* ── Action Footer ── */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-[#1a1a1a]", className)}>
      {children}
    </div>
  );
}
