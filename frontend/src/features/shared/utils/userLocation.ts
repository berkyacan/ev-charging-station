export type UserLocationSource = 'browser' | 'fallback';

export interface UserLocation {
  accuracyMeters?: number;
  capturedAt: string;
  label?: string;
  latitude: number;
  longitude: number;
  source?: UserLocationSource;
}

const USER_LOCATION_STORAGE_KEY = 'chargenet.user-location';
const FALLBACK_LOCATION_LABEL = 'Izmir / Alsancak';
const FALLBACK_LOCATION_COORDINATES = {
  latitude: 38.4324,
  longitude: 27.1467,
};

export function readStoredUserLocation(): UserLocation | null {
  if (!hasWindow()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(USER_LOCATION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<UserLocation>;

    if (
      typeof parsedValue.latitude !== 'number' ||
      typeof parsedValue.longitude !== 'number' ||
      typeof parsedValue.capturedAt !== 'string'
    ) {
      return null;
    }

    return {
      accuracyMeters:
        typeof parsedValue.accuracyMeters === 'number'
          ? parsedValue.accuracyMeters
          : undefined,
      capturedAt: parsedValue.capturedAt,
      label:
        typeof parsedValue.label === 'string' ? parsedValue.label : undefined,
      latitude: parsedValue.latitude,
      longitude: parsedValue.longitude,
      source:
        parsedValue.source === 'browser' || parsedValue.source === 'fallback'
          ? parsedValue.source
          : undefined,
    };
  } catch {
    return null;
  }
}

export function storeUserLocation(location: UserLocation): void {
  if (!hasWindow()) {
    return;
  }

  window.sessionStorage.setItem(
    USER_LOCATION_STORAGE_KEY,
    JSON.stringify(location),
  );
}

export function requestCurrentUserLocation(): Promise<UserLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(
      new Error('This browser does not support location services.'),
    );
  }

  return new Promise<UserLocation>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
          label: 'Current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: 'browser',
        });
      },
      (error) => {
        reject(new Error(resolveGeolocationError(error)));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 120000,
        timeout: 10000,
      },
    );
  });
}

export function createFallbackUserLocation(): UserLocation {
  return {
    capturedAt: new Date().toISOString(),
    label: FALLBACK_LOCATION_LABEL,
    latitude: FALLBACK_LOCATION_COORDINATES.latitude,
    longitude: FALLBACK_LOCATION_COORDINATES.longitude,
    source: 'fallback',
  };
}

export function getUserLocationDisplayLabel(
  location: UserLocation | null | undefined,
): string {
  if (!location) {
    return 'Awaiting current location';
  }

  if (location.source === 'fallback') {
    return `Mevcut konum · ${location.label ?? FALLBACK_LOCATION_LABEL}`;
  }

  return location.label ?? 'Current location';
}

export function isFallbackUserLocation(
  location: UserLocation | null | undefined,
): boolean {
  return location?.source === 'fallback';
}

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function resolveGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Enable browser location for route distances.';
    case error.POSITION_UNAVAILABLE:
      return 'Location information is currently unavailable. Check device location services.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'Location information is currently unavailable.';
  }
}
