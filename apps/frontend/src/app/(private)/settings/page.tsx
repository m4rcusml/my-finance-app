import type { Metadata } from 'next';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = {
  title: 'Configurações',
  description: 'Perfil, senha e exclusão da conta.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
