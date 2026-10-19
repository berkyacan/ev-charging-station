import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import type { Station } from '../../shared/types';
import { clearToken } from '../../shared/utils/authToken';
import { env } from '../../shared/utils/env';
import { translateUiMessage } from '../../shared/utils/messages';
import {
  loadGoogleRoutesLibrary,
  type GoogleMap,
  type GoogleMarker,
  type GoogleMapsApi,
  type GooglePolyline,
} from '../../shared/utils/googleMaps';
import {
  createFallbackUserLocation,
  getUserLocationDisplayLabel,
  isFallbackUserLocation,
  readStoredUserLocation,
  requestCurrentUserLocation,
  storeUserLocation,
  type UserLocation,
} from '../../shared/utils/userLocation';
import { getStationById } from '../api/stationsApi';
import {
  calculateHaversineDistanceMeters,
  formatDistanceMeters,
  formatDurationMillis,
} from '../utils/routing';

interface RouteSnapshot {
  distanceMeters?: number;
  distanceText: string;
  durationMillis?: number;
  durationText: string;
}

export function RoutePage(): JSX.Element {
  const navigate = useNavigate();
  const { stationId } = useParams<{ stationId: string }>();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const routeMarkersRef = useRef<GoogleMarker[]>([]);
  const routePolylinesRef = useRef<GooglePolyline[]>([]);
  const [station, setStation] = useState<Station | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasAttemptedLocation, setHasAttemptedLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSnapshot, setRouteSnapshot] = useState<RouteSnapshot | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(() =>
    readStoredUserLocation(),
  );

  useEffect(() => {
    if (!stationId) {
      setErrorMessage('Station information is missing in the route request.');
      setIsLoading(false);
      return;
    }

    void loadStation(stationId);
  }, [stationId]);

  useEffect(() => {
    let isActive = true;

    if (userLocation?.source === 'browser') {
      setIsLocating(false);
      return;
    }

    if (hasAttemptedLocation && isFallbackUserLocation(userLocation)) {
      setIsLocating(false);
      return;
    }

    setIsLocating(true);
    if (!isFallbackUserLocation(userLocation)) {
      setLocationError(null);
    }

    void requestCurrentUserLocation()
      .then((nextLocation) => {
        if (!isActive) {
          return;
        }

        storeUserLocation(nextLocation);
        setUserLocation(nextLocation);
        setLocationError(null);
        setHasAttemptedLocation(true);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const fallbackLocation = createFallbackUserLocation();
        storeUserLocation(fallbackLocation);
        setUserLocation(fallbackLocation);
        setLocationError(
          `${resolveLocationError(error)} Current location set to Izmir / Alsancak.`,
        );
        setHasAttemptedLocation(true);
      })
      .finally(() => {
        if (isActive) {
          setIsLocating(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasAttemptedLocation, userLocation?.source]);

  const googleMapsEmbedUrl = useMemo(() => {
    if (!station || !env.googleMapsApiKey) {
      return null;
    }

    return `https://www.google.com/maps/embed/v1/place?key=${env.googleMapsApiKey}&q=${station.latitude},${station.longitude}&zoom=13`;
  }, [station]);
  const fallbackDistanceText = useMemo(() => {
    if (!station || !userLocation) {
      return 'Awaiting distance';
    }

    return formatDistanceMeters(
      calculateHaversineDistanceMeters(
        {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        },
        {
          lat: station.latitude,
          lng: station.longitude,
        },
      ),
    );
  }, [station, userLocation]);
  const routeDistanceText = routeSnapshot?.distanceText ?? fallbackDistanceText;
  const routeDurationText = routeSnapshot?.durationText ?? 'Awaiting duration';
  const showLiveRouteMap =
    Boolean(env.googleMapsApiKey) && Boolean(userLocation) && !routeError;
  const locationStatusLabel = userLocation
    ? isFallbackUserLocation(userLocation)
      ? 'Current Location'
      : 'Live Location'
    : isLocating
      ? 'Getting Location'
      : 'Location Required';

  useEffect(() => {
    let isActive = true;

    if (!station || !userLocation || !env.googleMapsApiKey || !mapElementRef.current) {
      setIsLoadingRoute(false);
      setRouteSnapshot(null);
      clearMapElements(routeMarkersRef.current, routePolylinesRef.current);
      routeMarkersRef.current = [];
      routePolylinesRef.current = [];
      return;
    }

    const origin = {
      lat: userLocation.latitude,
      lng: userLocation.longitude,
    };
    const destination = {
      lat: station.latitude,
      lng: station.longitude,
    };

    setIsLoadingRoute(true);
    setRouteError(null);

    void loadGoogleRoutesLibrary(env.googleMapsApiKey)
      .then(async ({ mapsApi, routesLibrary }) => {
        if (!isActive || !mapElementRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new mapsApi.Map(mapElementRef.current, {
            backgroundColor: '#dfe8f7',
            center: destination,
            clickableIcons: false,
            disableDefaultUI: true,
            fullscreenControl: false,
            gestureHandling: 'cooperative',
            mapTypeControl: false,
            streetViewControl: false,
            zoom: 12,
            zoomControl: true,
          });
        }

        clearMapElements(routeMarkersRef.current, routePolylinesRef.current);
        routeMarkersRef.current = [];
        routePolylinesRef.current = [];

        const response = await routesLibrary.Route.computeRoutes({
          destination,
          fields: ['path', 'distanceMeters', 'durationMillis', 'localizedValues'],
          language: 'tr',
          origin,
          routingPreference: 'TRAFFIC_AWARE',
          travelMode: 'DRIVING',
          units: mapsApi.UnitSystem.METRIC,
        });
        const activeRoute = response.routes?.[0];

        if (!activeRoute) {
          throw new Error('Recalculating route data for selected station.');
        }

        const map = mapRef.current;

        if (!map) {
          throw new Error('Map service currently unavailable.');
        }

        routePolylinesRef.current = activeRoute.createPolylines();
        routePolylinesRef.current.forEach((polyline) => {
          polyline.setMap(map);
        });
        routeMarkersRef.current = [
          new mapsApi.Marker({
            icon: buildRouteMarkerIcon(mapsApi, '#1d4ed8'),
            map,
            position: origin,
            title: 'Mevcut konum',
            zIndex: 3,
          }),
          new mapsApi.Marker({
            icon: buildRouteMarkerIcon(mapsApi, '#059669'),
            map,
            position: destination,
            title: station.name,
            zIndex: 2,
          }),
        ];

        const bounds = new mapsApi.LatLngBounds();

        if (activeRoute.path && activeRoute.path.length > 0) {
          activeRoute.path.forEach((point) => {
            bounds.extend({
              lat: point.lat,
              lng: point.lng,
            });
          });
        } else {
          bounds.extend(origin);
          bounds.extend(destination);
        }

        map.fitBounds(bounds);

        if (!isActive) {
          return;
        }

        setRouteSnapshot({
          distanceMeters: activeRoute.distanceMeters,
          distanceText:
            activeRoute.localizedValues?.distance ??
            formatDistanceMeters(activeRoute.distanceMeters),
          durationMillis: activeRoute.durationMillis,
          durationText:
            activeRoute.localizedValues?.duration ??
            formatDurationMillis(activeRoute.durationMillis),
        });
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        clearMapElements(routeMarkersRef.current, routePolylinesRef.current);
        routeMarkersRef.current = [];
        routePolylinesRef.current = [];
        setRouteSnapshot(null);
        setRouteError(resolveRouteMapError(error));
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingRoute(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [station, userLocation]);

  async function loadStation(targetStationId: string): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const stationResponse = await getStationById(targetStationId);
      setStation(stationResponse);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }

      setErrorMessage(resolveRouteError(error));
      setStation(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="page-shell">
      <PageHero
        actions={
          <>
            <Link className="primary-button primary-button--auto" to="/charging-sessions">
              Next: Charging Sessions
            </Link>
            <Link className="secondary-button secondary-button--link" to="/reservations">
              Back to Reservations
            </Link>
          </>
        }
        badge={env.googleMapsApiKey ? 'Route guidance enabled' : 'Route guidance'}
        description="Open route guidance for the selected station after reservation confirmation, then proceed to charging session."
        eyebrow="Route Guidance"
        metrics={[
          {
            label: 'Station',
            value: station?.name ?? 'Loading',
            hint: 'Current destination',
          },
          {
            label: 'Mesafe',
            value: station ? routeDistanceText : 'Bekleniyor',
            hint: routeSnapshot ? 'Live route calculation' : 'Location-based estimate',
          },
          {
            label: 'Current Location',
            value: locationStatusLabel,
            hint:
              locationError ??
              (userLocation
                ? isFallbackUserLocation(userLocation)
                  ? `${getUserLocationDisplayLabel(userLocation)} rota yönlendirmesi için kullanılıyor.`
                  : `${getUserLocationDisplayLabel(userLocation)} rota yönlendirmesine bağlı.`
                : 'Waiting for location access'),
          },
        ]}
        title="Route Guidance"
      />

      <div className="card">
        <div className="helper-card">
          <div>
            <h2>Route Guidance</h2>
            <p>
              {env.googleMapsApiKey
                ? userLocation
                  ? 'In-app route is displayed with live guidance data.'
                  : 'Route data is being calculated.'
                : 'Map service currently unavailable. Route guidance available.'}
            </p>
          </div>
          <div className="reservation-actions">
            <Link className="primary-button primary-button--auto" to="/charging-sessions">
              Şarja Devam Et
            </Link>
            <Link className="secondary-button secondary-button--link" to="/reservations">
              Back to Reservations
            </Link>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="message-banner message-banner--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {locationError ? (
        <div className="message-banner" role="status">
          <span className="message-banner__title">Current Location</span>
          <span>{locationError}</span>
        </div>
      ) : null}

      {routeError ? (
        <div className="message-banner" role="status">
          <span className="message-banner__title">Route Guidance</span>
          <span>{routeError}</span>
        </div>
      ) : null}

      {isLoading ? (
        <section className="card">
          <p aria-live="polite" className="empty-state" role="status">
            Loading route details...
          </p>
        </section>
      ) : station ? (
        <div className="page-grid page-grid--route">
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Route Guidance</h2>
                <p>
                  {showLiveRouteMap
                    ? 'Driving route from your current location to the station calculated within the app.'
                    : env.googleMapsApiKey
                      ? 'Route data is being calculated.'
                      : 'Map service currently unavailable. Route guidance available.'}
                </p>
              </div>
              <span className="status-pill status-pill--confirmed">Aktif</span>
            </div>

            {showLiveRouteMap ? (
              <div className="route-map-shell route-map-shell--live">
                <div className="map-live-shell">
                  <div className="map-live-canvas route-map-live-canvas" ref={mapElementRef} />
                  {isLoadingRoute ? (
                    <div className="map-overlay" role="status">
                      Calculating route...
                    </div>
                  ) : null}
                </div>
                <p className="inline-note">
                  Route guidance mevcut konuma göre hesaplanır ve çalışma alanı akışı içinde tutulur.
                </p>
              </div>
            ) : googleMapsEmbedUrl ? (
              <div className="route-map-shell">
                <iframe
                  className="route-map-frame"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={googleMapsEmbedUrl}
                  title={`${station.name} için rota yönlendirmesi`}
                />
                <p className="inline-note">
                  Target guidance available even if current location cannot be obtained.
                </p>
              </div>
            ) : (
              <div className="route-fallback-panel">
                <div className="route-fallback-panel__visual">
                  <span className="route-fallback-panel__badge">
                    Map Service
                  </span>
                  <h3>{station.name}</h3>
                  <p>{station.address}</p>
                </div>

                <p className="inline-note">
                  Map service currently unavailable. Route guidance kullanılabilir.
                </p>
              </div>
            )}
          </section>

          <section className="card route-info-panel">
            <div className="section-heading">
              <div>
                <h2>Destination Details</h2>
                <p>Station information retrieved from the network service.</p>
              </div>
            </div>

            <dl className="detail-grid">
              <div>
                <dt>Selected Station</dt>
                <dd>{station.name}</dd>
              </div>
              <div>
                <dt>Route Distance</dt>
                <dd>{routeDistanceText}</dd>
              </div>
              <div>
                <dt>Estimated Duration</dt>
                <dd>{routeDurationText}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{station.address}</dd>
              </div>
              <div>
                <dt>Operating Hours</dt>
                <dd>{station.operatingHours}</dd>
              </div>
              <div>
                <dt>Location Status</dt>
                <dd>{locationStatusLabel}</dd>
              </div>
              <div>
                <dt>Route Source</dt>
                <dd>{routeSnapshot ? 'Google Routes' : 'External route guidance'}</dd>
              </div>
              <div>
                <dt>Coordinates</dt>
                <dd>
                  {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                </dd>
              </div>
            </dl>

            {env.googleMapsApiKey && userLocation ? (
              <p className="inline-note">Google Maps support · ©2026 Google</p>
            ) : null}

            <div className="route-panel__actions">
              <Link className="primary-button primary-button--auto" to="/charging-sessions">
                Continue to Charging Sessions
              </Link>
              <a
                className="secondary-button secondary-button--link"
                href={buildDirectionsHref(station.latitude, station.longitude, userLocation)}
                rel="noreferrer"
                target="_blank"
              >
                Open External Route
              </a>
              <Link className="secondary-button secondary-button--link" to="/stations">
                Back to Station Finder
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function buildDirectionsHref(
  latitude: number,
  longitude: number,
  userLocation: UserLocation | null,
): string {
  const searchParams = new URLSearchParams({
    api: '1',
    destination: `${latitude},${longitude}`,
  });

  if (userLocation) {
    searchParams.set('origin', `${userLocation.latitude},${userLocation.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${searchParams.toString()}`;
}

function clearMapElements(
  markers: GoogleMarker[],
  polylines: GooglePolyline[],
): void {
  markers.forEach((marker) => {
    marker.setMap(null);
  });
  polylines.forEach((polyline) => {
    polyline.setMap(null);
  });
}

function buildRouteMarkerIcon(mapsApi: GoogleMapsApi, fillColor: string) {
  return {
    fillColor,
    fillOpacity: 1,
    path: mapsApi.SymbolPath.CIRCLE,
    scale: 8,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  };
}

function resolveLocationError(error: unknown): string {
  if (error instanceof Error) {
    return translateUiMessage(error.message);
  }

  return 'Current location information currently unavailable.';
}

function resolveRouteError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Route details currently unavailable.';
}

function resolveRouteMapError(error: unknown): string {
  if (error instanceof Error) {
    return `${translateUiMessage(error.message)} External route guidance kullanılabilir.`;
  }

  return 'Route guidance is currently unavailable. External route guidance available.';
}
