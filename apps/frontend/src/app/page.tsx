import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 bg-layer00">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="p-4 bg-layer01 rounded-full">
          <span className="text-4xl">💰</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground">My Finance App</h1>
        <p className="text-lg text-muted-foreground">
          Controle suas finanças de forma simples e inteligente. Acompanhe contas, transações, metas e investimentos em um só lugar.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/login">
          <Button size="xLarge">Entrar</Button>
        </Link>
        <Link href="/register">
          <Button size="xLarge" tone="layer01">Criar conta</Button>
        </Link>
      </div>
    </div>
  );
}
