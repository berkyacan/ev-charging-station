import type { Station } from '../../shared/types';
import {
  loadGoogleRoutesLibrary,
  type GoogleLatLngLiteral,
  type GoogleRouteMatrixItem,
} from '../../shared/utils/googleMaps';

export interface StationRouteMetric {
  condition?: string;
  distanceMeters?: number;
  durationMillis?: number;
}

export async function computeStationRouteMetrics(
  apiKey: string,
  origin: GoogleLatLngLiteral,
  stations: Pick<Station, 'id' | 'latitude' | 'longitude'>[],
): Promise<Record<string, StationRouteMetric>> {
  if (stations.length === 0) {
    return {};
  }

  const { mapsApi, routesLibrary } = await loadGoogleRoutesLibrary(apiKey);
  const response = await routesLibrary.RouteMatrix.computeRouteMatrix({
    destinations: stations.map((station) => ({
      lat: station.latitude,
      lng: station.longitude,
    })),
    fields: ['distanceMeters', 'durationMillis', 'condition'],
    origins: [origin],
    travelMode: 'DRIVING',
    units: mapsApi.UnitSystem.METRIC,
  });
  const firstRow = response.matrix.rows[0];

  return stations.reduce<Record<string, StationRouteMetric>>((metrics, station, index) => {
    const item = firstRow?.items[index];

    if (item) {
      metrics[station.id] = mapRouteMatrixItem(item);
      return metrics;
    }

    metrics[station.id] = {};
    return metrics;
  }, {});
}

export function calculateHaversineDistanceMeters(
  origin: GoogleLatLngLiteral,
  destination: GoogleLatLngLiteral,
): number {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = degreesToRadians(destination.lat - origin.lat);
  const longitudeDelta = degreesToRadians(destination.lng - origin.lng);
  const startLatitude = degreesToRadians(origin.lat);
  const endLatitude = degreesToRadians(destination.lat);

  const haversineValue =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));

  return earthRadiusMeters * angularDistance;
}

export function formatDistanceMeters(distanceMeters?: number): string {
  if (typeof distanceMeters !== 'number' || Number.isNaN(distanceMeters)) {
    return 'Mesafe bekleniyor';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const kilometers = distanceMeters / 1000;

  if (kilometers < 10) {
    return `${kilometers.toFixed(1)} km`;
  }

  return `${Math.round(kilometers)} km`;
}

export function formatDurationMillis(durationMillis?: number): string {
  if (typeof durationMillis !== 'number' || Number.isNaN(durationMillis)) {
    return 'Awaiting duration';
  }

  const totalMinutes = Math.max(1, Math.round(durationMillis / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes} dk`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} sa` : `${hours} sa ${minutes} dk`;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function mapRouteMatrixItem(item: GoogleRouteMatrixItem): StationRouteMetric {
  return {
    condition: item.condition,
    distanceMeters: item.distanceMeters,
    durationMillis: item.durationMillis,
  };
}
