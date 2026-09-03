import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'My Finance App — gerenciador financeiro pessoal',
  description:
    'Contas, cartões, categorias, transações, recorrências, investimentos manuais, metas, importação de extratos e backup local.',
};

/**
 * Landing page.
 *
 * Everything listed under "O que já está pronto" is implemented and shipping in
 * V1. Anything not yet built lives under "No radar" and is explicitly labelled
 * as planned — the page must never advertise a capability the product does not
 * have (the previous copy promised live quotes, broker integrations and
 * automatic categorisation).
 */

const SHIPPED = [
  { title: 'Contas e cartões', body: 'Saldos calculados a partir dos lançamentos e uso do ciclo atual do cartão, respeitando o dia de fechamento.' },
  { title: 'Transações', body: 'Receitas e despesas com categorias, filtros por período, paginação e um fluxo dedicado para lançamentos sem categoria.' },
  { title: 'Painel', body: 'Saldo em caixa separado do que está em contas de investimento, comparação com o período anterior e os últimos 12 meses.' },
  { title: 'Recorrentes', body: 'Modelos mensais que geram ocorrências, com confirmação na data real, opção de pular e histórico preservado.' },
  { title: 'Investimentos', body: 'Carteira registrada manualmente com custo de aquisição por ativo. Sem cotação: os valores são os que você informou.' },
  { title: 'Metas', body: 'Objetivos com progresso atualizado por você — o app não deduz o valor a partir das transações.' },
  { title: 'Importação', body: 'CSV, OFX e XLSX do Banco Inter e no formato genérico, com pré-visualização, erros por linha e sem duplicar reimportações.' },
  { title: 'Backup local', body: 'Exportação completa em JSON e restauração no modo substituir ou mesclar, tudo dentro de uma transação.' },
];

const PLANNED = [
  'Cotação de mercado ao vivo e histórico de preços',
  'Integrações com Mercado Pago, BTG, Binance, Bipa, Coinbase e outras corretoras',
  'Categorização automática por aprendizado de máquina',
  'Alertas por e-mail ou push, otimizador de carteira, modo offline e backup em nuvem',
];

export default function Home() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-12 px-5 py-12 sm:px-8">
      <section className="flex flex-col items-start gap-5">
        <span className="rounded-full bg-layer01 px-3 py-1 text-xs font-medium text-muted-foreground">
          Versão 1 · em português do Brasil
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">My Finance App</h1>
        <p className="max-w-2xl text-md text-muted-foreground">
          Um gerenciador financeiro pessoal para acompanhar contas, cartões, lançamentos, despesas
          recorrentes, investimentos e metas — com os seus dados guardados no seu próprio banco.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold transition hover:bg-muted-primary"
          >
            Criar conta
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border-strong bg-layer02 px-5 py-2.5 text-sm font-semibold transition hover:bg-layer03"
          >
            Entrar
          </Link>
        </div>
      </section>

      <section aria-labelledby="pronto">
        <h2 id="pronto" className="text-lg font-semibold">
          O que já está pronto
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {SHIPPED.map((feature) => (
            <li key={feature.title} className="rounded-2xl border border-border bg-layer01 p-4">
              <h3 className="text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="radar">
        <h2 id="radar" className="text-lg font-semibold">
          No radar (ainda não disponível)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estes itens estão fora da V1. Estão listados aqui para deixar claro o que o app{' '}
          <strong>não</strong> faz hoje.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {PLANNED.map((item) => (
            <li key={item} className="flex items-start gap-2 rounded-xl border border-dashed border-border-strong p-3 text-sm text-muted-foreground">
              <span aria-hidden="true">•</span>
              <span>
                {item} <span className="text-xs uppercase tracking-wide text-placeholder">— planejado</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto border-t border-border pt-6 text-xs text-muted-foreground">
        <p>Projeto pessoal de código aberto. Os dados ficam no banco PostgreSQL que você configurar.</p>
      </footer>
    </main>
  );
}
