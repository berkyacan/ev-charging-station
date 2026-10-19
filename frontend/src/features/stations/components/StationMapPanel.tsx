import { useEffect, useRef, useState } from 'react';
import {
  loadGoogleMapsApi,
  type GoogleInfoWindow,
  type GoogleMap,
  type GoogleMapsApi,
  type GoogleMarker,
} from '../../shared/utils/googleMaps';
import type { Station } from '../../shared/types';
import { formatChargerStatusLabel } from '../../shared/utils/labels';
import {
  getUserLocationDisplayLabel,
  isFallbackUserLocation,
  type UserLocation,
} from '../../shared/utils/userLocation';

export type StationAvailability = 'AVAILABLE' | 'OCCUPIED' | 'OFFLINE';
export type StationDistanceSource =
  | 'APPROXIMATE'
  | 'PENDING'
  | 'ROUTE'
  | 'UNAVAILABLE';

export interface StationListItem extends Station {
  availability: StationAvailability;
  distanceSource: StationDistanceSource;
  distanceText: string;
  travelTimeText: string;
}

interface StationMapPanelProps {
  googleMapsApiKey?: string;
  isComputingDistances: boolean;
  isLocating: boolean;
  locationError: string | null;
  onSelectStation: (stationId: string) => void;
  selectedStationId: string | null;
  stations: StationListItem[];
  userLocation: UserLocation | null;
}

const availabilityColors: Record<StationAvailability, string> = {
  AVAILABLE: '#059669',
  OCCUPIED: '#d97706',
  OFFLINE: '#dc2626',
};

