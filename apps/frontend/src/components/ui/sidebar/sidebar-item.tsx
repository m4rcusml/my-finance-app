'use client';

import Link from 'next/link';
import { Icon, IconName } from '../icon/icon';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  label: string;
  icon: IconName;
  href: string;
  canShowLabel?: boolean;
}

export function SidebarItem({ icon, label, href, canShowLabel = true }: SidebarProps) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl py-2 text-sm transition ${canShowLabel ? 'px-3 pr-8' : 'px-2'} ${
        pathname.startsWith(href)
          ? 'bg-layer02 text-muted-primary font-medium'
          : 'text-muted-foreground hover:bg-layer02/70 hover:text-foreground'
      }`}
    >
      <span className="p-2">
        <Icon name={icon} size={32} aria-hidden />
      </span>
      {canShowLabel ? label : undefined}
    </Link>
  );
}
