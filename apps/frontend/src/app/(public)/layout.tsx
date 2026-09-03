import { RedirectIfAuthenticated } from '@/shared/session/require-auth';

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RedirectIfAuthenticated>{children}</RedirectIfAuthenticated>;
}
