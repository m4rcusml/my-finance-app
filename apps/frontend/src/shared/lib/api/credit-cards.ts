import { request } from './http';

export type CreditCard = {
  id: string;
  userId: string;
  name: string;
  institution: string;
  limitTotal: number;
  usedAmount: number;
  availableAmount: number;
  closingDay?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCreditCardDto = {
  name: string;
  institution: string;
  limitTotal: number;
  closingDay?: number;
};

export type UpdateCreditCardDto = Partial<CreateCreditCardDto> & {
  isActive?: boolean;
};

export const creditCardsApi = {
  list() {
    return request<CreditCard[]>('/credit-cards', { auth: true });
  },

  getById(id: string) {
    return request<CreditCard>(`/credit-cards/${id}`, { auth: true });
  },

  create(dto: CreateCreditCardDto) {
    return request<CreditCard>('/credit-cards', {
      method: 'POST',
      auth: true,
      body: dto,
    });
  },

  update(id: string, dto: UpdateCreditCardDto) {
    return request<CreditCard>(`/credit-cards/${id}`, {
      method: 'PATCH',
      auth: true,
      body: dto,
    });
  },

  remove(id: string) {
    return request<void>(`/credit-cards/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  },
};
