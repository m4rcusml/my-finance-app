'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/icon/icon';
import { useSession } from '@/shared/session/session-provider';
import { GUIDED_TOUR_RESTART_EVENT, GuidedTour, restartTour, type TourStep } from '@/shared/ui/onboarding';

const DRAWER_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  tourId?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        description: 'Resumo da sua vida financeira',
        icon: 'DashboardSquare1Outlined',
        tourId: 'nav-dashboard',
      },
      {
        href: '/transactions',
        label: 'Movimentações',
        description: 'Transações, categorias e pendências',
        icon: 'RefreshDollar1Outlined',
        tourId: 'nav-movements',
      },
    ],
  },
  {
    label: 'Organização',
    items: [
      {
        href: '/fixed-transactions',
        label: 'Recorrentes',
        description: 'Contas e receitas recorrentes',
        icon: 'FileQuestionOutlined',
        tourId: 'nav-recurring',
      },
      {
        href: '/imports',
        label: 'Importações',
        description: 'Traga seu extrato com segurança',
        icon: 'FilePlusCircleOutlined',
        tourId: 'nav-imports',
      },
    ],
  },
  {
    label: 'Patrimônio',
    items: [
      {
        href: '/accounts',
        label: 'Contas e cartões',
        description: 'Saldos, limites e faturas',
        icon: 'CreditCardMultipleOutlined',
        tourId: 'nav-assets',
      },
      {
        href: '/investments',
        label: 'Investimentos',
        description: 'Sua carteira manual',
        icon: 'ArrowAngularTopRightOutlined',
      },
      {
        href: '/goals',
        label: 'Metas',
        description: 'Objetivos e progresso',
        icon: 'HandTakingDollarOutlined',
        tourId: 'nav-goals',
      },
    ],
  },
  {
    label: 'Preferências',
    items: [
      {
        href: '/settings',
        label: 'Configurações',
        description: 'Perfil, segurança e dados',
        icon: 'SlidersHorizontalSquare2Outlined',
        tourId: 'nav-settings',
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const MOBILE_NAV_ITEMS = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[4], NAV_ITEMS[7]];
const TOUR_DRAWER_STEP_IDS = new Set(['recurring', 'goals', 'imports', 'settings']);

function isActive(pathname: string, href: string): boolean {
  if (href === '/transactions') {
    return pathname === '/transactions' || pathname === '/categories' || pathname.startsWith('/transactions/');
  }
  if (href === '/accounts') return pathname === '/accounts' || pathname === '/credit-cards';
  if (href === '/settings') return pathname === '/settings' || pathname === '/backup';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerControlledByTour, setDrawerControlledByTour] = useState(false);
  const [activeTourStepId, setActiveTourStepId] = useState<string | null>(null);
  const [tourInstance, setTourInstance] = useState(0);
  const { user, logout } = useSession();
  const drawerId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const focusAfterCloseRef = useRef<'toggle' | 'main' | null>(null);

  const closeDrawerToToggle = useCallback(() => {
    focusAfterCloseRef.current = 'toggle';
    setDrawerControlledByTour(false);
    setDrawerOpen(false);
  }, []);

  const closeDrawerToMain = useCallback(() => {
    focusAfterCloseRef.current = 'main';
    setDrawerControlledByTour(false);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (pathname) setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const syncDrawerWithViewport = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        focusAfterCloseRef.current = null;
        setDrawerControlledByTour(false);
        setDrawerOpen(false);
        return;
      }
      if (!activeTourStepId) return;
      const shouldOpen = TOUR_DRAWER_STEP_IDS.has(activeTourStepId);
      focusAfterCloseRef.current = null;
      setDrawerControlledByTour(shouldOpen);
      setDrawerOpen(shouldOpen);
    };
    syncDrawerWithViewport(desktop);
    desktop.addEventListener('change', syncDrawerWithViewport);
    return () => desktop.removeEventListener('change', syncDrawerWithViewport);
  }, [activeTourStepId]);

  useEffect(() => {
    const target = focusAfterCloseRef.current;
    if (drawerOpen || !target) return;
    focusAfterCloseRef.current = null;
    (target === 'toggle' ? toggleRef : mainRef).current?.focus();
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || drawerControlledByTour) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerControlledByTour, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || drawerControlledByTour) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawerToToggle();
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE)).filter(
        (element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true',
      );
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    drawerRef.current?.querySelector<HTMLElement>('[data-drawer-close]')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeDrawerToToggle, drawerControlledByTour, drawerOpen]);

  const handleTourStepChange = useCallback((step: TourStep) => {
    setActiveTourStepId(step.id);
  }, []);

  const handleTourClosed = useCallback(() => {
    focusAfterCloseRef.current = null;
    setActiveTourStepId(null);
    setDrawerControlledByTour(false);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const handleRestart = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== user?.id) return;
      handleTourClosed();
      setTourInstance((current) => current + 1);
      if (pathname !== '/dashboard') router.push('/dashboard');
    };
    window.addEventListener(GUIDED_TOUR_RESTART_EVENT, handleRestart);
    return () => window.removeEventListener(GUIDED_TOUR_RESTART_EVENT, handleRestart);
  }, [handleTourClosed, pathname, router, user?.id]);

  const displayName = user?.name?.trim() || user?.email || 'Minha conta';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-dvh bg-layer00 text-foreground">
      <header
        inert={drawerOpen ? true : undefined}
        aria-hidden={drawerOpen ? true : undefined}
        className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-layer01/95 px-4 backdrop-blur lg:hidden"
      >
        <Brand compact />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => {
            setDrawerControlledByTour(false);
            setDrawerOpen((open) => !open);
          }}
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-border-strong bg-layer02 text-foreground transition hover:bg-layer03"
        >
          <Icon name="MenuMeatballs1Outlined" size={22} aria-hidden="true" />
          <span className="sr-only">{drawerOpen ? 'Fechar menu' : 'Abrir menu'}</span>
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-layer01 lg:flex">
        <div className="border-b border-border px-5 py-6">
          <Brand />
        </div>
        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-5" data-tour="navigation">
          <NavigationGroups pathname={pathname} />
        </nav>
        <div className="border-t border-border p-3" data-tour="profile-menu">
          <div className="flex items-center gap-3 rounded-2xl bg-layer02 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-white">
              {initials || 'MF'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" title={displayName}>
                {displayName}
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-0.5 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Sair da conta
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!user?.id) return;
                  restartTour(user.id);
                }}
                className="mt-1 block text-xs text-muted-foreground transition hover:text-foreground"
              >
                Refazer tutorial
              </button>
            </div>
          </div>
        </div>
      </aside>

      {drawerOpen ? (
        <div className={`fixed inset-0 lg:hidden ${drawerControlledByTour ? 'z-40' : 'z-[110]'}`}>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={closeDrawerToToggle}
            className="absolute inset-0 cursor-default bg-scrim"
          />
          <div
            ref={drawerRef}
            id={drawerId}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="absolute inset-y-0 right-0 flex w-[min(21rem,88vw)] flex-col overflow-y-auto border-l border-border bg-layer01 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <button
                type="button"
                data-drawer-close
                onClick={closeDrawerToToggle}
                className="order-2 inline-flex size-10 items-center justify-center rounded-xl text-2xl text-muted-foreground transition hover:bg-layer02 hover:text-foreground"
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Fechar menu</span>
              </button>
              <div className="order-1">
                <Brand onNavigate={closeDrawerToMain} />
              </div>
            </div>
            <nav aria-label="Navegação principal" className="flex-1 px-3 py-4">
              <NavigationGroups pathname={pathname} showDescription onNavigate={closeDrawerToMain} />
            </nav>
            <div className="border-t border-border p-4">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-3 w-full rounded-xl border border-border-strong bg-layer02 px-4 py-2.5 text-sm font-semibold transition hover:bg-layer03"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main
        ref={mainRef}
        id="conteudo"
        tabIndex={-1}
        inert={drawerOpen ? true : undefined}
        aria-hidden={drawerOpen ? true : undefined}
        className="min-w-0 px-4 pb-28 pt-6 outline-none sm:px-6 lg:ml-60 lg:px-8 lg:pb-12 lg:pt-8 xl:px-10"
      >
        <div className="mx-auto w-full max-w-[1200px]">{children}</div>
      </main>

      <nav
        aria-label="Navegação rápida"
        inert={drawerOpen ? true : undefined}
        aria-hidden={drawerOpen ? true : undefined}
        className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl border border-border bg-layer01/95 p-1.5 shadow-2xl backdrop-blur lg:hidden"
      >
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.68rem] font-medium transition ${
                active ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-layer02 hover:text-foreground'
              }`}
            >
              <Icon name={item.icon} size={19} aria-hidden="true" />
              <span className="max-w-full truncate">{item.label === 'Movimentações' ? 'Movimentos' : item.label}</span>
            </Link>
          );
        })}
      </nav>
      {user?.id ? (
        <GuidedTour
          key={`${user.id}:${tourInstance}`}
          userKey={user.id}
          onStepChange={handleTourStepChange}
          onComplete={handleTourClosed}
          onSkip={handleTourClosed}
        />
      ) : null}
    </div>
  );
}

function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onNavigate={onNavigate}
      className="flex min-w-0 items-center gap-3 rounded-xl"
      aria-label="My Finance, ir ao dashboard"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_24px_rgba(103,71,237,0.28)]">
        <Icon name="Wallet1Outlined" size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight">My Finance</span>
        {!compact ? <span className="block truncate text-xs text-muted-foreground">Seu dinheiro, claro.</span> : null}
      </span>
    </Link>
  );
}

function NavigationGroups({
  pathname,
  showDescription = false,
  onNavigate,
}: {
  pathname: string;
  showDescription?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-placeholder">
            {group.label}
          </h2>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  showDescription={showDescription}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NavLink({
  item,
  active,
  showDescription,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  showDescription?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onNavigate={onNavigate}
      aria-current={active ? 'page' : undefined}
      data-tour={item.tourId}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(103,71,237,0.18)]'
          : 'text-muted-foreground hover:bg-layer02 hover:text-foreground'
      }`}
    >
      <Icon name={item.icon} size={20} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0">
        <span className="block truncate">{item.label}</span>
        {showDescription ? (
          <span className={`block truncate text-xs ${active ? 'text-white' : 'text-placeholder'}`}>
            {item.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: React.ReactNode;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" data-tour="page-header">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2" data-tour="primary-action">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
