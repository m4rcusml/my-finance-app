import Link from 'next/link';
import { Lineicons } from '@lineiconshq/react-lineicons';
import {
  ArrowLeftOutlined,
  DashboardSquare1Outlined,
  RefreshCircle1ClockwiseOutlined,
  Wallet1Outlined,
} from '@lineiconshq/free-icons';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: DashboardSquare1Outlined },
  { label: 'Contas', href: '/accounts', icon: Wallet1Outlined },
  {
    label: 'Transacoes',
    href: '/transactions',
    icon: RefreshCircle1ClockwiseOutlined,
  },
];

export function Sidebar() {
  return (
    <aside className="flex h-full flex-col gap-5 rounded-[32px] border border-foreground/10 bg-layer01 p-6 text-muted-foreground shadow-2xl shadow-layer00/60">
      <div className="flex items-center justify-between text-muted-foreground">
        <button type="button" className="text-lg p-2">
          <Lineicons icon={ArrowLeftOutlined} size={32} aria-hidden />
        </button>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ${
              item.href === '/dashboard'
                ? 'bg-layer02 text-foreground'
                : 'text-muted-foreground hover:bg-layer02 hover:text-foreground'
            }`}
          >
            <span className="inline-flex p-2 items-center justify-center rounded-xl bg-layer02 text-sm text-muted-foreground">
              <Lineicons icon={item.icon} size={32} aria-hidden />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
