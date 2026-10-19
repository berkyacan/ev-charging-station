import { Link } from 'react-router-dom';
import { formatReservationStatusLabel } from '../../shared/utils/labels';
import type { ReservationDetailsResponse } from '../api/reservationsApi';

interface RoutePanelProps {
  reservation: ReservationDetailsResponse;
}

export function RoutePanel({ reservation }: RoutePanelProps): JSX.Element {
  const destinationHref = buildDirectionsHref(
    reservation.station.latitude,
    reservation.station.longitude,
  );

  return (
    <section className="card route-panel route-panel--ready">
      <div className="section-heading">
        <div>
          <h2>Reservation Confirmed</h2>
          <p>Open route guidance, then proceed to start the charging session.</p>
        </div>
        <span className="status-pill status-pill--confirmed">Onaylandı</span>
      </div>

      <div className="route-panel__hero">
        <div>
          <span className="route-panel__eyebrow">Sonraki Adım</span>
          <strong>{reservation.station.name}: open route guidance</strong>
          <p>{reservation.station.address} · Then proceed to charging sessions.</p>
        </div>
      </div>

      <div className="route-panel__summary">
        <article className="route-panel__metric">
          <span>Station</span>
          <strong>{reservation.station.name}</strong>
        </article>
        <article className="route-panel__metric">
          <span>Charger</span>
          <strong>{reservation.charger.label}</strong>
        </article>
        <article className="route-panel__metric">
          <span>Operating Hours</span>
          <strong>{reservation.station.operatingHours}</strong>
        </article>
        <article className="route-panel__metric">
          <span>Status</span>
          <strong>{formatReservationStatusLabel(reservation.status)}</strong>
        </article>
      </div>

      <div className="route-panel__actions">
        <Link
          className="primary-button primary-button--auto"
          to={`/route/${reservation.station.id}`}
        >
          Continue to Route Guidance
        </Link>
        <Link
          className="secondary-button secondary-button--link"
          to={`/charging-sessions?reservationId=${reservation.id}`}
        >
          Next: Charging Sessions
        </Link>
        <a
          className="secondary-button secondary-button--link"
          href={destinationHref}
          rel="noreferrer"
          target="_blank"
        >
          Open in Google Maps
        </a>
      </div>
    </section>
  );
}

function buildDirectionsHref(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
