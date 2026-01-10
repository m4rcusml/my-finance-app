'use client';

import { useState } from 'react';
import { type IconName } from '../icon';
import { SidebarItem } from './sidebar-item';
import { Button } from '../button';

const navItems: { label: string; href: string; icon: IconName }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'DashboardSquare1Outlined' },
  { label: 'Contas', href: '/accounts', icon: 'Wallet1Outlined' },
  { label: 'Transacoes', href: '/transactions', icon: 'RefreshDollar1Outlined' },
];

export function Sidebar() {
  const [isColapsed, setIsColapsed] = useState(false);

  function handleColapsed() {
    setIsColapsed((prev) => !prev);
  }

  return (
    <aside className="flex h-full flex-col gap-4 rounded-4xl border border-foreground/10 bg-layer01 p-4 text-muted-foreground shadow-2xl shadow-layer00/60">
      <div className="flex items-center justify-between text-muted-foreground">
        <Button
          tone="layer01"
          size="large"
          onClick={handleColapsed}
          leftIcon={isColapsed ? 'ShiftRightOutlined' : 'ShiftLeftOutlined'}
        />
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <SidebarItem key={item.href} {...item} canShowLabel={!isColapsed} />
        ))}
      </nav>
    </aside>
  );
}
