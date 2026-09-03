import { RequireAuth } from '@/shared/session/require-auth';
import { AppShell } from '@/shared/ui/app-shell';

/**
 * Single gate + single shell for every private route. Previously four pages had
 * no guard at all and the shell had no mobile navigation.
 */
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
