import { Link, NavLink } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useCart } from '@/shared/cart/CartProvider';
import {
  Menu,
  ShieldCheck,
  ShoppingCart,
  ChevronDown,
  X,
  Briefcase,
  Stethoscope,
  UserPlus,
  Camera,
  UserCircle,
  LayoutDashboard,
  LogIn,
  ChevronRight,
} from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';
import { BackButton } from '@/shared/components/BackButton';

interface SiteShellProps {
  children: ReactNode;
}

const navItems = [
  { to: '/servicos', label: 'Serviços', icon: Briefcase },
  { to: '/descobrir-meu-caminho', label: 'Diagnóstico', icon: Stethoscope },
];

type NavLinkItem = { to: string; label: string; icon: typeof Briefcase };

const queroArmasGroups: { label: string; links: NavLinkItem[] }[] = [
  {
    label: 'Público',
    links: [
      { to: '/cadastro', label: 'Cadastro de cliente', icon: UserPlus },
      { to: '/enviar-foto', label: 'Enviar foto', icon: Camera },
    ],
  },
  {
    label: 'Administração',
    links: [
      { to: '/dashboard', label: 'Painel Admin', icon: LayoutDashboard },
    ],
  },
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
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 font-heading text-sm uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground focus:outline-none">
                Quero Armas <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[80vh] w-64 overflow-y-auto">
                {queroArmasGroups.map((group, idx) => (
                  <div key={group.label}>
                    {idx > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xs uppercase tracking-widest text-accent">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.links.map((link) => (
                      <DropdownMenuItem key={link.to} asChild>
                        <Link to={link.to}>{link.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                  <Link to="/area-do-cliente">Meu Portal</Link>
                </Button>
                <Button asChild variant="default" size="sm" className="sm:hidden">
                  <Link to="/area-do-cliente">Portal</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/area-do-cliente/login">Acesso Cliente</Link>
              </Button>
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-[88vw] max-w-sm flex-col gap-0 border-l border-border bg-gradient-to-b from-background via-background to-surface-overlay p-0 [&>button]:hidden"
              >
                {/* Header do drawer */}
                <div className="relative flex items-center justify-between border-b border-border/60 bg-surface-overlay/80 px-5 py-4 backdrop-blur">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-tactical" />
                  <Link
                    to="/"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2"
                    aria-label="Eu Quero Armas — Início"
                  >
                    <img src={logoWhite} alt="Eu Quero Armas" className="h-8 w-auto" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="flex size-9 items-center justify-center rounded-sm border border-border/60 text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                    aria-label="Fechar menu"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Conteúdo rolável */}
                <div className="flex-1 overflow-y-auto px-4 py-5">
                  {/* Navegação principal */}
                  <p className="mb-2 px-2 font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                    Navegação
                  </p>
                  <div className="flex flex-col gap-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMenuOpen(false)}
                          className={({ isActive }) =>
                            `group flex items-center gap-3 rounded-sm border px-3 py-3 font-heading text-sm uppercase tracking-[0.12em] transition-all ${
                              isActive
                                ? 'border-accent/50 bg-accent/10 text-accent shadow-brass'
                                : 'border-border/40 bg-surface-elevated/40 text-foreground hover:border-accent/30 hover:bg-surface-elevated hover:text-accent'
                            }`
                          }
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                        </NavLink>
                      );
                    })}
                  </div>

                  {/* Grupos Quero Armas */}
                  <div className="mt-6">
                    {queroArmasGroups.map((group) => (
                      <div key={group.label} className="mb-5">
                        <div className="mb-2 flex items-center gap-2 px-2">
                          <span className="h-px flex-1 bg-border/60" />
                          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-accent">
                            {group.label}
                          </p>
                          <span className="h-px flex-1 bg-border/60" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {group.links.map((link) => {
                            const Icon = link.icon;
                            return (
                              <Link
                                key={link.to}
                                to={link.to}
                                onClick={() => setMenuOpen(false)}
                                className="group flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                              >
                                <Icon className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-accent" />
                                <span className="flex-1">{link.label}</span>
                                <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer com CTA */}
                <div className="border-t border-border/60 bg-surface-overlay/80 p-4 backdrop-blur">
                  {!user ? (
                    <Button
                      asChild
                      className="h-11 w-full font-heading uppercase tracking-[0.15em] shadow-tactical"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Link to="/area-do-cliente/login">
                        <LogIn className="mr-2 size-4" /> Acesso Cliente
                      </Link>
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        asChild
                        className="h-11 w-full font-heading uppercase tracking-[0.15em] shadow-tactical"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Link to="/area-do-cliente">
                          <UserCircle className="mr-2 size-4" /> Meu Portal
                        </Link>
                      </Button>
                      {isAdmin && (
                        <Button
                          asChild
                          variant="outline"
                          className="h-10 w-full font-heading uppercase tracking-[0.15em]"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Link to="/admin">
                            <ShieldCheck className="mr-2 size-4" /> Painel Admin
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="mt-3 text-center font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                    Eu Quero Armas · Conformidade Total
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-full flex-1 overflow-x-clip pt-16 sm:pt-20">
        <div className="container pt-3">
          <BackButton />
        </div>
        {children}
      </main>

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
              <li><Link to="/area-do-cliente" className="hover:text-foreground">Portal do cliente</Link></li>
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