export function StationMapPanel({
  googleMapsApiKey,
  isComputingDistances,
  isLocating,
  locationError,
  onSelectStation,
  selectedStationId,
  stations,
  userLocation,
}: StationMapPanelProps): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);
  const userMarkerRef = useRef<GoogleMarker | null>(null);
  const [mapsApi, setMapsApi] = useState<GoogleMapsApi | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(Boolean(googleMapsApiKey));
  const [mapError, setMapError] = useState<string | null>(null);

  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ?? null;
  const networkAvailableCount = stations.filter(
    (station) => station.availability === 'AVAILABLE',
  ).length;
  const selectedStationAvailabilitySummary =
    selectedStation?.chargerAvailabilitySummary ?? null;
  const currentLocationLabel = getUserLocationDisplayLabel(userLocation);
  const selectedRouteSummary = selectedStation
    ? `${selectedStation.distanceText} · ${selectedStation.travelTimeText}`
    : isComputingDistances
      ? 'Calculating route distances'
    : isLocating
      ? 'Getting current location'
    : locationError
        ? 'Location access required'
        : 'Select a station';

  useEffect(() => {
    if (!googleMapsApiKey) {
      setMapsApi(null);
      setMapError(null);
      setIsMapLoading(false);
      return;
    }

    let isActive = true;

    setIsMapLoading(true);
    setMapError(null);

    void loadGoogleMapsApi(googleMapsApiKey)
      .then((loadedMapsApi) => {
        if (!isActive) {
          return;
        }

        setMapsApi(loadedMapsApi);
        setIsMapLoading(false);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setMapsApi(null);
        setMapError(
          'Map service currently unavailable. Station list available.',
        );
        setIsMapLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [googleMapsApiKey]);

  useEffect(() => {
    if (!mapsApi || !mapElementRef.current || stations.length === 0) {
      clearMarkers(markersRef.current);
      clearUserMarker(userMarkerRef.current);
      return;
    }

    if (!mapRef.current) {
      const initialCenter = {
        lat: stations[0].latitude,
        lng: stations[0].longitude,
      };

      mapRef.current = new mapsApi.Map(mapElementRef.current, {
        backgroundColor: '#dfe8f7',
        center: initialCenter,
        clickableIcons: false,
        disableDefaultUI: true,
        fullscreenControl: false,
        gestureHandling: 'cooperative',
        mapTypeControl: false,
        streetViewControl: false,
        zoom: 11,
        zoomControl: true,
      });
    }

    if (!infoWindowRef.current) {
      infoWindowRef.current = new mapsApi.InfoWindow();
    }

    const map = mapRef.current;
    const infoWindow = infoWindowRef.current;
    const bounds = new mapsApi.LatLngBounds();
    const userPosition = userLocation
      ? {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        }
      : null;

    clearMarkers(markersRef.current);
    clearUserMarker(userMarkerRef.current);
    markersRef.current = stations.map((station) => {
      const marker = new mapsApi.Marker({
        icon: buildMarkerIcon(
          mapsApi,
          station.availability,
          station.id === selectedStationId,
        ),
        map,
        position: {
          lat: station.latitude,
          lng: station.longitude,
        },
        title: station.name,
        zIndex: station.id === selectedStationId ? 2 : 1,
      });

      marker.addListener('click', () => {
        onSelectStation(station.id);
      });

      bounds.extend({
        lat: station.latitude,
        lng: station.longitude,
      });

      return marker;
    });

    if (userPosition) {
      bounds.extend(userPosition);
      userMarkerRef.current = new mapsApi.Marker({
        icon: buildUserMarkerIcon(mapsApi),
        map,
        position: userPosition,
        title: currentLocationLabel,
        zIndex: 3,
      });
    }

    if (selectedStation && userPosition) {
      bounds.extend({
        lat: selectedStation.latitude,
        lng: selectedStation.longitude,
      });
      map.fitBounds(bounds);
    } else if (selectedStation) {
      const position = {
        lat: selectedStation.latitude,
        lng: selectedStation.longitude,
      };

      map.setCenter(position);
      map.setZoom(13);
      map.panTo(position);
    } else {
      map.fitBounds(bounds);
    }

    if (selectedStation) {
      const activeMarker = markersRef.current.find(
        (_marker, index) => stations[index]?.id === selectedStation.id,
      );

      if (activeMarker) {
        infoWindow.setContent(buildInfoWindowContent(selectedStation));
        infoWindow.open({
          anchor: activeMarker,
          map,
        });
      }
    } else {
      infoWindow.close();
    }

    return () => {
      infoWindow.close();
      clearMarkers(markersRef.current);
      clearUserMarker(userMarkerRef.current);
    };
  }, [
    mapsApi,
    onSelectStation,
    selectedStation,
    selectedStationId,
    stations,
    currentLocationLabel,
    userLocation,
  ]);

  return (
    <div className="station-map-panel">
      <div className="station-map">
        <div className="station-map__header">
          <div>
            <h2>Network Map</h2>
            <p>
              {googleMapsApiKey && !mapError
                ? 'Live map view remains synchronized with the filtered station list.'
                : 'Map service currently unavailable. Station list available.'}
            </p>
          </div>
          <div className="status-legend">
            <span className="legend-item">
              <span className="legend-dot legend-dot--available" />
              Available
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-dot--occupied" />
              Occupied
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-dot--offline" />
              Offline
            </span>
          </div>
        </div>

        <div className="map-surface">
          <div className="map-surface__toolbar">
            <div>
              <span className="insight-card__label">Map Service</span>
              <strong>{googleMapsApiKey && !mapError ? 'Live Map' : 'Station Map'}</strong>
            </div>
            <div>
              <span className="insight-card__label">Current Location</span>
              <strong>{currentLocationLabel}</strong>
              <span className="map-toolbar-note">
                {userLocation
                  ? isFallbackUserLocation(userLocation)
                    ? 'Current location matched to Izmir / Alsancak.'
                    : 'Connected with browser location.'
                  : isLocating
                    ? 'Waiting for browser location.'
                    : locationError ?? 'Waiting for current location.'}
              </span>
            </div>
            <div>
              <span className="insight-card__label">Focus</span>
              <strong>{selectedStation?.name ?? 'Select a station'}</strong>
            </div>
            <div>
              <span className="insight-card__label">Route Guidance</span>
              <strong>
                {selectedRouteSummary}
              </strong>
              <span className="map-toolbar-note">
                {selectedStationAvailabilitySummary
                  ? `${selectedStationAvailabilitySummary.availableChargers}/${selectedStationAvailabilitySummary.totalChargers} şarj cihazı uygun`
                  : `${networkAvailableCount}/${stations.length} istasyon uygun`}
              </span>
            </div>
          </div>

          {googleMapsApiKey && !mapError ? (
            <div className="map-live-shell">
              <div className="map-live-canvas" ref={mapElementRef} />
              {isMapLoading ? (
                <div className="map-overlay" role="status">
                  Loading live map...
                </div>
              ) : null}
            </div>
          ) : (
            <div className="map-canvas map-canvas--fallback">
              <div className="map-preview-card">
                <span className="map-preview-card__eyebrow">Network Map</span>
                <strong>{selectedStation?.name ?? 'Select a station'}</strong>
                <p>
                  {selectedStation
                    ? `${selectedStation.address} · ${selectedStation.distanceText}`
                    : 'Select a station to review availability and route guidance.'}
                </p>
                <p>Current location: {currentLocationLabel}</p>
              </div>

              {userLocation ? (
                <div
                  className="map-marker map-marker--user"
                  style={{
                    left: `${getFallbackMapPosition(userLocation.latitude, userLocation.longitude).left}%`,
                    top: `${getFallbackMapPosition(userLocation.latitude, userLocation.longitude).top}%`,
                  }}
                >
                  <span className="map-marker__dot map-marker__dot--current" />
                  <span className="map-marker__label">{currentLocationLabel}</span>
                </div>
              ) : null}

              {stations.map((station) => {
                const position = getStationPosition(station);

                return (
                  <button
                    aria-pressed={selectedStationId === station.id}
                    className={
                      selectedStationId === station.id
                        ? 'map-marker map-marker--selected'
                        : 'map-marker'
                    }
                    key={station.id}
                    onClick={() => onSelectStation(station.id)}
                    style={{
                      left: `${position.left}%`,
                      top: `${position.top}%`,
                    }}
                    type="button"
                  >
                    <span
                      className={`map-marker__dot ${toStatusDotClass(station.availability)}`}
                    />
                    <span className="map-marker__label">{station.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {mapError ? (
          <div className="message-banner message-banner--error" role="alert">
            {mapError}
          </div>
        ) : null}
      </div>

      <div className="station-list">
        {stations.map((station) => (
          <button
            aria-pressed={selectedStationId === station.id}
            className={
              selectedStationId === station.id
                ? 'station-list-item station-list-item--selected'
                : 'station-list-item'
            }
            key={station.id}
            onClick={() => onSelectStation(station.id)}
            type="button"
          >
            <div className="station-list-item__header">
              <div className="station-list-item__title">
                <h3>{station.name}</h3>
                <p className="station-list-item__address">{station.address}</p>
              </div>
              <div className="station-list-item__state">
                {selectedStationId === station.id ? (
                    <span className="station-list-item__focus">Selected</span>
                ) : null}
                <span className={`status-pill ${toStatusPillClass(station.availability)}`}>
                  {toStatusLabel(station.availability)}
                </span>
              </div>
            </div>

            <div className="station-list-item__meta">
              <article className="station-list-item__metric">
                <span>Distance</span>
                <strong>{station.distanceText}</strong>
                <small>{station.travelTimeText}</small>
              </article>
              <article className="station-list-item__metric">
                <span>Chargers</span>
                <strong>
                  {station.chargerAvailabilitySummary?.availableChargers ?? 0}/
                  {station.chargerAvailabilitySummary?.totalChargers ?? 0} uygun
                </strong>
              </article>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function clearMarkers(markers: GoogleMarker[]): void {
  markers.forEach((marker) => {
    marker.setMap(null);
  });
}

function clearUserMarker(marker: GoogleMarker | null): void {
  marker?.setMap(null);
}

function buildMarkerIcon(
  mapsApi: GoogleMapsApi,
  status: StationAvailability,
  isSelected: boolean,
) {
  return {
    fillColor: availabilityColors[status],
    fillOpacity: 1,
    path: mapsApi.SymbolPath.CIRCLE,
    scale: isSelected ? 11 : 8,
    strokeColor: isSelected ? '#0f1728' : '#ffffff',
    strokeWeight: isSelected ? 3 : 2,
  };
}

function buildInfoWindowContent(station: StationListItem): string {
  return `
    <div style="min-width: 180px; padding: 0.15rem 0.1rem;">
      <strong style="display:block; font-size: 14px; color: #0f1728;">${escapeHtml(station.name)}</strong>
      <span style="display:block; margin-top: 4px; color: #475467; font-size: 12px;">${escapeHtml(station.address)}</span>
      <span style="display:block; margin-top: 8px; color: ${availabilityColors[station.availability]}; font-size: 12px; font-weight: 700; text-transform: uppercase;">${toStatusLabel(station.availability)}</span>
      <span style="display:block; margin-top: 6px; color: #0f1728; font-size: 12px; font-weight: 700;">${escapeHtml(station.distanceText)} · ${escapeHtml(station.travelTimeText)}</span>
    </div>
  `;
}

function buildUserMarkerIcon(mapsApi: GoogleMapsApi) {
  return {
    fillColor: '#1d4ed8',
    fillOpacity: 1,
    path: mapsApi.SymbolPath.CIRCLE,
    scale: 7,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  };
}

function getFallbackMapPosition(
  latitude: number,
  longitude: number,
): { left: number; top: number } {
  return {
    left: normalizeValue(longitude, 27.02, 27.22, 16, 84),
    top: normalizeValue(latitude, 38.36, 38.5, 76, 18),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStationPosition(station: Station): { left: number; top: number } {
  return getFallbackMapPosition(station.latitude, station.longitude);
}

function normalizeValue(
  value: number,
  min: number,
  max: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  const safeRatio = (value - min) / (max - min);
  const clampedRatio = Math.min(1, Math.max(0, safeRatio));

  return rangeStart + clampedRatio * (rangeEnd - rangeStart);
}

function toStatusDotClass(status: StationAvailability): string {
  switch (status) {
    case 'AVAILABLE':
      return 'map-marker__dot--available';
    case 'OCCUPIED':
      return 'map-marker__dot--occupied';
    case 'OFFLINE':
      return 'map-marker__dot--offline';
    default:
      return 'map-marker__dot--offline';
  }
}

function toStatusPillClass(status: StationAvailability): string {
  switch (status) {
    case 'AVAILABLE':
      return 'status-pill--available';
    case 'OCCUPIED':
      return 'status-pill--occupied';
    case 'OFFLINE':
      return 'status-pill--offline';
    default:
      return 'status-pill--offline';
  }
}

function toStatusLabel(status: StationAvailability): string {
  return formatChargerStatusLabel(status);
}
