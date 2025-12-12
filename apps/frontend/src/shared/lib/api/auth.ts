import { request } from "./http";

export type LoginResponse = {
  access_token: string;
};

export type RegisterResponse = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MeResponse = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const authApi = {
  login(email: string, password: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },

  register(email: string, password: string) {
    return request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },

  me() {
    return request<MeResponse>("/auth/me", {
      method: "GET",
      auth: true,
    });
  },
};
