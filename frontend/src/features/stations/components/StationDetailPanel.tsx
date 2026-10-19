import { Link } from 'react-router-dom';
import type { Charger, Station } from '../../shared/types';
import { formatAvailabilityReason, formatChargerStatusLabel } from '../../shared/utils/labels';
import type { StationAvailability } from './StationMapPanel';

interface StationDetailPanelProps {
  availability: StationAvailability | null;
  chargers: Charger[];
  hasStations: boolean;
  isLoading: boolean;
  selectedSlot?: {
    endTime: string;
    startTime: string;
  } | null;
  station: Station | null;
}

export function StationDetailPanel({
  availability,
  chargers,
  hasStations,
  isLoading,
  selectedSlot,
  station,
}: StationDetailPanelProps): JSX.Element {
  if (!station) {
    return (
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Select a station</h2>
            <p>
              Şarj cihazlarını ve rota bilgilerini görmek için haritadan veya
              listeden bir istasyon seçin.
            </p>
          </div>
        </div>

        <p className="empty-state">
          {hasStations
            ? 'Chargers and station information will be shown here when you make a selection.'
            : 'No stations match the current search criteria.'}
        </p>
      </section>
    );
  }

  const availableChargers = station.chargerAvailabilitySummary?.availableChargers ?? 0;
  const totalChargers = station.chargerAvailabilitySummary?.totalChargers ?? 0;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <span className="insight-card__label">Station Details</span>
          <h2>{station.name}</h2>
          <p>{station.address}</p>
        </div>
        <div className="station-detail__status">
          {availability ? (
            <span className={`status-pill ${toStatusPillClass(availability)}`}>
              {toStatusLabel(availability)}
            </span>
          ) : null}
          <Link
            className="secondary-button secondary-button--link"
            to={`/route/${station.id}`}
          >
            Open Route Guidance
          </Link>
        </div>
      </div>

      <div className="station-detail__summary">
        <article className="station-detail__metric">
          <span>Available Chargers</span>
          <strong>{availableChargers}</strong>
        </article>
        <article className="station-detail__metric">
          <span>Total Chargers</span>
          <strong>{totalChargers}</strong>
        </article>
        <article className="station-detail__metric">
          <span>Operating Hours</span>
          <strong>{station.operatingHours}</strong>
        </article>
        <article className="station-detail__metric">
          <span>Coordinates</span>
          <strong>
            {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
          </strong>
        </article>
      </div>

      <div className="charger-section">
        <div className="section-heading">
          <div>
            <h3>Chargers</h3>
            <p>Select a charger and proceed to create a reservation.</p>
          </div>
        </div>

        {isLoading ? (
          <p aria-live="polite" className="empty-state" role="status">
            Loading chargers...
          </p>
        ) : chargers.length === 0 ? (
          <p className="empty-state">
            No chargers at this station match the current filters.
          </p>
        ) : (
          <div className="stack-list">
            {chargers.map((charger) => (
              <article className="charger-card" key={charger.id}>
                <div className="charger-card__header">
                  <div>
                    <h3>{charger.label ?? `${charger.chargerType} Charger`}</h3>
                    <p>
                      {charger.connectorType} konnektör · {charger.chargerType} şarj cihazı
                    </p>
                  </div>
                  <span
                    className={`status-pill ${toStatusPillClass(
                      selectedSlot
                        ? (charger.availabilityForSelectedSlot ?? charger.status)
                        : charger.status,
                    )}`}
                  >
                    {selectedSlot
                      ? toSelectedSlotStatusLabel(charger)
                      : toStatusLabel(charger.status)}
                  </span>
                </div>

                <dl className="detail-grid">
                  <div>
                    <dt>Power</dt>
                    <dd>{formatNumber(charger.powerOutputKW)} kW</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{formatNumber(charger.pricePerKWh)} TL/kWh</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{charger.chargerType}</dd>
                  </div>
                  <div>
                    <dt>Connector</dt>
                    <dd>{charger.connectorType}</dd>
                  </div>
                </dl>

                {selectedSlot && charger.availabilityReason ? (
                  <p className="inline-note">{formatAvailabilityReason(charger.availabilityReason)}</p>
                ) : null}

                <Link
                  className="primary-button primary-button--auto"
                  to={buildReservationPath(station, charger, selectedSlot)}
                >
                  Proceed to Reservation
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function buildReservationPath(
  station: Station,
  charger: Charger,
  selectedSlot?: {
    endTime: string;
    startTime: string;
  } | null,
): string {
  const searchParams = new URLSearchParams({
    chargerId: charger.id,
    chargerLabel: charger.label ?? '',
    stationId: station.id,
    stationName: station.name,
  });

  if (selectedSlot?.startTime) {
    searchParams.set('startTime', selectedSlot.startTime);
  }

  if (selectedSlot?.endTime) {
    searchParams.set('endTime', selectedSlot.endTime);
  }

  return `/reservations/new?${searchParams.toString()}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function toStatusPillClass(status: StationAvailability | Charger['status']): string {
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

function toStatusLabel(status: StationAvailability | Charger['status']): string {
  return formatChargerStatusLabel(status);
}

function toSelectedSlotStatusLabel(charger: Charger): string {
  const translatedReason = formatAvailabilityReason(charger.availabilityReason);

  if (
    translatedReason ===
    'Reservation time is outside station operating hours.'
  ) {
    return 'Outside operating hours';
  }

  switch (charger.availabilityForSelectedSlot ?? charger.status) {
    case 'AVAILABLE':
      return 'Uygun';
    case 'OCCUPIED':
      return 'Not available for selected time';
    case 'OFFLINE':
      return 'Offline';
    default:
      return translatedReason ?? 'Unavailable';
  }
}
