const GOOGLE_MAPS_SCRIPT_ID = 'astera-google-maps-script';
const GOOGLE_MAPS_CALLBACK_NAME = '__asteraInitGoogleMaps';

export interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

export interface GoogleMarkerIcon {
  fillColor?: string;
  fillOpacity?: number;
  path?: number | string;
  scale?: number;
  strokeColor?: string;
  strokeWeight?: number;
}

export interface GoogleMapOptions {
  backgroundColor?: string;
  center: GoogleLatLngLiteral;
  clickableIcons?: boolean;
  disableDefaultUI?: boolean;
  fullscreenControl?: boolean;
  gestureHandling?: string;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  zoom?: number;
  zoomControl?: boolean;
}

export interface GoogleMap {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  panTo: (position: GoogleLatLngLiteral) => void;
  setCenter: (position: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
}

export interface GoogleMarker {
  addListener: (eventName: string, handler: () => void) => void;
  setMap: (map: GoogleMap | null) => void;
}

export interface GooglePolyline {
  setMap: (map: GoogleMap | null) => void;
}

export interface GoogleInfoWindow {
  close: () => void;
  open: (options: { anchor?: GoogleMarker; map?: GoogleMap }) => void;
  setContent: (content: string) => void;
}

export interface GoogleLatLngBounds {
  extend: (location: GoogleLatLngLiteral) => void;
}

export interface GoogleRouteLocalizedValues {
  distance?: string;
  duration?: string;
  staticDuration?: string;
}

export interface GoogleRouteResult {
  createPolylines: () => GooglePolyline[];
  distanceMeters?: number;
  durationMillis?: number;
  localizedValues?: GoogleRouteLocalizedValues;
  path?: GoogleLatLngLiteral[];
}

export interface GoogleRouteMatrixItem {
  condition?: string;
  distanceMeters?: number;
  durationMillis?: number;
}

export interface GoogleRouteMatrixRow {
  items: GoogleRouteMatrixItem[];
}

export interface GoogleRouteMatrixResponse {
  rows: GoogleRouteMatrixRow[];
}

export interface GoogleRoutesLibrary {
  Route: {
    computeRoutes: (request: {
      destination: GoogleLatLngLiteral | string;
      fields: string[];
      language?: string;
      origin: GoogleLatLngLiteral | string;
      routingPreference?: string;
      travelMode?: string;
      units?: number | string;
    }) => Promise<{ routes?: GoogleRouteResult[] }>;
  };
  RouteMatrix: {
    computeRouteMatrix: (request: {
      destinations: Array<GoogleLatLngLiteral | string>;
      fields: string[];
      origins: Array<GoogleLatLngLiteral | string>;
      travelMode?: string;
      units?: number | string;
    }) => Promise<{ matrix: GoogleRouteMatrixResponse }>;
  };
}

export interface GoogleMapsApi {
  InfoWindow: new () => GoogleInfoWindow;
  LatLngBounds: new () => GoogleLatLngBounds;
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMap;
  Marker: new (options: {
    icon?: GoogleMarkerIcon;
    map: GoogleMap;
    position: GoogleLatLngLiteral;
    title?: string;
    zIndex?: number;
    }) => GoogleMarker;
  SymbolPath: {
    CIRCLE: number;
  };
  UnitSystem: {
    IMPERIAL: number | string;
    METRIC: number | string;
  };
  importLibrary: (libraryName: string) => Promise<unknown>;
}

declare global {
  interface Window {
    __asteraInitGoogleMaps?: () => void;
    google?: {
      maps?: GoogleMapsApi;
    };
  }
}

let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

export function loadGoogleMapsApi(apiKey: string): Promise<GoogleMapsApi> {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);

    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&loading=async&v=weekly&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;

    window[GOOGLE_MAPS_CALLBACK_NAME] = () => {
      cleanup();

      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }

      googleMapsPromise = null;
      reject(new Error('Google Maps loaded without a maps namespace.'));
    };

    script.onerror = () => {
      cleanup();
      googleMapsPromise = null;
      reject(new Error('Unable to load the Google Maps JavaScript API.'));
    };

    document.head.appendChild(script);

    function cleanup(): void {
      delete window[GOOGLE_MAPS_CALLBACK_NAME];
      script.onerror = null;
    }
  });

  return googleMapsPromise;
}

export async function loadGoogleRoutesLibrary(apiKey: string): Promise<{
  mapsApi: GoogleMapsApi;
  routesLibrary: GoogleRoutesLibrary;
}> {
  const mapsApi = await loadGoogleMapsApi(apiKey);
  const routesLibrary = (await mapsApi.importLibrary(
    'routes',
  )) as GoogleRoutesLibrary;

  return {
    mapsApi,
    routesLibrary,
  };
}
