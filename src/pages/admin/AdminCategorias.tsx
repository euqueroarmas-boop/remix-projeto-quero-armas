import { useEffect, useState } from 'react';
import { AdminShell } from '@/shared/components/layout/AdminShell';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, X } from 'lucide-react';
import type { ServiceCategory } from '@/shared/types/domain';

type FormState = Partial<ServiceCategory> & { id?: string };
const empty: FormState = { slug: '', name: '', description: '', display_order: 0, is_active: true };

const AdminCategorias = () => {
  const [list, setList] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Categorias | Admin';
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('lp_service_categories' as any).select('*').order('display_order', { ascending: true });
    if (error) toast.error(error.message);
    setList((data ?? []) as unknown as ServiceCategory[]);
    setLoading(false);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim() || !editing.slug?.trim()) { toast.error('Nome e slug são obrigatórios'); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      slug: editing.slug.trim().toLowerCase(),
      description: editing.description?.trim() || null,
      display_order: Number(editing.display_order ?? 0),
      is_active: !!editing.is_active,
    };
    const { error } = editing.id
      ? await supabase.from('lp_service_categories' as any).update(payload).eq('id', editing.id)
      : await supabase.from('lp_service_categories' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Categoria salva');
    setEditing(null);
    void load();
  };

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Categorias</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agrupamentos de serviços por entidade reguladora.</p>
        </div>
        <Button onClick={() => setEditing(empty)}><Plus className="mr-2 size-4" /> Nova categoria</Button>
      </div>

      {editing && (
        <div className="mb-6 rounded-sm border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-sm uppercase tracking-widest text-accent">{editing.id ? 'Editando' : 'Nova categoria'}</h2>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="size-4" /></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} /></Field>
            <Field label="Slug (URL)"><Input value={editing.slug ?? ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="ex: sinarm-pf" maxLength={80} /></Field>
            <Field label="Ordem"><Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} /></Field>
            <Field label="Ativa"><div className="flex h-10 items-center"><Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /></div></Field>
            <div className="sm:col-span-2"><Field label="Descrição"><Textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} maxLength={500} /></Field></div>
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
        <div className="rounded-sm border border-dashed border-border p-10 text-center text-muted-foreground">Nenhuma categoria cadastrada.</div>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-sm font-bold uppercase tracking-wide">{c.name}</span>
                  <Badge variant="outline">/{c.slug}</Badge>
                  <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  <span className="text-xs text-muted-foreground">ordem {c.display_order}</span>
                </div>
                {c.description && <p className="mt-1 truncate text-sm text-muted-foreground">{c.description}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(c)}><Pencil className="mr-2 size-4" /> Editar</Button>
            </li>
          ))}
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

export default AdminCategorias;