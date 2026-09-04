import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Backup',
  description: 'Exporte e restaure uma cópia local dos seus dados financeiros.',
};

export default function BackupPage() {
  redirect('/settings?view=data');
}
