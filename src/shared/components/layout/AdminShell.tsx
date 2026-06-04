import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/shared/auth/AuthProvider';
import { LogOut, LayoutDashboard, Package, Tags, ShoppingBag, FileText, Users, Menu } from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/servicos', label: 'Serviços', icon: Package },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/contratos', label: 'Contratos', icon: FileText },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
];

const SidebarBody = ({ email, onSignOut, onNavigate }: { email?: string; onSignOut: () => void; onNavigate?: () => void }) => (
  <>
    <div className="flex h-16 items-center border-b border-sidebar-border px-6">
      <Link to="/" className="flex items-center gap-3" onClick={onNavigate}>
        <span className="size-2 rounded-sm bg-accent shadow-brass" />
        <span className="font-heading text-sm font-bold uppercase tracking-widest text-sidebar-foreground">
          Eu Quero Armas <span className="text-accent">/ Admin</span>
        </span>
      </Link>
    </div>

    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-sm px-3 py-2.5 font-heading text-xs uppercase tracking-widest transition-colors ${
                isActive ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon className="size-4" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>

    <div className="border-t border-sidebar-border p-4">
      <div className="mb-3 truncate text-xs text-sidebar-foreground/70">{email}</div>
      <Button variant="outline" size="sm" className="w-full" onClick={onSignOut}>
        <LogOut className="mr-2 size-4" /> Sair
      </Button>
    </div>
  </>
);

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => { setOpen(false); await signOut(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarBody email={user?.email} onSignOut={handleSignOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9" aria-label="Menu"><Menu className="size-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-sidebar-border bg-sidebar p-0">
                <SidebarBody email={user?.email} onSignOut={handleSignOut} onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-heading text-sm font-bold uppercase tracking-widest">Admin</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair"><LogOut className="size-5" /></Button>
        </header>

        <main className="min-w-0 flex-1">
          <div className="container max-w-6xl py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
};
