import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import { clearToken } from '../../shared/utils/authToken';
import { formatChargingSessionStatusLabel } from '../../shared/utils/labels';
import { translateUiMessage } from '../../shared/utils/messages';
import {
  getChargingHistory,
  type ChargingSessionSummaryResponse,
} from '../../chargingSessions/api/chargingSessionsApi';

export function HistoryPage(): JSX.Element {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<ChargingSessionSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const totalConsumedKWh = useMemo(
    () =>
      historyItems.reduce(
        (total, session) => total + (session.consumedKWh ?? 0),
        0,
      ),
    [historyItems],
  );
  const totalCost = useMemo(
    () =>
      historyItems.reduce(
        (total, session) => total + (session.totalCost ?? 0),
        0,
      ),
    [historyItems],
  );

  useEffect(() => {
    let isActive = true;

    async function loadHistory(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const sessions = await getChargingHistory();

        if (!isActive) {
          return;
        }

        setHistoryItems(
          [...sessions].sort(
            (left, right) =>
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }

        setErrorMessage(resolveHistoryError(error));
        setHistoryItems([]);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  return (
    <section className="page-shell">
      <PageHero
        actions={
          <Link className="secondary-button secondary-button--link" to="/charging-sessions">
            Back to Sessions
          </Link>
        }
        badge="Charging Records"
        description="Review completed charging sessions, energy consumed, and payment records in session history."
        eyebrow="Session History"
        metrics={[
          {
            label: 'Sessions',
            value: isLoading ? 'Loading' : String(historyItems.length),
            hint: 'Completed records',
          },
          {
            label: 'Last Operation',
            value: isLoading
              ? 'Loading'
              : historyItems[0]
                ? formatDateTime(historyItems[0].createdAt)
                : 'No data',
            hint: 'Latest completed record',
          },
        ]}
        title="Charging History"
      />

      <div className="insight-grid">
        <article className="insight-card">
          <span className="insight-card__label">Completed Sessions</span>
          <strong>{isLoading ? 'Loading' : String(historyItems.length)}</strong>
          <p>Charging records displayed on the history screen.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Energy Consumed</span>
          <strong>{isLoading ? 'Loading' : `${formatNumber(totalConsumedKWh)} kWh`}</strong>
          <p>Total energy recorded in completed sessions.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Total Amount</span>
          <strong>{isLoading ? 'Loading' : `${formatNumber(totalCost)} TL`}</strong>
          <p>Combined payment amount in the current record view.</p>
        </article>
      </div>

      <div className="card">
        <div className="helper-card helper-card--split">
          <div>
            <span className="helper-card__eyebrow">Record View</span>
            <h2>Each completed session preserves energy and payment records</h2>
            <p>Consumed kWh, applied rate, and final amount saved on one screen for quick review.</p>
            <div className="helper-card__specs">
              <span className="helper-chip">Digital receipt</span>
              <span className="helper-chip">Station and device information</span>
              <span className="helper-chip">Completed session archive</span>
            </div>
          </div>
          <Link className="secondary-button secondary-button--link" to="/charging-sessions">
            Back to Charging Sessions
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <div className="message-banner message-banner--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Charging History</h2>
            <p>Completed charging records retrieved from the authorized history service.</p>
          </div>
          <Link className="secondary-button secondary-button--link" to="/charging-sessions">
            Back to Charging Sessions
          </Link>
        </div>

        {isLoading ? (
          <div
            aria-live="polite"
            className="session-empty-state session-empty-state--loading"
            role="status"
          >
            <span className="session-empty-state__eyebrow">Loading</span>
            <strong>Preparing charging history</strong>
            <p>Loading completed charging sessions.</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="session-empty-state">
            <span className="session-empty-state__eyebrow">No Records</span>
            <strong>No completed charging sessions yet</strong>
            <p>History records will be displayed here when a charging session is completed.</p>
          </div>
        ) : (
          <div className="stack-list">
            {historyItems.map((session) => (
              <article className="reservation-item ledger-card" key={session.id}>
                <div className="reservation-item__header">
                  <div>
                    <h3>{session.station.name}</h3>
                    <p>{session.charger.label} · {session.charger.connectorType}</p>
                  </div>
                  <span className="status-pill status-pill--completed">
                    {toStatusLabel(session.status)}
                  </span>
                </div>

                <div className="ledger-card__grid">
                  <article className="ledger-card__metric">
                    <span>Completed</span>
                    <strong>{formatDateTime(session.createdAt)}</strong>
                  </article>
                  <article className="ledger-card__metric">
                    <span>Energy Consumed</span>
                    <strong>{formatNullableNumber(session.consumedKWh)} kWh</strong>
                  </article>
                  <article className="ledger-card__metric">
                    <span>Unit Price</span>
                    <strong>{formatNumber(session.pricePerKWh)} TL/kWh</strong>
                  </article>
                  <article className="ledger-card__metric">
                    <span>Total Amount</span>
                    <strong>{formatNullableNumber(session.totalCost)} TL</strong>
                  </article>
                </div>

                <div className="reservation-item__actions">
                  <Link
                    className="secondary-button secondary-button--link"
                    to={`/charging-sessions/${session.id}/summary`}
                  >
                    View Summary
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Bekleniyor' : formatNumber(value);
}

function resolveHistoryError(error: unknown): string {
  if (error instanceof ApiClientError && error.message.trim() !== '') {
    return translateUiMessage(error.message);
  }

  return 'Charging history is currently unavailable.';
}

function toStatusLabel(status: string): string {
  return formatChargingSessionStatusLabel(status);
}
