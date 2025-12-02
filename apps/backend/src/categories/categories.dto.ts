export class CreateCategoryDto {
  name: string;
  type: 'income' | 'expense' | 'both';
}

export class UpdateCategoryDto {
  name?: string;
  type?: 'income' | 'expense' | 'both';
}
