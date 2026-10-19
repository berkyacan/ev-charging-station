import { apiClient } from './apiClient';

export { apiClient, ApiClientError } from './apiClient';

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return apiClient.request<T>(path, init);
}
