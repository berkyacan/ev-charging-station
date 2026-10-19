import { env } from '../utils/env';
import { getToken } from '../utils/authToken';

export interface ApiErrorResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export interface ApiRequestOptions
  extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: HeadersInit;
}

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = createHeaders(options.headers, options.body);
  const response = await fetch(buildUrl(path), {
    ...options,
    body: serializeBody(options.body),
    headers,
  });

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiClientError(
      extractErrorMessage(responseBody),
      response.status,
      responseBody,
    );
  }

  return responseBody as T;
}

export const apiClient = {
  request,
  get<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'POST', body });
  },
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'PATCH', body });
  },
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'PUT', body });
  },
  delete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${env.apiBaseUrl}${normalizedPath}`;
}

function createHeaders(existingHeaders?: HeadersInit, body?: unknown): Headers {
  const headers = new Headers(existingHeaders);
  const token = getToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Accept', 'application/json');

  return headers;
}

function serializeBody(body?: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function extractErrorMessage(responseBody: unknown): string {
  if (typeof responseBody === 'string' && responseBody.trim() !== '') {
    return responseBody;
  }

  if (!isApiErrorResponse(responseBody)) {
    return 'API request failed.';
  }

  if (Array.isArray(responseBody.message)) {
    return responseBody.message.join(', ');
  }

  if (typeof responseBody.message === 'string' && responseBody.message.trim() !== '') {
    return responseBody.message;
  }

  if (typeof responseBody.error === 'string' && responseBody.error.trim() !== '') {
    return responseBody.error;
  }

  return 'API request failed.';
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return typeof value === 'object' && value !== null;
}
