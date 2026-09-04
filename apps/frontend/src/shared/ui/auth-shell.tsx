import Link from 'next/link';
import { Icon } from '@/components/ui/icon/icon';

export function AuthShell({
  title,
  description,
  alternateLabel,
  alternateAction,
  alternateHref,
  children,
}: {
  title: string;
  description: string;
  alternateLabel: string;
  alternateAction: string;
  alternateHref: string;
  children: React.ReactNode;
}) {
  return (
    <main id="conteudo" className="min-h-dvh bg-layer00 p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-layer01 sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-border bg-layer02 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div aria-hidden="true" className="absolute -right-32 -top-32 size-80 rounded-full bg-primary/25 blur-3xl" />
          <Link
            href="/"
            className="relative flex items-center gap-3 rounded-xl"
            aria-label="My Finance, página inicial"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_28px_rgba(103,71,237,0.35)]">
              <Icon name="Wallet1Outlined" size={24} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold">My Finance</span>
              <span className="block text-xs text-muted-foreground">Seu dinheiro, claro.</span>
            </span>
          </Link>

          <div className="relative max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Controle sem ruído
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
              Decisões melhores começam com uma visão mais clara.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Organize movimentações, acompanhe o patrimônio e transforme planos em metas — tudo no seu ritmo.
            </p>
            <ul className="mt-8 grid gap-3 text-sm text-muted-foreground">
              {[
                'Caixa e investimentos sempre separados',
                'Cartões no ciclo correto',
                'Importação revisada antes de salvar',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-xs text-white"
                  >
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-placeholder">Privado por padrão. Seus dados ficam na sua instalação.</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden" aria-label="My Finance, página inicial">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                <Icon name="Wallet1Outlined" size={22} aria-hidden="true" />
              </span>
              <span className="font-semibold">My Finance</span>
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bem-vindo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-7 text-sm text-muted-foreground">
              {alternateLabel}{' '}
              <Link href={alternateHref} className="font-semibold text-foreground underline underline-offset-4">
                {alternateAction}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
