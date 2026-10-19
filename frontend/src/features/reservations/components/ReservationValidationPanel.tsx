import type { ReservationValidationResponse } from '../api/reservationsApi';
import { formatChargerStatusLabel } from '../../shared/utils/labels';
import type { Charger, Vehicle } from '../../shared/types';

interface ReservationValidationPanelProps {
  fallbackErrors?: string[];
  result: ReservationValidationResponse | null;
  selectedCharger?: Charger | null;
  selectedVehicle?: Vehicle | null;
}

export function ReservationValidationPanel({
  fallbackErrors = [],
  result,
  selectedCharger = null,
  selectedVehicle = null,
}: ReservationValidationPanelProps): JSX.Element {
  const hasFallbackErrors = fallbackErrors.length > 0;
  const hasValidationResult = result !== null;
  const isValid = hasFallbackErrors ? false : result?.isValid ?? null;
  const vehicle = result?.vehicle ?? selectedVehicle;
  const charger = result?.charger ?? selectedCharger;
  const validationErrors = hasFallbackErrors ? fallbackErrors : result?.errors ?? [];

  if (!hasValidationResult && !hasFallbackErrors) {
    return (
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Compatibility Check</h2>
            <p>Run validation to review reservation compatibility before confirming.</p>
          </div>
        </div>

        <div className="validation-placeholder">
          <span className="validation-placeholder__eyebrow">Awaiting Review</span>
          <strong>No compatibility result yet</strong>
          <p>Run the compatibility check from the form to review reservation eligibility.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        isValid
          ? 'card validation-panel validation-panel--valid'
          : 'card validation-panel validation-panel--invalid'
      }
    >
      <div className="section-heading">
        <div>
          <h2>Compatibility Result</h2>
          <p>Review reservation rules and compatibility result for the selected vehicle and charger.</p>
        </div>
        <span
          className={
            isValid
              ? 'status-pill status-pill--confirmed'
              : 'status-pill status-pill--occupied'
          }
        >
          {isValid ? 'Ready' : 'Action Required'}
        </span>
      </div>

      <div className="validation-result">
        <span
          className={
            isValid
              ? 'validation-result__flag validation-result__flag--valid'
              : 'validation-result__flag validation-result__flag--invalid'
          }
        >
          {isValid ? 'PASSED' : 'REVIEW'}
        </span>
        <div className="validation-result__content">
          <strong>
            {isValid
              ? 'Reservation can be created'
              : 'Reservation cannot be created'}
          </strong>
          <p>
            {isValid
              ? 'Connector, power, and reservation rules are compatible for this selection.'
              : 'Review the errors below and update your selection before proceeding.'}
          </p>
        </div>
      </div>

      {isValid ? null : (
        <div className="message-banner message-banner--error validation-errors" role="alert">
          <ul className="message-list">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {vehicle || charger ? (
        <div className="validation-summary-grid">
          {vehicle ? (
            <article className="summary-card validation-summary-card">
              <div className="validation-summary-card__header">
                <span className="validation-summary-card__eyebrow">Vehicle</span>
                <h3>
                  {vehicle.brand} {vehicle.model}
                </h3>
                <p>{vehicle.plateNumber}</p>
              </div>

              <div className="validation-summary-card__grid">
                <article className="validation-metric">
                  <span>Connector</span>
                  <strong>{vehicle.connectorType}</strong>
                </article>
                <article className="validation-metric">
                  <span>Battery</span>
                  <strong>{formatNumber(vehicle.batteryCapacityKWh)} kWh</strong>
                </article>
                <article className="validation-metric">
                  <span>Max Power</span>
                  <strong>{formatNumber(vehicle.maxSupportedPowerKW)} kW</strong>
                </article>
              </div>
            </article>
          ) : null}

          {charger ? (
            <article className="summary-card validation-summary-card">
              <div className="validation-summary-card__header">
                <span className="validation-summary-card__eyebrow">Charger</span>
                <h3>{charger.label}</h3>
                <p>
                  {charger.connectorType} konnektör · {charger.chargerType} şarj cihazı
                </p>
              </div>

              <div className="validation-summary-card__grid">
                <article className="validation-metric">
                  <span>Status</span>
                  <strong>{formatChargerStatusLabel(charger.status)}</strong>
                </article>
                <article className="validation-metric">
                  <span>Connector</span>
                  <strong>{charger.connectorType}</strong>
                </article>
                <article className="validation-metric">
                  <span>Power</span>
                  <strong>{formatNumber(charger.powerOutputKW)} kW</strong>
                </article>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
