'use client';

import { useState } from 'react';
import { useCategoriesQuery } from '@/features/categories/queries';
import { useDeleteCategoryMutation } from '@/features/categories/mutations';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Category } from '@/shared/lib/api/categories';
import { CreateCategoryModal } from '@/components/specific/modals/create-category-modal';
import { EditCategoryModal } from '@/components/specific/modals/edit-category-modal';

export default function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { data: categories, isLoading } = useCategoriesQuery();

  function getTypeLabel(type: string) {
    switch (type) {
      case 'income':
        return { label: 'Receita', color: 'text-green-500' };
      case 'expense':
        return { label: 'Despesa', color: 'text-red-500' };
      case 'both':
        return { label: 'Ambos', color: 'text-blue-500' };
      default:
        return { label: type, color: 'text-muted-foreground' };
    }
  }

  return (
    <main className="flex-1 flex flex-col space-y-6 h-full p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Categorias</h2>
          <p className="text-muted-foreground">Gerencie suas categorias de receitas e despesas.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsModalOpen(true)}>Nova Categoria</Button>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-layer01 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando categorias...</div>
        ) : categories && categories.length > 0 ? (
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b [&_tr]:border-foreground/10">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nome</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tipo</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {categories.map((category) => {
                  const typeInfo = getTypeLabel(category.type);
                  return (
                    <tr
                      key={category.id}
                      className="border-b border-foreground/5 transition-colors hover:bg-layer02/50"
                    >
                      <td className="p-4 align-middle font-medium text-foreground">{category.name}</td>
                      <td className="p-4 align-middle">
                        <span className={`text-sm font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td className="p-4 align-middle text-right">
                        <div className="flex justify-end gap-2">
                          <Button tone="layer01" size="small" onClick={() => setEditingCategory(category)}>
                            <Icon name="Pencil1Outlined" className="h-4 w-4" />
                          </Button>
                          <DeleteCategoryButton category={category} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="p-3 bg-layer02 rounded-full mb-3">
              <Icon name="SlidersHorizontalSquare2Outlined" className="h-6 w-6" />
            </div>
            <p>Nenhuma categoria encontrada.</p>
          </div>
        )}
      </div>

      <CreateCategoryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <EditCategoryModal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        category={editingCategory}
      />
    </main>
  );
}

function DeleteCategoryButton({ category }: { category: Category }) {
  const mutation = useDeleteCategoryMutation(category.id);

  function handleDelete() {
    if (window.confirm(`Tem certeza que deseja excluir a categoria "${category.name}"?`)) {
      mutation.mutate();
    }
  }

  return (
    <Button tone="layer01" size="small" onClick={handleDelete}>
      <Icon name="Trash3Outlined" className="h-4 w-4" />
    </Button>
  );
}
