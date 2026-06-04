import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/shared/components/layout/AdminShell';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, X } from 'lucide-react';
import type { Service, ServiceCategory } from '@/shared/types/domain';
import { formatBRL } from '@/shared/lib/formatters';

type FormState = Partial<Service> & { id?: string };
const empty: FormState = { slug: '', name: '', short_description: '', long_description: '', base_price_cents: 0, category_id: null, is_active: true, display_order: 0 };

const AdminServicos = () => {
  const [list, setList] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceBRL, setPriceBRL] = useState('');

  useEffect(() => {
    document.title = 'Serviços | Admin';
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      supabase.from('lp_services' as any).select('*').order('display_order', { ascending: true }),
      supabase.from('lp_service_categories' as any).select('*').order('display_order', { ascending: true }),
    ]);
    if (s.error) toast.error(s.error.message);
    if (c.error) toast.error(c.error.message);
    setList((s.data ?? []) as unknown as Service[]);
    setCategories((c.data ?? []) as unknown as ServiceCategory[]);
    setLoading(false);
  };

  const categoriesById = useMemo(() => {
    const m = new Map<string, ServiceCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const openEdit = (s?: Service) => {
    if (s) { setEditing(s); setPriceBRL((s.base_price_cents / 100).toFixed(2).replace('.', ',')); }
    else { setEditing(empty); setPriceBRL('0,00'); }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim() || !editing.slug?.trim()) { toast.error('Nome e slug são obrigatórios'); return; }
    const cents = Math.round(Number(priceBRL.replace(/\./g, '').replace(',', '.')) * 100);
    if (Number.isNaN(cents) || cents < 0) { toast.error('Preço inválido'); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      slug: editing.slug.trim().toLowerCase(),
      short_description: editing.short_description?.trim() || null,
      long_description: editing.long_description?.trim() || null,
      base_price_cents: cents,
      category_id: editing.category_id || null,
      is_active: !!editing.is_active,
      display_order: Number(editing.display_order ?? 0),
    };
    const { error } = editing.id
      ? await supabase.from('lp_services' as any).update(payload).eq('id', editing.id)
      : await supabase.from('lp_services' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Serviço salvo');
    setEditing(null);
    void load();
  };

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catálogo, preços e disponibilidade.</p>
        </div>
        <Button onClick={() => openEdit()}><Plus className="mr-2 size-4" /> Novo serviço</Button>
      </div>

      {editing && (
        <div className="mb-6 rounded-sm border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-sm uppercase tracking-widest text-accent">{editing.id ? 'Editando' : 'Novo serviço'}</h2>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="size-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={160} /></Field>
            <Field label="Slug (URL)"><Input value={editing.slug ?? ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="ex: posse-arma-fogo" maxLength={120} /></Field>
            <Field label="Categoria">
              <Select value={editing.category_id ?? '__none__'} onValueChange={(v) => setEditing({ ...editing, category_id: v === '__none__' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preço base (R$)"><Input inputMode="decimal" value={priceBRL} onChange={(e) => setPriceBRL(e.target.value)} placeholder="0,00" /></Field>
            <Field label="Ordem"><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} /></Field>
            <Field label="Ativo"><div className="flex h-10 items-center"><Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /></div></Field>
            <div className="sm:col-span-2"><Field label="Descrição curta"><Textarea value={editing.short_description ?? ''} onChange={(e) => setEditing({ ...editing, short_description: e.target.value })} rows={2} maxLength={400} /></Field></div>
            <div className="sm:col-span-2"><Field label="Descrição longa"><Textarea value={editing.long_description ?? ''} onChange={(e) => setEditing({ ...editing, long_description: e.target.value })} rows={5} maxLength={4000} /></Field></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando...</div>
      ) : list.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border p-10 text-center text-muted-foreground">Nenhum serviço cadastrado.</div>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => {
            const cat = s.category_id ? categoriesById.get(s.category_id) : null;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-bold uppercase tracking-wide">{s.name}</span>
                    <Badge variant="outline">/{s.slug}</Badge>
                    <Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Ativo' : 'Inativo'}</Badge>
                    {cat && <Badge variant="secondary">{cat.name}</Badge>}
                    <span className="font-heading text-sm text-accent">{formatBRL(s.base_price_cents)}</span>
                  </div>
                  {s.short_description && <p className="mt-1 truncate text-sm text-muted-foreground">{s.short_description}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}><Pencil className="mr-2 size-4" /> Editar</Button>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block font-heading text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    {children}
  </label>
);

export default AdminServicos;