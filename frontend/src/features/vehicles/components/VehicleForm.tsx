import type { ChangeEvent, FormEvent } from 'react';
import type { ConnectorType } from '../../shared/types';

const BATTERY_CAPACITY_MIN_KWH = 5;
const BATTERY_CAPACITY_MAX_KWH = 250;
const MAX_SUPPORTED_POWER_MIN_KW = 3;
const MAX_SUPPORTED_POWER_MAX_KW = 350;

export interface VehicleFormValues {
  brand: string;
  model: string;
  batteryCapacityKWh: string;
  connectorType: ConnectorType;
  maxSupportedPowerKW: string;
  plateNumber: string;
}

export interface VehicleFormErrors {
  brand?: string;
  model?: string;
  batteryCapacityKWh?: string;
  connectorType?: string;
  maxSupportedPowerKW?: string;
  plateNumber?: string;
}

interface VehicleFormProps {
  errors: VehicleFormErrors;
  formValues: VehicleFormValues;
  isSubmitting: boolean;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const connectorOptions: ConnectorType[] = ['TYPE2', 'CCS', 'CHADEMO'];

export function VehicleForm({
  errors,
  formValues,
  isSubmitting,
  onChange,
  onSubmit,
}: VehicleFormProps): JSX.Element {
  return (
    <form className="form-stack vehicle-form" onSubmit={onSubmit}>
      <section className="form-section">
        <div className="form-section__header">
          <span className="form-section__eyebrow">Vehicle Identity</span>
          <h3>Vehicle Identity</h3>
          <p>Registration information used in reservations and charging operations.</p>
        </div>

        <div className="form-grid form-grid--three">
          <label className="field-group" htmlFor="brand">
            <span className="field-label">Brand</span>
            <input
              className="text-input"
              id="brand"
              name="brand"
              onChange={onChange}
              placeholder="e.g. Tesla"
              required
              type="text"
              value={formValues.brand}
            />
            <span className="field-hint">Vehicle manufacturer.</span>
            {errors.brand ? <span className="field-error">{errors.brand}</span> : null}
          </label>

          <label className="field-group" htmlFor="model">
            <span className="field-label">Model</span>
            <input
              className="text-input"
              id="model"
              name="model"
              onChange={onChange}
              placeholder="e.g. Model 3"
              required
              type="text"
              value={formValues.model}
            />
            <span className="field-hint">Commercial model name.</span>
            {errors.model ? <span className="field-error">{errors.model}</span> : null}
          </label>

          <label className="field-group" htmlFor="plateNumber">
            <span className="field-label">License Plate</span>
            <input
              className="text-input"
              id="plateNumber"
              name="plateNumber"
              onChange={onChange}
              placeholder="e.g. 35 ABC 123"
              required
              type="text"
              value={formValues.plateNumber}
            />
            <span className="field-hint">Primary identifier for the vehicle.</span>
            {errors.plateNumber ? (
              <span className="field-error">{errors.plateNumber}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <span className="form-section__eyebrow">Charging Compatibility</span>
          <h3>Charging Compatibility</h3>
          <p>Technical specifications used for compatibility and power validation.</p>
        </div>

        <div className="form-grid form-grid--three">
          <label className="field-group" htmlFor="batteryCapacityKWh">
            <span className="field-label">Battery Capacity (kWh)</span>
            <input
              className="text-input"
              id="batteryCapacityKWh"
              max={BATTERY_CAPACITY_MAX_KWH}
              min={BATTERY_CAPACITY_MIN_KWH}
              name="batteryCapacityKWh"
              onChange={onChange}
              placeholder="75"
              required
              step="0.1"
              type="number"
              value={formValues.batteryCapacityKWh}
            />
            <span className="field-hint">
              Battery capacity must be between 5-250 kWh.
            </span>
            {errors.batteryCapacityKWh ? (
              <span className="field-error">{errors.batteryCapacityKWh}</span>
            ) : null}
          </label>

          <label className="field-group" htmlFor="connectorType">
            <span className="field-label">Connector Type</span>
            <select
              className="text-input"
              id="connectorType"
              name="connectorType"
              onChange={onChange}
              value={formValues.connectorType}
            >
              {connectorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="field-hint">Preferred charging connector standard.</span>
            {errors.connectorType ? (
              <span className="field-error">{errors.connectorType}</span>
            ) : null}
          </label>

          <label className="field-group" htmlFor="maxSupportedPowerKW">
            <span className="field-label">Max Supported Power (kW)</span>
            <input
              className="text-input"
              id="maxSupportedPowerKW"
              max={MAX_SUPPORTED_POWER_MAX_KW}
              min={MAX_SUPPORTED_POWER_MIN_KW}
              name="maxSupportedPowerKW"
              onChange={onChange}
              placeholder="50"
              required
              step="0.1"
              type="number"
              value={formValues.maxSupportedPowerKW}
            />
            <span className="field-hint">
              Max charging power must be between 3-350 kW.
            </span>
            {errors.maxSupportedPowerKW ? (
              <span className="field-error">{errors.maxSupportedPowerKW}</span>
            ) : null}
          </label>
        </div>
      </section>

      <button className="primary-button primary-button--auto" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Registering vehicle...' : 'Register Vehicle'}
      </button>
    </form>
  );
}
