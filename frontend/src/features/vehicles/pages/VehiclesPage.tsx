import type {
  ChangeEvent,
  FormEvent,
} from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import type { Vehicle } from '../../shared/types';
import { clearToken } from '../../shared/utils/authToken';
import { translateUiMessage } from '../../shared/utils/messages';
import {
  createVehicle,
  getMyVehicles,
  type CreateVehicleRequest,
} from '../api/vehiclesApi';
import {
  VehicleForm,
  type VehicleFormErrors,
  type VehicleFormValues,
} from '../components/VehicleForm';

const initialFormValues: VehicleFormValues = {
  brand: '',
  model: '',
  batteryCapacityKWh: '',
  connectorType: 'CCS',
  maxSupportedPowerKW: '',
  plateNumber: '',
};

export function VehiclesPage(): JSX.Element {
  const navigate = useNavigate();
  const [formValues, setFormValues] =
    useState<VehicleFormValues>(initialFormValues);
  const [fieldErrors, setFieldErrors] = useState<VehicleFormErrors>({});
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const latestVehicle = vehicles[0] ?? null;
  const submissionStatus = successMessage
    ? 'Updated'
    : generalErrors.length > 0
      ? 'Review'
      : 'Ready';

  useEffect(() => {
    void loadVehicles();
  }, []);

  async function loadVehicles(): Promise<void> {
    setIsLoadingVehicles(true);

    try {
      const vehicleList = await getMyVehicles();
      setVehicles(vehicleList);
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(['Vehicle records cannot be retrieved at this time.']);
    } finally {
      setIsLoadingVehicles(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setGeneralErrors([]);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const payload = toCreateVehicleRequest(formValues);
      const createdVehicle = await createVehicle(payload);

      setVehicles((currentVehicles) => [createdVehicle, ...currentVehicles]);
      setFormValues(initialFormValues);
      setSuccessMessage('Vehicle registration completed successfully.');
    } catch (error) {
      handleAuthError(error);

      const parsedErrors = parseVehicleErrors(error);
      setFieldErrors(parsedErrors.fieldErrors);
      setGeneralErrors(parsedErrors.generalErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void {
    const { name, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));

    if (fieldErrors[name as keyof VehicleFormErrors]) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [name]: undefined,
      }));
    }

    if (successMessage) {
      setSuccessMessage(null);
    }
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
          <Link className="primary-button primary-button--auto" to="/stations">
            Next: Station Finder
          </Link>
        }
        badge="Vehicle identity and charging compatibility"
        description="Register the EV profile to be used in station selection, reservation verification, and charging operations."
        eyebrow="Vehicle Profiles"
        metrics={[
          {
            label: 'Registered',
            value: isLoadingVehicles ? 'Loading' : String(vehicles.length),
            hint: 'Saved vehicle records',
          },
          {
            label: 'Connector',
            value: formValues.connectorType,
            hint: 'Current form selection',
          },
          {
            label: 'Status',
            value: submissionStatus,
            hint: successMessage ?? 'Create or review a vehicle profile',
          },
        ]}
        title="Vehicle Registration"
      />

      <div className="insight-grid">
        <article className="insight-card">
          <span className="insight-card__label">Profiles</span>
          <strong>{isLoadingVehicles ? 'Loading' : vehicles.length}</strong>
          <p>Vehicle records available for reservation and compatibility checks.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Geçerli Connector</span>
          <strong>{formValues.connectorType}</strong>
          <p>Current connector selection in registration form.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Latest Profile</span>
          <strong>
            {latestVehicle
              ? `${latestVehicle.brand} ${latestVehicle.model}`
              : 'No registered vehicles'}
          </strong>
          <p>{latestVehicle ? latestVehicle.plateNumber : 'Register a vehicle to get started.'}</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Kayıt Statusu</span>
          <strong>{submissionStatus}</strong>
          <p>{generalErrors[0] ?? successMessage ?? 'Form is ready for a new vehicle registration.'}</p>
        </article>
      </div>

      <div className="page-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Vehicle Identity</h2>
              <p>Register the EV profile before proceeding to station discovery and reservations.</p>
            </div>
          </div>

          {successMessage ? (
            <div className="message-banner message-banner--success" role="status">
              Vehicle profile registered successfully.
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

          <VehicleForm
            errors={fieldErrors}
            formValues={formValues}
            isSubmitting={isSubmitting}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Registered Araçlar</h2>
              <p>Profiles available for reservations and charging operations.</p>
            </div>
            <Link className="text-link" to="/stations">
              Next: Station Finder
            </Link>
          </div>

          {isLoadingVehicles ? (
            <p aria-live="polite" className="empty-state" role="status">
              Loading vehicles...
            </p>
          ) : vehicles.length === 0 ? (
            <p className="empty-state">
              No vehicle profile added yet. Create a profile to start reservation planning.
            </p>
          ) : (
            <div className="stack-list">
              {vehicles.map((vehicle) => (
                <article className="vehicle-item" key={vehicle.id}>
                  <div className="vehicle-item__heading">
                    <div className="vehicle-item__identity">
                      <span className="vehicle-item__eyebrow">Registered Araç</span>
                      <h3>
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      <p>{vehicle.plateNumber}</p>
                    </div>
                    <span className="feature-card__note">
                      {vehicle.connectorType}
                    </span>
                  </div>

                  <div className="vehicle-item__meta-grid">
                    <article className="vehicle-item__metric">
                      <span>Battery</span>
                      <strong>{formatNumber(vehicle.batteryCapacityKWh)} kWh</strong>
                    </article>
                    <article className="vehicle-item__metric">
                      <span>Max Power</span>
                      <strong>{formatNumber(vehicle.maxSupportedPowerKW)} kW</strong>
                    </article>
                    <article className="vehicle-item__metric">
                      <span>License Plate</span>
                      <strong>{vehicle.plateNumber}</strong>
                    </article>
                    <article className="vehicle-item__metric">
                      <span>Created</span>
                      <strong>{formatDate(vehicle.createdAt)}</strong>
                    </article>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function toCreateVehicleRequest(
  formValues: VehicleFormValues,
): CreateVehicleRequest {
  return {
    brand: formValues.brand.trim(),
    model: formValues.model.trim(),
    batteryCapacityKWh: Number(formValues.batteryCapacityKWh),
    connectorType: formValues.connectorType,
    maxSupportedPowerKW: Number(formValues.maxSupportedPowerKW),
    plateNumber: formValues.plateNumber.trim(),
  };
}

function parseVehicleErrors(error: unknown): {
  fieldErrors: VehicleFormErrors;
  generalErrors: string[];
} {
  if (!(error instanceof ApiClientError)) {
    return {
      fieldErrors: {},
      generalErrors: ['Vehicle registration process currently unavailable.'],
    };
  }

  const details = error.details;
  const messages = extractMessages(details, error.message);
  const fieldErrors: VehicleFormErrors = {};
  const generalErrors: string[] = [];

  messages.forEach((message) => {
    const normalized = message.toLowerCase();

    if (normalized.includes('brand') || normalized.includes('marka')) {
      fieldErrors.brand = translateUiMessage(message);
      return;
    }

    if (normalized.includes('model')) {
      fieldErrors.model = translateUiMessage(message);
      return;
    }

    if (normalized.includes('battery') || normalized.includes('batarya')) {
      fieldErrors.batteryCapacityKWh = translateUiMessage(message);
      return;
    }

    if (normalized.includes('connector') || normalized.includes('connector')) {
      fieldErrors.connectorType = translateUiMessage(message);
      return;
    }

    if (
      normalized.includes('max supported power') ||
      normalized.includes('maxsupportedpower') ||
      normalized.includes('max charging power')
    ) {
      fieldErrors.maxSupportedPowerKW = translateUiMessage(message);
      return;
    }

    if (normalized.includes('plate') || normalized.includes('plaka')) {
      fieldErrors.plateNumber = translateUiMessage(message);
      return;
    }

    generalErrors.push(translateUiMessage(message));
  });

  if (generalErrors.length === 0 && Object.keys(fieldErrors).length === 0) {
    generalErrors.push(translateUiMessage(error.message));
  }

  return {
    fieldErrors,
    generalErrors,
  };
}

function extractMessages(details: unknown, fallbackMessage: string): string[] {
  if (typeof details === 'object' && details !== null && 'message' in details) {
    const detailMessage = details.message;

    if (Array.isArray(detailMessage)) {
      return Array.from(
        new Set(
          detailMessage.filter(
            (message): message is string => typeof message === 'string',
          ),
        ),
      );
    }

    if (typeof detailMessage === 'string') {
      return [detailMessage];
    }
  }

  return [fallbackMessage];
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR');
}
