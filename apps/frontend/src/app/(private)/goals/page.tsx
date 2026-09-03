import type { Metadata } from 'next';
import { GoalsClient } from './goals-client';

export const metadata: Metadata = {
  title: 'Metas',
  description: 'Metas financeiras com progresso informado manualmente.',
};

export default function GoalsPage() {
  return <GoalsClient />;
}
