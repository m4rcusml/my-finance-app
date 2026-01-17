import { request } from "./http";

export type Category = {
  id: string;
  userId: string;
  name: string;
  type: string; // 'INCOME' | 'EXPENSE'
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryDto = {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon?: string;
  color?: string;
};

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export const categoriesApi = {
  list() {
    return request<Category[]>("/categories", { auth: true });
  },

  getById(id: string) {
    return request<Category>(`/categories/${id}`, { auth: true });
  },

  create(dto: CreateCategoryDto) {
    return request<Category>("/categories", {
      method: "POST",
      auth: true,
      body: dto,
    });
  },

  update(id: string, dto: UpdateCategoryDto) {
    return request<Category>(`/categories/${id}`, {
      method: "PATCH",
      auth: true,
      body: dto,
    });
  },

  remove(id: string) {
    return request<void>(`/categories/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
