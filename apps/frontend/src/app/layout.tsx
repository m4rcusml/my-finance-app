import type { Metadata, Viewport } from 'next';
import { Urbanist } from 'next/font/google';
import Providers from './providers';
import '@/shared/styles/globals.css';

const urbanist = Urbanist({
  variable: '--font-urbanist',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'My Finance App',
    template: '%s · My Finance App',
  },
  description: 'Gerenciador financeiro pessoal: contas, cartões, transações, recorrências, metas e importação de extratos.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deliberately NOT locked: pinch-zoom must stay available (WCAG 1.4.4).
  maximumScale: 5,
  themeColor: '#05051E',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // pt-BR, not "br" (which is Breton) — screen readers pick the voice from this.
    <html lang="pt-BR">
      <body className={`${urbanist.variable} font-sans`} suppressHydrationWarning>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
