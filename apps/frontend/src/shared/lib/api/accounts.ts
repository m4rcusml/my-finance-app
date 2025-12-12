import { request } from "./http";

export type Account = {
  id: string;
  userId: string;
  name: string;
  institution: string;
  type: string;
  initialBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountDto = {
  name: string;
  institution: string;
  type: string; // e.g. "CHECKING"
  initialBalance: number;
};

export type UpdateAccountDto = Partial<CreateAccountDto> & {
  isActive?: boolean;
};

export const accountsApi = {
  list() {
    return request<Account[]>("/accounts", { auth: true });
  },

  getById(id: string) {
    return request<Account>(`/accounts/${id}`, { auth: true });
  },

  create(dto: CreateAccountDto) {
    return request<Account>("/accounts", {
      method: "POST",
      auth: true,
      body: dto,
    });
  },

  update(id: string, dto: UpdateAccountDto) {
    return request<Account>(`/accounts/${id}`, {
      method: "PATCH",
      auth: true,
      body: dto,
    });
  },

  remove(id: string) {
    return request<void>(`/accounts/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
