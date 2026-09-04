import Link from 'next/link';

export interface SegmentedTab {
  value: string;
  label: string;
  href: string;
  count?: number;
}

export function SegmentedTabs({ label, active, tabs }: { label: string; active: string; tabs: SegmentedTab[] }) {
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto" data-tour="section-tabs">
      <ul className="flex min-w-max gap-2 py-1">
        {tabs.map((tab) => {
          const selected = tab.value === active;
          return (
            <li key={tab.value}>
              <Link
                href={tab.href}
                aria-current={selected ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition ${
                  selected
                    ? 'border-primary bg-primary text-foreground'
                    : 'border-border bg-layer02 text-muted-foreground hover:bg-layer03 hover:text-foreground'
                }`}
              >
                {tab.label}
                {typeof tab.count === 'number' ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      selected ? 'bg-primary text-white' : 'bg-layer02 text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Surface({
  children,
  className = '',
  as: Element = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Element className={`rounded-2xl border border-border bg-layer01 ${className}`}>{children}</Element>;
}
