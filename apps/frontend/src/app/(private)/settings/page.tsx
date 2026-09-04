import type { Metadata } from 'next';
import { SettingsClient, type SettingsView } from './settings-client';

export const metadata: Metadata = {
  title: 'Configurações',
  description: 'Perfil, segurança, tutorial e backup local dos seus dados.',
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requested = (await searchParams).view;
  const view: SettingsView =
    requested === 'security' || requested === 'data' || requested === 'profile' ? requested : 'overview';
  return <SettingsClient view={view} />;
}
