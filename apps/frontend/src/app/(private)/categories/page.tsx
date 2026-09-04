import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Categorias',
  description: 'Organize receitas e despesas sem perder os vínculos do histórico financeiro.',
};

export default function CategoriesPage() {
  redirect('/transactions?view=categories');
}
