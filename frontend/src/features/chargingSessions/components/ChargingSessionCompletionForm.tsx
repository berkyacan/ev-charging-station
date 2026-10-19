import type { ChangeEvent, FormEvent } from 'react';

export interface ChargingSessionFormValues {
  endEnergyKWh: string;
  startEnergyKWh: string;
}

interface ChargingSessionCompletionFormProps {
  formValues: ChargingSessionFormValues;
  isSubmitting: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChargingSessionCompletionForm({
  formValues,
  isSubmitting,
  onChange,
  onSubmit,
}: ChargingSessionCompletionFormProps): JSX.Element {
  return (
    <form className="form-stack session-completion-form" onSubmit={onSubmit}>
      <section className="form-section">
        <div className="form-section__header">
          <span className="form-section__eyebrow">Energy Values</span>
          <h3>Enter final meter readings</h3>
          <p>Enter start and end energy values to complete consumption, cost, and session summary.</p>
        </div>

        <div className="two-column-grid">
          <label className="field-group" htmlFor="startEnergyKWh">
            <span className="field-label">Start Energy (kWh)</span>
            <input
              className="text-input"
              id="startEnergyKWh"
              min="0"
              name="startEnergyKWh"
              onChange={onChange}
              required
              step="0.1"
              type="number"
              value={formValues.startEnergyKWh}
            />
            <span className="field-hint">Enter the meter reading recorded at session start.</span>
          </label>

          <label className="field-group" htmlFor="endEnergyKWh">
            <span className="field-label">End Energy (kWh)</span>
            <input
              className="text-input"
              id="endEnergyKWh"
              min="0"
              name="endEnergyKWh"
              onChange={onChange}
              required
              step="0.1"
              type="number"
              value={formValues.endEnergyKWh}
            />
            <span className="field-hint">Enter the meter reading recorded when the session ends.</span>
          </label>
        </div>
      </section>

      <div className="reservation-form__footer">
        <div className="session-formula">
          <span className="session-formula__eyebrow">Cost Formula</span>
          <strong>Consumed energy = end energy − start energy</strong>
          <p>
            The final amount is calculated by multiplying consumed energy by the charger rate in <code>TL/kWh</code> .
          </p>
        </div>
        <div className="inline-note">
          Enter start and end meter values manually. The final amount is calculated on the backend using the energy difference and charger rate.
        </div>
      </div>

      <div className="reservation-actions-shell">
        <div className="reservation-actions__hint">
          <span className="reservation-actions__eyebrow">Complete Session</span>
          <p>Complete the session to save values and proceed to payment.</p>
        </div>

        <div className="reservation-actions">
          <button
            className="primary-button primary-button--auto"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? 'Completing session...'
              : 'Complete Session and Proceed to Payment'}
          </button>
        </div>
      </div>
    </form>
  );
}
