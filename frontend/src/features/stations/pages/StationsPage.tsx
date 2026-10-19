import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import type { Station } from '../../shared/types';
import { env } from '../../shared/utils/env';
import { translateUiMessage } from '../../shared/utils/messages';
import {
  createFallbackUserLocation,
  getUserLocationDisplayLabel,
  isFallbackUserLocation,
  readStoredUserLocation,
  requestCurrentUserLocation,
  storeUserLocation,
  type UserLocation,
} from '../../shared/utils/userLocation';
import {
  getStationChargers,
  getStations,
  type StationChargersResponse,
  type StationFilters,
} from '../api/stationsApi';
import { StationDetailPanel } from '../components/StationDetailPanel';
import {
  StationFiltersForm,
  toStationFilters,
  type StationFilterValues,
} from '../components/StationFiltersForm';
import {
  StationMapPanel,
  type StationAvailability,
  type StationListItem,
} from '../components/StationMapPanel';
import {
  calculateHaversineDistanceMeters,
  computeStationRouteMetrics,
  formatDistanceMeters,
  formatDurationMillis,
  type StationRouteMetric,
} from '../utils/routing';

const initialFilterValues: StationFilterValues = {
  connectorType: '',
  minPowerKW: '',
  maxPricePerKWh: '',
  startTime: '',
  endTime: '',
};

