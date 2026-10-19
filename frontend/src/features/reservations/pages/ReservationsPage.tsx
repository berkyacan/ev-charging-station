import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import { useToast } from '../../shared/components/ToastProvider';
import { clearToken } from '../../shared/utils/authToken';
import { formatReservationStatusLabel } from '../../shared/utils/labels';
import { extractTranslatedApiMessages } from '../../shared/utils/messages';
import {
  cancelReservation,
  getMyReservations,
  type ReservationDetailsResponse,
} from '../api/reservationsApi';

export function ReservationsPage(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [reservations, setReservations] = useState<ReservationDetailsResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);
  const [reservationToCancel, setReservationToCancel] =
    useState<ReservationDetailsResponse | null>(null);
  const [reservationToReschedule, setReservationToReschedule] =
    useState<ReservationDetailsResponse | null>(null);
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const confirmedCount = reservations.filter(
    (reservation) => reservation.status === 'CONFIRMED',
  ).length;
  const completedCount = reservations.filter(
    (reservation) => reservation.status === 'COMPLETED',
  ).length;
  const cancelledCount = reservations.filter(
    (reservation) => reservation.status === 'CANCELLED',
  ).length;

  useEffect(() => {
    void loadReservations();
  }, []);

  async function loadReservations(): Promise<void> {
    setIsLoading(true);
    setGeneralErrors([]);

    try {
      const reservationList = await getMyReservations();
      setReservations(reservationList);
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(['Reservations cannot be retrieved at this time.']);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel(reservationId: string): Promise<void> {
    setIsCancellingId(reservationId);
    setGeneralErrors([]);
    setSuccessMessage(null);
    setReservationToCancel(null);

    try {
      const updatedReservation = await cancelReservation(reservationId);
      setReservations((currentReservations) =>
        currentReservations.map((reservation) =>
          reservation.id === updatedReservation.id
            ? updatedReservation
            : reservation,
        ),
      );
      setSuccessMessage('Reservation cancelled successfully.');
      showToast({
        message: 'Reservation cancelled successfully.',
        tone: 'success',
      });
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(
        extractTranslatedApiMessages(error, 'Reservation cannot be cancelled at this time.'),
      );
    } finally {
      setIsCancellingId(null);
    }
  }

  function handleReschedule(reservation: ReservationDetailsResponse): void {
    const nextRoute = new URLSearchParams({
      chargerId: reservation.charger.id,
      endTime: reservation.endTime,
      rescheduleFrom: reservation.id,
      startTime: reservation.startTime,
      stationId: reservation.station.id,
      stationName: reservation.station.name,
      vehicleId: reservation.vehicle.id,
    });

    navigate(`/reservations/new?${nextRoute.toString()}`);
  }

  function handleAuthError(error: unknown): void {
    if (error instanceof ApiClientError && error.status === 401) {
      clearToken();
      navigate('/login', { replace: true });
    }
  }

  return (
    <section className="page-shell">
      <PageHero
        actions={
          <>
            <Link className="secondary-button secondary-button--link" to="/reservations/new">
              New Reservation
            </Link>
            <Link className="secondary-button secondary-button--link" to="/charging-sessions">
              Open Charging Sessions
            </Link>
          </>
        }
        badge="Reservation lifecycle"
        description="Review reservations, verify charger context, and move confirmed records to charging sessions."
        eyebrow="Reservations"
        metrics={[
          {
            label: 'Total',
            value: isLoading ? 'Loading' : String(reservations.length),
            hint: 'All reservation records',
          },
          {
            label: 'Confirmed',
            value: String(
              reservations.filter((reservation) => reservation.status === 'CONFIRMED').length,
            ),
            hint: 'Ready to charge',
          },
          {
            label: 'Status',
            value: successMessage ? 'Updated' : 'Stable',
            hint: successMessage ?? 'No pending changes',
          },
        ]}
        title="Reservations"
      />

      <div className="insight-grid">
        <article className="insight-card">
          <span className="insight-card__label">Confirmed</span>
          <strong>{confirmedCount}</strong>
          <p>Reservations ready to charge.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Completed</span>
          <strong>{completedCount}</strong>
          <p>Reservations with closed lifecycle.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Cancelled</span>
          <strong>{cancelledCount}</strong>
          <p>Reservations no longer active.</p>
        </article>
      </div>

      <div className="card">
        <div className="helper-card">
          <div>
            <h2>Reservations</h2>
            <p>Create a reservation, then return here to track status changes or proceed to charging sessions.</p>
          </div>
          <div className="reservation-actions">
            <Link className="secondary-button secondary-button--link" to="/reservations/new">
              New Reservation
            </Link>
            <Link className="secondary-button secondary-button--link" to="/charging-sessions">
              Proceed to Charging
            </Link>
          </div>
        </div>
      </div>

      {successMessage ? (
        <div className="message-banner message-banner--success" role="status">
          {successMessage}
        </div>
      ) : null}

      {generalErrors.length > 0 ? (
        <div className="message-banner message-banner--error" role="alert">
          <ul className="message-list">
            {generalErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Reservation List</h2>
            <p>All reservation records available for the current account.</p>
          </div>
        </div>

        {isLoading ? (
          <p aria-live="polite" className="empty-state" role="status">
            Loading reservations...
          </p>
        ) : reservations.length === 0 ? (
          <p className="empty-state">
            No reservations yet.{' '}
            <Link className="text-link" to="/reservations/new">
              Open the reservation form
            </Link>
            to create a new reservation.
          </p>
        ) : (
          <div className="stack-list">
            {reservations.map((reservation) => (
              <article className="reservation-item" key={reservation.id}>
                <div className="reservation-item__header">
                  <div>
                    <h3>{reservation.station.name}</h3>
                    <p>{reservation.charger.label}</p>
                  </div>
                  <span
                    className={`status-pill ${toReservationStatusClass(
                      reservation.status,
                    )}`}
                  >
                    {formatReservationStatusLabel(reservation.status)}
                  </span>
                </div>

                <dl className="detail-grid">
                  <div>
                    <dt>Start</dt>
                    <dd>{formatDateTime(reservation.startTime)}</dd>
                  </div>
                  <div>
                    <dt>End</dt>
                    <dd>{formatDateTime(reservation.endTime)}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{reservation.station.address}</dd>
                  </div>
                  <div>
                    <dt>Connector</dt>
                    <dd>{reservation.charger.connectorType}</dd>
                  </div>
                </dl>

                {reservation.status === 'CONFIRMED' ? (
                  <div className="reservation-item__actions">
                    <Link
                      className="primary-button primary-button--auto"
                      to={`/charging-sessions?reservationId=${reservation.id}`}
                    >
                      Start Charging Flow
                    </Link>
                    <Link
                      className="secondary-button secondary-button--link"
                      to={`/route/${reservation.station.id}`}
                    >
                      Open Route Guidance
                    </Link>
                    <button
                      className="secondary-button secondary-button--link"
                      onClick={() => setReservationToReschedule(reservation)}
                      type="button"
                    >
                      Reschedule
                    </button>
                    <button
                      className="secondary-button"
                      disabled={isCancellingId === reservation.id}
                      onClick={() => setReservationToCancel(reservation)}
                      type="button"
                    >
                      {isCancellingId === reservation.id
                        ? 'Cancelling...'
                        : 'Cancel Reservation'}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {reservationToCancel ? (
        <div
          aria-modal="true"
          className="dialog-backdrop"
          role="dialog"
        >
          <div className="dialog-panel">
            <div className="dialog-panel__content">
              <span className="dialog-panel__eyebrow">Randevu İşlemi</span>
              <h2>Are you sure you want to cancel this reservation?</h2>
              <p>
                {reservationToCancel.station.name} at station{' '}
                {reservationToCancel.charger.label} will be cancelled.
              </p>
            </div>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setReservationToCancel(null)}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="primary-button"
                disabled={isCancellingId === reservationToCancel.id}
                onClick={() => void handleCancel(reservationToCancel.id)}
                type="button"
              >
                {isCancellingId === reservationToCancel.id
                  ? 'Cancelling...'
                  : 'Cancel Reservation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reservationToReschedule ? (
        <div
          aria-modal="true"
          className="dialog-backdrop"
          role="dialog"
        >
          <div className="dialog-panel">
            <div className="dialog-panel__content">
              <span className="dialog-panel__eyebrow">Randevu Değişikliği</span>
              <h2>Reschedule this reservation?</h2>
              <p>
                Current reservation details will be copied to the new reservation form. You can cancel the old reservation after creating the new one.
              </p>
            </div>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setReservationToReschedule(null)}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="primary-button"
                onClick={() => handleReschedule(reservationToReschedule)}
                type="button"
              >
                Open Form
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toReservationStatusClass(
  status: ReservationDetailsResponse['status'],
): string {
  switch (status) {
    case 'CONFIRMED':
      return 'status-pill--confirmed';
    case 'COMPLETED':
      return 'status-pill--completed';
    case 'CANCELLED':
      return 'status-pill--cancelled';
    default:
      return 'status-pill--confirmed';
  }
}
