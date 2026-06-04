import { useEffect, useState } from 'react';
import { AdminShell } from '@/shared/components/layout/AdminShell';
import { supabase } from '@/integrations/supabase/client';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ services: 0, orders: 0, contracts: 0, users: 0 });

  useEffect(() => {
    document.title = 'Visão geral | Admin';
    void load();
  }, []);

  const load = async () => {
    const [s, o, c, u] = await Promise.all([
      supabase.from('lp_services' as any).select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('lp_orders' as any).select('*', { count: 'exact', head: true }),
      supabase.from('lp_contracts' as any).select('*', { count: 'exact', head: true }).eq('status', 'awaiting_signature'),
      supabase.from('profiles' as any).select('*', { count: 'exact', head: true }),
    ]);
    setStats({
      services: s.count ?? 0,
      orders: o.count ?? 0,
      contracts: c.count ?? 0,
      users: u.count ?? 0,
    });
  };

  return (
    <AdminShell>
      <div className="mb-8">
        <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Painel Administrativo</div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">Visão geral</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Serviços ativos', value: stats.services },
          { label: 'Pedidos', value: stats.orders },
          { label: 'Contratos pendentes', value: stats.contracts },
          { label: 'Usuários', value: stats.users },
        ].map((s) => (
          <div key={s.label} className="rounded-sm border border-border bg-card p-6">
            <div className="font-heading text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-heading text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-sm border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Use o menu lateral para gerenciar Categorias, Serviços, Pedidos e Contratos.
      </div>
    </AdminShell>
  );
};

export default AdminDashboard;