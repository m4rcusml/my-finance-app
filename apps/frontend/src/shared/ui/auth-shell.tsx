import Image from 'next/image';
import Link from 'next/link';

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
  const isLogin = alternateHref === '/register';
  return (
    <main id="conteudo" className="grid min-h-dvh bg-layer00 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="relative hidden overflow-hidden bg-layer01 px-10 py-14 lg:flex lg:flex-col lg:justify-between xl:px-14">
        <Image
          src="/assets/figma/auth-glow-purple.svg"
          width={520}
          height={520}
          alt=""
          className="pointer-events-none absolute -left-40 -top-28 size-[520px] max-w-none"
        />
        <Image
          src="/assets/figma/auth-glow-blue.svg"
          width={420}
          height={420}
          alt=""
          className="pointer-events-none absolute -bottom-24 -right-40 size-[420px] max-w-none"
        />
        <Link href="/" className="relative flex items-center gap-4" aria-label="My Finance, página inicial">
          <span className="flex size-13 items-center justify-center rounded-2xl bg-primary text-md font-bold">M</span>
          <span className="text-[22px] font-bold">My Finance</span>
        </Link>
        <div className="relative my-16 max-w-lg">
          <h2 className="text-[2.75rem] font-bold leading-tight tracking-tight">
            Clareza para cuidar
            <br />
            do seu dinheiro.
          </h2>
          <p className="mt-6 text-[17px] text-muted-foreground">
            Organize contas, cartões, metas e investimentos sem perder o contexto.
          </p>
          <ul className="mt-12 space-y-8">
            {[
              ['Visão completa', 'Saldos, ciclos e projeções no mesmo lugar.'],
              ['Controle consciente', 'Você decide o que confirmar, importar ou restaurar.'],
              ['Privacidade por padrão', 'Sessões seguras, com acesso somente em memória.'],
            ].map(([label, hint]) => (
              <li key={label} className="flex items-start gap-4">
                <span className="relative flex size-7 shrink-0 items-center justify-center">
                  <Image src="/assets/figma/auth-benefit.svg" alt="" fill />
                  <span aria-hidden="true" className="relative text-sm">
                    ✓
                  </span>
                </span>
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative rounded-2xl border border-border bg-layer02 p-5">
          <p className="text-sm font-semibold">Seus dados, suas decisões</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A renovação da sessão é protegida. Você pode exportar seu histórico financeiro nas configurações.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-4 py-8 sm:p-10 xl:p-14">
        <div className="w-full max-w-[574px] rounded-[20px] border border-border bg-layer01 p-5 sm:p-8">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden" aria-label="My Finance, página inicial">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-bold">M</span>
            <span className="font-semibold">My Finance</span>
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <nav
            aria-label="Acesso"
            className="my-7 grid grid-cols-2 gap-1 rounded-xl border border-border bg-layer00/40 p-1"
          >
            {[
              { href: '/login', label: 'Entrar', active: isLogin },
              { href: '/register', label: 'Criar conta', active: !isLogin },
            ].map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                className={`rounded-lg px-3 py-3 text-center text-sm font-semibold ${tab.active ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-layer02'}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <div className="[&_input]:min-h-13 [&_input]:bg-layer00/40 [&_form]:gap-5 [&_button[type=submit]]:min-h-13">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {alternateLabel}{' '}
            <Link href={alternateHref} className="font-semibold text-muted-primary hover:underline">
              {alternateAction}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
