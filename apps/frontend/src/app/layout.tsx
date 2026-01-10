import type { Metadata } from 'next';
import { Urbanist } from 'next/font/google';
import Providers from './providers';
import '@/shared/styles/globals.css';

const urbanist = Urbanist({
  variable: '--font-urbanist',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'My Finance App',
  description: 'Made by MarcusML',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="br">
      <body className={`${urbanist.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
