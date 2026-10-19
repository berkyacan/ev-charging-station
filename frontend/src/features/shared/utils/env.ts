const defaultApiBaseUrl = 'http://localhost:3000/api';

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl,
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
} as const;
