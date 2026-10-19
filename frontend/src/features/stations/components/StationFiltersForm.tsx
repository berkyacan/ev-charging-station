import type { ChangeEvent, FormEvent } from 'react';
import type { ConnectorType } from '../../shared/types';
import type { StationFilters } from '../api/stationsApi';

export interface StationFilterValues {
  connectorType: ConnectorType | '';
  minPowerKW: string;
  maxPricePerKWh: string;
  startTime: string;
  endTime: string;
}

interface StationFiltersFormProps {
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: StationFilterValues;
}

const connectorOptions: Array<ConnectorType | ''> = ['', 'TYPE2', 'CCS', 'CHADEMO'];

export function StationFiltersForm({
  onChange,
  onReset,
  onSubmit,
  values,
}: StationFiltersFormProps): JSX.Element {
  return (
    <form className="filter-form filter-toolbar" onSubmit={onSubmit}>
      <label className="field-group filter-toolbar__field" htmlFor="connectorType">
        <span className="field-label">CONNECTOR</span>
        <select
          className="text-input"
          id="connectorType"
          name="connectorType"
          onChange={onChange}
          value={values.connectorType}
        >
          {connectorOptions.map((option) => (
            <option key={option || 'all'} value={option}>
              {option || 'All connectors'}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group filter-toolbar__field" htmlFor="minPowerKW">
        <span className="field-label">MIN POWER (kW)</span>
        <input
          className="text-input"
          id="minPowerKW"
          min="0"
          name="minPowerKW"
          onChange={onChange}
          placeholder="50"
          step="0.1"
          type="number"
          value={values.minPowerKW}
        />
      </label>

      <label className="field-group filter-toolbar__field" htmlFor="maxPricePerKWh">
        <span className="field-label">MAX PRICE (TL/kWh)</span>
        <input
          className="text-input"
          id="maxPricePerKWh"
          min="0"
          name="maxPricePerKWh"
          onChange={onChange}
          placeholder="4"
          step="0.1"
          type="number"
          value={values.maxPricePerKWh}
        />
      </label>

      <label className="field-group filter-toolbar__field" htmlFor="startTime">
        <span className="field-label">START TIME</span>
        <input
          className="text-input"
          id="startTime"
          name="startTime"
          onChange={onChange}
          type="datetime-local"
          value={values.startTime}
        />
      </label>

      <label className="field-group filter-toolbar__field" htmlFor="endTime">
        <span className="field-label">END TIME</span>
        <input
          className="text-input"
          id="endTime"
          name="endTime"
          onChange={onChange}
          type="datetime-local"
          value={values.endTime}
        />
      </label>

      <div className="filter-form__actions filter-toolbar__actions">
        <button className="primary-button primary-button--auto" type="submit">
          Apply Filters
        </button>
        <button className="secondary-button" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </form>
  );
}

export function toStationFilters(values: StationFilterValues): StationFilters {
  return {
    connectorType: values.connectorType,
    minPowerKW: values.minPowerKW ? Number(values.minPowerKW) : undefined,
    maxPricePerKWh: values.maxPricePerKWh
      ? Number(values.maxPricePerKWh)
      : undefined,
    startTime: values.startTime
      ? new Date(values.startTime).toISOString()
      : undefined,
    endTime: values.endTime
      ? new Date(values.endTime).toISOString()
      : undefined,
  };
}
