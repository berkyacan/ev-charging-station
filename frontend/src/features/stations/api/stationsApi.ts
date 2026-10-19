import { apiClient } from '../../shared/api';
import type {
  Charger,
  ChargerAvailabilitySummary,
  ConnectorType,
  Station,
} from '../../shared/types';

export interface StationFilters {
  connectorType?: ConnectorType | '';
  minPowerKW?: number;
  maxPricePerKWh?: number;
  startTime?: string;
  endTime?: string;
}

export interface StationChargersResponse {
  stationId: string;
  stationName: string;
  chargerAvailabilitySummary: ChargerAvailabilitySummary;
  chargers: Charger[];
}

export function getStations(filters: StationFilters = {}): Promise<Station[]> {
  return apiClient.get<Station[]>(buildStationsUrl(filters));
}

export function getStationById(stationId: string): Promise<Station> {
  return apiClient.get<Station>(`/stations/${stationId}`);
}

export function getStationChargers(
  stationId: string,
  filters: StationFilters = {},
): Promise<StationChargersResponse> {
  return apiClient.get<StationChargersResponse>(
    buildStationChargersUrl(stationId, filters),
  );
}

function buildStationsUrl(filters: StationFilters): string {
  const query = buildQueryString(filters);

  return query ? `/stations?${query}` : '/stations';
}

function buildStationChargersUrl(
  stationId: string,
  filters: StationFilters,
): string {
  const query = buildQueryString(filters);

  return query
    ? `/stations/${stationId}/chargers?${query}`
    : `/stations/${stationId}/chargers`;
}

function buildQueryString(filters: StationFilters): string {
  const searchParams = new URLSearchParams();

  if (filters.connectorType) {
    searchParams.set('connectorType', filters.connectorType);
  }

  if (typeof filters.minPowerKW === 'number' && !Number.isNaN(filters.minPowerKW)) {
    searchParams.set('minPowerKW', String(filters.minPowerKW));
  }

  if (
    typeof filters.maxPricePerKWh === 'number' &&
    !Number.isNaN(filters.maxPricePerKWh)
  ) {
    searchParams.set('maxPricePerKWh', String(filters.maxPricePerKWh));
  }

  if (filters.startTime) {
    searchParams.set('startTime', filters.startTime);
  }

  if (filters.endTime) {
    searchParams.set('endTime', filters.endTime);
  }

  return searchParams.toString();
}
