import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Charger, Station, Vehicle } from '../../shared/types';
import { formatAvailabilityReason, formatChargerStatusLabel } from '../../shared/utils/labels';

export interface ReservationFormValues {
  vehicleId: string;
  stationId: string;
  chargerId: string;
  startTime: string;
  endTime: string;
}

interface ReservationFormProps {
  chargers: Charger[];
  formValues: ReservationFormValues;
  isCreating: boolean;
  isLoadingChargers: boolean;
  isReady: boolean;
  isValidating: boolean;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onValidate: () => void;
  selectedChargerAvailabilityWarning?: string | null;
  selectedStationOperatingHours?: string | null;
  selectedStationName?: string | null;
  stations: Station[];
  vehicles: Vehicle[];
}

export function ReservationForm({
  chargers,
  formValues,
  isCreating,
  isLoadingChargers,
  isReady,
  isValidating,
  onChange,
  onCreate,
  onValidate,
  selectedChargerAvailabilityWarning,
  selectedStationOperatingHours,
  selectedStationName,
  stations,
  vehicles,
}: ReservationFormProps): JSX.Element {
  return (
    <form className="form-stack reservation-form" onSubmit={onCreate}>
      <section className="form-section">
        <div className="form-section__header">
          <span className="form-section__eyebrow">Reservation Setup</span>
          <h3>Select Vehicle and Charger</h3>
          <p>Select your EV profile, station, and charging asset.</p>
        </div>

        <div className="form-grid form-grid--three">
          <label className="field-group" htmlFor="vehicleId">
            <span className="field-label">Vehicle</span>
            <select
              className="text-input"
              id="vehicleId"
              name="vehicleId"
              onChange={onChange}
              value={formValues.vehicleId}
            >
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model} - {vehicle.plateNumber}
                </option>
              ))}
            </select>
            <span className="field-hint">Select the EV profile to use for this reservation.</span>
          </label>

          <label className="field-group" htmlFor="stationId">
            <span className="field-label">Station</span>
            <select
              className="text-input"
              id="stationId"
              name="stationId"
              onChange={onChange}
              value={formValues.stationId}
            >
              <option value="">Select station</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
            <span className="field-hint">Select the charging location for this reservation.</span>
          </label>

          <label className="field-group" htmlFor="chargerId">
            <span className="field-label">Selected Charger</span>
            <select
              className="text-input"
              disabled={!formValues.stationId || isLoadingChargers}
              id="chargerId"
              name="chargerId"
              onChange={onChange}
              value={formValues.chargerId}
            >
              <option value="">
                {isLoadingChargers
                  ? 'Loading chargers...'
                  : formValues.stationId
                    ? 'Select charger'
                    : 'Select station first'}
              </option>
              {chargers.map((charger) => (
                <option key={charger.id} value={charger.id}>
                  {charger.label ?? `${charger.chargerType} Charger`} -{' '}
                  {charger.connectorType} - {formatNumber(charger.powerOutputKW)} kW -{' '}
                  {toChargerAvailabilityLabel(charger)}
                </option>
              ))}
            </select>
            <span className="field-hint">Only chargers at the selected station are shown.</span>
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <span className="form-section__eyebrow">Time Window</span>
          <h3>Select Time Window</h3>
          <p>Set your planned arrival and charging end window.</p>
        </div>

        <div className="two-column-grid">
          <label className="field-group" htmlFor="startTime">
            <span className="field-label">Start Time</span>
            <input
              className="text-input"
              id="startTime"
              name="startTime"
              onChange={onChange}
              required
              type="datetime-local"
              value={formValues.startTime}
            />
            <span className="field-hint">Set your planned arrival time.</span>
          </label>

          <label className="field-group" htmlFor="endTime">
            <span className="field-label">End Time</span>
            <input
              className="text-input"
              id="endTime"
              name="endTime"
              onChange={onChange}
              required
              type="datetime-local"
              value={formValues.endTime}
            />
            <span className="field-hint">Set your expected charging end time.</span>
          </label>
        </div>

        {selectedStationOperatingHours ? (
          <p className="inline-note">
            Station operating hours: {selectedStationOperatingHours}
          </p>
        ) : null}

        {selectedChargerAvailabilityWarning ? (
          <div className="message-banner" role="status">
            <span className="message-banner__title">Selected Charger</span>
            <span>{selectedChargerAvailabilityWarning}</span>
          </div>
        ) : null}

        <p className="inline-note">
          Map availability shows current device status. Slot availability for the selected time window is verified at reservation.
        </p>
      </section>

      <div className="reservation-form__footer">
        <div className="reservation-form__prompt">
          <span className="status-pill status-pill--completed">Compatibility Check</span>
          <p className="inline-note">
            Run compatibility check before confirming to catch connector, power, and timing conflicts early.
          </p>
        </div>

        {selectedStationName ? (
          <div className="reservation-form__prefill">
            <span className="reservation-form__prefill-label">Pre-selected Station</span>
            <strong>{selectedStationName}</strong>
          </div>
        ) : null}

        {vehicles.length === 0 ? (
          <div className="message-banner message-banner--error" role="alert">
            No vehicles available.{' '}
            <Link className="text-link" to="/vehicles">
              Vehicle Registration
            </Link>
            page to register a vehicle first.
          </div>
        ) : null}
      </div>

      <div className="reservation-actions-shell">
        <div className="reservation-actions__hint">
          <span className="reservation-actions__eyebrow">Reservation Flow</span>
          <p>
            Verify selection, confirm reservation, and proceed to route navigation.
          </p>
        </div>

        <div className="reservation-actions">
          <button
            className="secondary-button"
            disabled={!isReady || isValidating}
            onClick={onValidate}
            type="button"
          >
            {isValidating ? 'Checking compatibility...' : 'Check Compatibility'}
          </button>

          <button
            className="primary-button primary-button--auto"
            disabled={!isReady || isCreating}
            type="submit"
          >
            {isCreating ? 'Creating reservation...' : 'Create Reservation'}
          </button>
        </div>
      </div>
    </form>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function toChargerAvailabilityLabel(charger: Charger): string {
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
      return translatedReason ?? formatChargerStatusLabel(charger.status);
  }
}
