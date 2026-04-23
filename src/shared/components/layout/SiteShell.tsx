import { Link, NavLink } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useCart } from '@/shared/cart/CartProvider';
import { Menu, ShieldCheck, ShoppingCart } from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';

interface SiteShellProps {
  children: ReactNode;
}

const navItems = [
  { to: '/servicos', label: 'Serviços' },
  { to: '/descobrir-meu-caminho', label: 'Diagnóstico' },
];

export const SiteShell = ({ children }: SiteShellProps) => {
  const { user, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 bg-knurled opacity-60" />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="container flex h-16 items-center justify-between gap-3 sm:h-20">
          <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Eu Quero Armas — Início">
            <img src={logoWhite} alt="Eu Quero Armas" className="h-8 w-auto sm:h-10" loading="eager" decoding="async" />
          </Link>

          <nav className="hidden gap-6 lg:flex xl:gap-8">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `font-heading text-sm uppercase tracking-[0.15em] transition-colors ${
                    isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <Button asChild variant="ghost" size="icon" aria-label={`Carrinho${itemCount > 0 ? ` (${itemCount})` : ''}`} className="relative size-9 sm:size-10">
              <Link to="/carrinho">
                <ShoppingCart className="size-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 font-heading text-[10px] font-bold leading-none text-accent-foreground tabular-nums ring-2 ring-background">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>
            </Button>

            {user ? (
              <>
                {isAdmin && (
                  <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                    <Link to="/admin">
                      <ShieldCheck className="mr-2 size-4" /> Admin
                    </Link>
                  </Button>
                )}
                <Button asChild variant="default" size="sm" className="hidden sm:inline-flex">
                  <Link to="/quero-armas/area-do-cliente">Meu Portal</Link>
                </Button>
                <Button asChild variant="default" size="sm" className="sm:hidden">
                  <Link to="/quero-armas/area-do-cliente">Portal</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Acesso Cliente</Link>
              </Button>
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm border-border bg-background">
                <div className="mt-8 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `rounded-sm border px-4 py-3 font-heading text-sm uppercase tracking-[0.15em] transition-colors ${
                          isActive
                            ? 'border-accent/40 bg-accent/10 text-accent'
                            : 'border-transparent text-foreground hover:border-border hover:bg-surface-elevated'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  <div className="my-4 h-px bg-border" />
                  {!user && (
                    <Button asChild variant="default" onClick={() => setMenuOpen(false)}>
                      <Link to="/auth">Acesso Cliente</Link>
                    </Button>
                  )}
                  {user && (
                    <Button asChild variant="default" onClick={() => setMenuOpen(false)}>
                      <Link to="/quero-armas/area-do-cliente">Meu Portal</Link>
                    </Button>
                  )}
                  {user && isAdmin && (
                    <Button asChild variant="outline" onClick={() => setMenuOpen(false)}>
                      <Link to="/admin">
                        <ShieldCheck className="mr-2 size-4" /> Painel Admin
                      </Link>
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-full flex-1 overflow-x-clip pt-16 sm:pt-20">{children}</main>

      <footer className="relative z-10 border-t border-border/60 bg-surface-overlay">
        <div className="container grid gap-8 py-10 sm:grid-cols-2 sm:py-12 md:grid-cols-3">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center">
              <img src={logoWhite} alt="Eu Quero Armas" className="h-9 w-auto" loading="lazy" decoding="async" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Assessoria documental especializada para CACs, atiradores e cidadãos.
              Conformidade com a Lei 10.826/03 e Decreto 11.615/23.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-heading text-xs uppercase tracking-widest text-accent">Serviços</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/servicos" className="hover:text-foreground">Catálogo completo</Link></li>
              <li><Link to="/quero-armas/area-do-cliente" className="hover:text-foreground">Portal do cliente</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-heading text-xs uppercase tracking-widest text-accent">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Termos de uso</li>
              <li>Política de privacidade</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="container py-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Eu Quero Armas. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};
