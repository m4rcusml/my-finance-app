import Link from 'next/link';
import { Button } from '@/components/ui/button/button';
import { Icon } from '@/components/ui/icon/icon';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-layer00 p-6 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-layer01">
        <Icon name="FileQuestionOutlined" size={48} className="text-primary" />
      </div>

      <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">Página não encontrada</h1>

      <p className="mb-8 max-w-md text-gray-500">A página que você está procurando não existe ou foi movida.</p>

      <Link href="/dashboard">
        <Button size="large" tone="primary" leftIcon="DashboardSquare1Outlined">
          Voltar ao Dashboard
        </Button>
      </Link>
    </main>
  );
}
