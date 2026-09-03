import type { Metadata } from 'next';
import { CategoriesClient } from './categories-client';

export const metadata: Metadata = {
  title: 'Categorias',
  description: 'Organize receitas e despesas sem perder os vínculos do histórico financeiro.',
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}
