import type { Metadata } from 'next';
import { ImportsClient } from './imports-client';

export const metadata: Metadata = {
  title: 'Importações',
  description: 'Importe extratos em CSV, OFX ou XLSX com pré-visualização antes de gravar.',
};

export default function ImportsPage() {
  return <ImportsClient />;
}
