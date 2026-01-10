import Link from 'next/link';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'lni lni-grid-alt' },
  { label: 'Contas', href: '/accounts', icon: 'lni lni-wallet' },
  { label: 'Transacoes', href: '/transactions', icon: 'lni lni-reload' },
];

export function Sidebar() {
  return (
    <aside className="flex h-full flex-col gap-6 rounded-[32px] border border-foreground/10 bg-layer01 p-6 text-muted-foreground shadow-2xl shadow-layer00/60">
      <div className="flex items-center justify-between text-muted-foreground">
        <button type="button" className="text-lg">
          <i className="lni lni-arrow-left" aria-hidden />
        </button>
        <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
          MFA
        </span>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
              item.href === '/dashboard'
                ? 'bg-layer02 text-foreground'
                : 'text-muted-foreground hover:bg-layer02 hover:text-foreground'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-layer02 text-sm text-muted-foreground">
              <i className={item.icon} aria-hidden />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
