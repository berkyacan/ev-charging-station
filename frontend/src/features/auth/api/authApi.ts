import { apiClient } from '../../shared/api';
import type { User } from '../../shared/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', payload);
}

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/register', payload);
}
