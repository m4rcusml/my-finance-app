'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useSession } from '@/shared/session/session-provider';

/**
 * The application shell.
 *
 * Two structural bugs are fixed here:
 *  - there was NO navigation at all below the `lg` breakpoint, so the app was
 *    unusable on a phone. There is now a drawer with a real toggle;
 *  - the shell was a `w-dvw h-dvh overflow-hidden` box, so any content taller
 *    than the viewport was simply unreachable. The main region scrolls.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Short description read by assistive tech and shown on the mobile drawer. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Painel', description: 'Visão geral do mês' },
  { href: '/transactions', label: 'Transações', description: 'Lançamentos e filtros' },
  { href: '/transactions/uncategorized', label: 'Sem categoria', description: 'Categorizar em sequência' },
  { href: '/accounts', label: 'Contas', description: 'Contas e saldos' },
  { href: '/credit-cards', label: 'Cartões', description: 'Limites e ciclo atual' },
  { href: '/categories', label: 'Categorias', description: 'Receitas e despesas' },
  { href: '/fixed-transactions', label: 'Recorrentes', description: 'Modelos e ocorrências' },
  { href: '/investments', label: 'Investimentos', description: 'Carteira manual' },
  { href: '/goals', label: 'Metas', description: 'Acompanhamento manual' },
  { href: '/imports', label: 'Importações', description: 'CSV, OFX e XLSX' },
  { href: '/backup', label: 'Backup', description: 'Exportar e restaurar' },
  { href: '/settings', label: 'Configurações', description: 'Perfil, senha e conta' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/transactions') return pathname === '/transactions';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useSession();
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close the drawer on navigation, and restore focus to the toggle.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-layer00 text-foreground">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-layer00/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          className="rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium"
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">{drawerOpen ? 'Fechar menu' : 'Abrir menu'}</span>
        </button>
        <p className="truncate text-sm font-semibold">My Finance App</p>
      </header>

      <div className="mx-auto flex w-full max-w-[1920px] gap-6 p-4 lg:p-6">
        {/* Desktop sidebar */}
        <nav aria-label="Navegação principal" className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col gap-4 overflow-y-auto rounded-3xl border border-border bg-layer01 p-4">
            <p className="px-2 text-sm font-semibold">My Finance App</p>
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
            <div className="mt-auto border-t border-border pt-3">
              <p className="truncate px-2 text-xs text-muted-foreground" title={user?.email}>
                {user?.name || user?.email}
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-2 w-full rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium transition hover:bg-layer03"
              >
                Sair
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile drawer */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 cursor-default bg-scrim"
            />
            <nav
              ref={drawerRef}
              id={drawerId}
              aria-label="Navegação principal"
              className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-3 overflow-y-auto border-r border-border bg-layer01 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Menu</p>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    toggleRef.current?.focus();
                  }}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-layer02"
                >
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Fechar menu</span>
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(pathname, item.href)} showDescription />
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t border-border pt-3">
                <p className="truncate px-2 text-xs text-muted-foreground">{user?.name || user?.email}</p>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="mt-2 w-full rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium"
                >
                  Sair
                </button>
              </div>
            </nav>
          </div>
        ) : null}

        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 pb-16 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({ item, active, showDescription }: { item: NavItem; active: boolean; showDescription?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`block rounded-xl px-3 py-2 text-sm transition ${
        active ? 'bg-layer02 font-semibold text-foreground' : 'text-muted-foreground hover:bg-layer02/70 hover:text-foreground'
      }`}
    >
      {/* The label is always rendered as text — never replaced by an icon alone,
          which is what stripped the accessible name from the old collapsed sidebar. */}
      <span className="block">{item.label}</span>
      {showDescription ? <span className="block text-xs text-muted-foreground">{item.description}</span> : null}
    </Link>
  );
}

/** Standard page header, so every screen announces itself the same way. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