export function StationsPage(): JSX.Element {
  const [filterValues, setFilterValues] =
    useState<StationFilterValues>(initialFilterValues);
  const [appliedFilters, setAppliedFilters] =
    useState<StationFilters>(toStationFilters(initialFilterValues));
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedStationChargers, setSelectedStationChargers] = useState<
    StationChargersResponse | null
  >(null);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [isLoadingChargers, setIsLoadingChargers] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasAttemptedLocation, setHasAttemptedLocation] = useState(false);
  const [isComputingDistances, setIsComputingDistances] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [routeMetricsByStationId, setRouteMetricsByStationId] = useState<
    Record<string, StationRouteMetric>
  >({});
  const [userLocation, setUserLocation] = useState<UserLocation | null>(() =>
    readStoredUserLocation(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadStations(appliedFilters);
  }, [appliedFilters]);

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
          `${resolveLocationError(error)} Mevcut konum İzmir / Alsancak olarak ayarlandı.`,
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

  useEffect(() => {
    if (!selectedStationId) {
      setSelectedStationChargers(null);
      return;
    }

    void loadStationChargers(selectedStationId, appliedFilters);
  }, [selectedStationId, appliedFilters]);

  useEffect(() => {
    let isActive = true;

    if (!userLocation || stations.length === 0) {
      setRouteMetricsByStationId({});
      setIsComputingDistances(false);
      return;
    }

    const origin = {
      lat: userLocation.latitude,
      lng: userLocation.longitude,
    };
    const fallbackMetrics = buildFallbackRouteMetrics(stations, origin);

    if (!env.googleMapsApiKey) {
      setRouteMetricsByStationId(fallbackMetrics);
      setIsComputingDistances(false);
      return;
    }

    setIsComputingDistances(true);

    void computeStationRouteMetrics(env.googleMapsApiKey, origin, stations)
      .then((nextMetrics) => {
        if (!isActive) {
          return;
        }

        setRouteMetricsByStationId({
          ...fallbackMetrics,
          ...nextMetrics,
        });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setRouteMetricsByStationId(fallbackMetrics);
      })
      .finally(() => {
        if (isActive) {
          setIsComputingDistances(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [stations, userLocation]);

  const stationItems = useMemo<StationListItem[]>(() => {
    return stations.map((station) => ({
      ...station,
      availability: getStationAvailability(station),
      ...buildRoutePresentation(
        routeMetricsByStationId[station.id],
        Boolean(userLocation),
        isComputingDistances,
        Boolean(locationError),
      ),
    }));
  }, [isComputingDistances, locationError, routeMetricsByStationId, stations, userLocation]);

  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? null;
  const selectedStationItem =
    stationItems.find((station) => station.id === selectedStationId) ?? null;
  const availableStationCount = stationItems.filter(
    (station) => station.availability === 'AVAILABLE',
  ).length;
  const activeFilterCount = [
    appliedFilters.connectorType,
    appliedFilters.minPowerKW,
    appliedFilters.maxPricePerKWh,
    appliedFilters.startTime && appliedFilters.endTime ? 'slot' : undefined,
  ].filter((value) => value !== undefined && value !== '').length;
  const chargerCount = stationItems.reduce(
    (total, station) =>
      total + (station.chargerAvailabilitySummary?.totalChargers ?? 0),
    0,
  );
  const locationStatusLabel = userLocation
    ? isFallbackUserLocation(userLocation)
      ? 'Current Location'
      : 'Live Location'
    : isLocating
      ? 'Locating'
      : 'Bekliyor';
  const locationStatusHint = userLocation
    ? isFallbackUserLocation(userLocation)
      ? `${getUserLocationDisplayLabel(userLocation)} rota mesafesi hesaplamalarında kullanılıyor.`
      : userLocation.accuracyMeters
        ? `${getUserLocationDisplayLabel(userLocation)} · Doğruluk ±${Math.round(userLocation.accuracyMeters)} m`
        : `${getUserLocationDisplayLabel(userLocation)} bağlı`
    : locationError ?? 'Browser location is used for route distances.';
  const selectedRouteHeadline = selectedStationItem
    ? `${selectedStationItem.distanceText} · ${selectedStationItem.travelTimeText}`
    : userLocation
      ? 'Select a station'
      : 'Location required';
  const selectedRouteCopy = selectedStationItem
    ? buildSelectionCopy(selectedStationItem)
    : 'Select a station to examine chargers and proceed to reservation.';
  const selectedSlot = appliedFilters.startTime && appliedFilters.endTime
    ? {
        startTime: appliedFilters.startTime,
        endTime: appliedFilters.endTime,
      }
    : null;

  async function loadStations(filters: StationFilters): Promise<void> {
    setIsLoadingStations(true);
    setErrorMessage(null);

    try {
      const stationList = await getStations(filters);
      setStations(stationList);
      setSelectedStationId((currentId) => {
        if (stationList.length === 0) {
          return null;
        }

        const hasCurrentStation = stationList.some(
          (station) => station.id === currentId,
        );

        return hasCurrentStation ? currentId : null;
      });
    } catch (error) {
      setErrorMessage(resolveStationError(error));
      setStations([]);
      setSelectedStationId(null);
    } finally {
      setIsLoadingStations(false);
    }
  }

  async function loadStationChargers(
    stationId: string,
    filters: StationFilters,
  ): Promise<void> {
    setIsLoadingChargers(true);

    try {
      const stationChargerResponse = await getStationChargers(stationId, filters);
      setErrorMessage(null);
      setSelectedStationChargers(stationChargerResponse);
    } catch (error) {
      setSelectedStationChargers(null);
      setErrorMessage(resolveStationError(error));
    } finally {
      setIsLoadingChargers(false);
    }
  }

  function handleFilterChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void {
    const { name, value } = event.target;

    setFilterValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setAppliedFilters(toStationFilters(filterValues));
  }

  function handleFilterReset(): void {
    setFilterValues(initialFilterValues);
    setAppliedFilters(toStationFilters(initialFilterValues));
  }

  return (
    <section className="page-shell">
      <PageHero
        badge={env.googleMapsApiKey ? 'Live map enabled' : 'Map service'}
        description="Find the nearest available charger, compare route distance, and proceed to reservation setup."
        eyebrow="Station Network"
        metrics={[
          {
            label: 'Stations',
            value: isLoadingStations ? 'Loading' : String(stationItems.length),
            hint: 'Results matching active filters',
          },
          {
            label: 'Available',
            value: String(availableStationCount),
            hint: 'Ready for reservation',
          },
          {
            label: 'Current Location',
            value: locationStatusLabel,
            hint: locationStatusHint,
          },
          {
            label: 'Reservation Interval',
            value: selectedSlot ? 'Applied' : 'Current status',
            hint: selectedSlot
              ? 'Availability shown based on selected reservation interval.'
              : 'Availability reflects current charger status.',
          },
        ]}
        title="Station Finder"
      />

      <div className="insight-grid">
        <article className="insight-card">
          <span className="insight-card__label">Filters</span>
          <strong>{activeFilterCount} etkin</strong>
          <p>Connector, power, and price filters narrow the map and station list.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Network Coverage</span>
          <strong>{chargerCount} şarj cihazı</strong>
          <p>Chargers in the filtered network are displayed here.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Map Service</span>
          <strong>{env.googleMapsApiKey ? 'Google Maps and Routes' : 'Station Map'}</strong>
          <p>
            {env.googleMapsApiKey
              ? userLocation
                ? 'Live markers and route distances calculated with Google Maps services.'
                : 'Live map ready. Route data awaiting current location.'
              : 'Map service currently unavailable. Station list available.'}
          </p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Route Navigation</span>
          <strong>{selectedRouteHeadline}</strong>
          <p>{selectedRouteCopy}</p>
        </article>
      </div>

      {locationError ? (
        <div className="message-banner" role="status">
          <span className="message-banner__title">Current Location</span>
          <span>{locationError}</span>
        </div>
      ) : null}

      <div className="page-grid page-grid--finder">
        <div className="page-stack">
          <section className="card accent-card">
            <div className="section-heading">
              <div>
                <h2>Filter Bar</h2>
                <p>Adjust connector, power, price, and reservation time to narrow the station network.</p>
              </div>
            </div>

            <StationFiltersForm
              onChange={handleFilterChange}
              onReset={handleFilterReset}
              onSubmit={handleFilterSubmit}
              values={filterValues}
            />
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Find an available charger</h2>
                <p>Select a station from the map or synchronized results list, then proceed from the charger panel.</p>
              </div>
            </div>

            {errorMessage ? (
              <div className="message-banner message-banner--error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            {isLoadingStations ? (
              <p aria-live="polite" className="empty-state" role="status">
                Loading stations...
              </p>
            ) : stationItems.length === 0 ? (
              <p className="empty-state">
                No stations match the current search criteria.
              </p>
            ) : (
              <StationMapPanel
                googleMapsApiKey={env.googleMapsApiKey}
                isComputingDistances={isComputingDistances}
                isLocating={isLocating}
                locationError={locationError}
                onSelectStation={setSelectedStationId}
                selectedStationId={selectedStationId}
                stations={stationItems}
                userLocation={userLocation}
              />
            )}
          </section>

          {env.googleMapsApiKey && userLocation ? (
            <p className="inline-note">
              Google Maps support · ©2026 Google
            </p>
          ) : null}
        </div>

        <StationDetailPanel
          availability={selectedStation ? getStationAvailability(selectedStation) : null}
          chargers={selectedStationChargers?.chargers ?? []}
          hasStations={stationItems.length > 0}
          isLoading={isLoadingChargers}
          selectedSlot={selectedSlot}
          station={selectedStation}
        />
      </div>
    </section>
  );
}

function getStationAvailability(station: Station): StationAvailability {
  const summary = station.chargerAvailabilitySummary;

  if (!summary) {
    return 'OFFLINE';
  }

  if (summary.availableChargers > 0) {
    return 'AVAILABLE';
  }

  if (summary.occupiedChargers > 0) {
    return 'OCCUPIED';
  }

  return 'OFFLINE';
}

function resolveStationError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Station data cannot be retrieved at this time.';
}

function buildFallbackRouteMetrics(
  stations: Pick<Station, 'id' | 'latitude' | 'longitude'>[],
  origin: { lat: number; lng: number },
): Record<string, StationRouteMetric> {
  return stations.reduce<Record<string, StationRouteMetric>>((metrics, station) => {
    metrics[station.id] = {
      condition: 'AIR_DISTANCE',
      distanceMeters: calculateHaversineDistanceMeters(origin, {
        lat: station.latitude,
        lng: station.longitude,
      }),
    };

    return metrics;
  }, {});
}

function buildRoutePresentation(
  metric: StationRouteMetric | undefined,
  hasUserLocation: boolean,
  isComputingDistances: boolean,
  hasLocationError: boolean,
): Pick<StationListItem, 'distanceSource' | 'distanceText' | 'travelTimeText'> {
  if (!hasUserLocation) {
    return {
      distanceSource: hasLocationError ? 'UNAVAILABLE' : 'PENDING',
      distanceText: hasLocationError ? 'Location required' : 'Awaiting location',
      travelTimeText: hasLocationError ? 'Access unavailable' : 'Getting location',
    };
  }

  if (isComputingDistances && !metric?.distanceMeters) {
    return {
      distanceSource: 'PENDING',
      distanceText: 'Calculating route',
      travelTimeText: 'Calculating travel time',
    };
  }

  if (typeof metric?.distanceMeters === 'number') {
    const isApproximate = metric.condition === 'AIR_DISTANCE';

    return {
      distanceSource: isApproximate ? 'APPROXIMATE' : 'ROUTE',
      distanceText: formatDistanceMeters(metric.distanceMeters),
      travelTimeText: isApproximate
        ? 'Approximate distance'
        : formatDurationMillis(metric.durationMillis),
    };
  }

  return {
    distanceSource: 'UNAVAILABLE',
    distanceText: 'Distance unavailable',
    travelTimeText: 'Route data unavailable',
  };
}

function buildSelectionCopy(station: Pick<StationListItem, 'distanceSource' | 'name' | 'travelTimeText'>): string {
  switch (station.distanceSource) {
    case 'ROUTE':
      return `${station.name} için tahmini sürüş süresi: ${station.travelTimeText}.`;
    case 'APPROXIMATE':
      return `${station.name} için yaklaşık mesafe gösteriliyor. Canlı rota detayları rota sayfasında hesaplanır.`;
    case 'PENDING':
      return `${station.name} seçildi. Rota mesafesi ve yolculuk süresi hesaplanıyor.`;
    case 'UNAVAILABLE':
      return `${station.name} seçildi. Rota mesafesini hesaplamak için tarayıcı konum erişimine izin verin.`;
    default:
      return `${station.name} seçildi.`;
  }
}

function resolveLocationError(error: unknown): string {
  if (error instanceof Error) {
    return translateUiMessage(error.message);
  }

  return 'Current location information cannot be retrieved at this time.';
}
