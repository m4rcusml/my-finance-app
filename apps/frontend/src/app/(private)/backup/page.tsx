import type { Metadata } from 'next';
import { BackupClient } from './backup-client';

export const metadata: Metadata = {
  title: 'Backup',
  description: 'Exporte e restaure uma cópia local dos seus dados financeiros.',
};

export default function BackupPage() {
  return <BackupClient />;
}
