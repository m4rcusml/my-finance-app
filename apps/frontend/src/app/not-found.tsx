import Link from 'next/link';
import { Icon } from '@/components/ui/icon/icon';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-layer00 p-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-layer01">
        <Icon name="FileQuestionOutlined" size={48} className="text-primary" />
      </div>

      <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">Página não encontrada</h1>

      <p className="mb-8 max-w-md text-muted-foreground">A página que você está procurando não existe ou foi movida.</p>

      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-muted-primary"
      >
        <Icon name="DashboardSquare1Outlined" size={20} aria-hidden="true" />
        Voltar ao Dashboard
      </Link>
    </main>
  );
}
