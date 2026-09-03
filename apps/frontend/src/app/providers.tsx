'use client';

import { SessionProvider } from '@/shared/session/session-provider';
import { ToastProvider } from '@/shared/ui/toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
