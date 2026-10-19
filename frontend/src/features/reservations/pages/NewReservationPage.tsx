import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import type { Charger, Station, Vehicle } from '../../shared/types';
import { clearToken } from '../../shared/utils/authToken';
import { formatAvailabilityReason, formatWorkflowStateLabel } from '../../shared/utils/labels';
import { extractTranslatedApiMessages } from '../../shared/utils/messages';
import {
  getStationChargers,
  getStations,
} from '../../stations/api/stationsApi';
import { getMyVehicles } from '../../vehicles/api/vehiclesApi';
import {
  cancelReservation,
  createReservation,
  getMyReservations,
  type ReservationDetailsResponse,
  type ReservationRequestPayload,
  type ReservationValidationResponse,
  validateReservation,
} from '../api/reservationsApi';
import { ReservationForm, type ReservationFormValues } from '../components/ReservationForm';
import { ReservationValidationPanel } from '../components/ReservationValidationPanel';
import { RoutePanel } from '../components/RoutePanel';
import { useToast } from '../../shared/components/ToastProvider';

export function NewReservationPage(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const prefilledStationId = searchParams.get('stationId') ?? '';
  const prefilledStationName = searchParams.get('stationName');
  const prefilledChargerId = searchParams.get('chargerId') ?? '';
  const prefilledVehicleId = searchParams.get('vehicleId') ?? '';
  const prefilledStartTime = searchParams.get('startTime');
  const prefilledEndTime = searchParams.get('endTime');
  const rescheduleFromReservationId = searchParams.get('rescheduleFrom') ?? '';

  const [formValues, setFormValues] = useState<ReservationFormValues>(() => ({
    vehicleId: prefilledVehicleId,
    stationId: prefilledStationId,
    chargerId: prefilledChargerId,
    ...createInitialDateWindow(prefilledStartTime, prefilledEndTime),
  }));
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isLoadingChargers, setIsLoadingChargers] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ReservationValidationResponse | null>(null);
  const [validationFeedbackErrors, setValidationFeedbackErrors] = useState<string[]>([]);
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdReservation, setCreatedReservation] =
    useState<ReservationDetailsResponse | null>(null);
  const [rescheduleSourceReservation, setRescheduleSourceReservation] =
    useState<ReservationDetailsResponse | null>(null);
  const [isCancellingSourceReservation, setIsCancellingSourceReservation] =
    useState(false);
  const [rescheduleStatusMessage, setRescheduleStatusMessage] =
    useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!formValues.stationId) {
      setChargers([]);
      setFormValues((currentValues) => ({
        ...currentValues,
        chargerId: '',
      }));
      return;
    }

    if (
      !formValues.startTime ||
      !formValues.endTime ||
      !isValidDateInput(formValues.startTime) ||
      !isValidDateInput(formValues.endTime)
    ) {
      return;
    }

    void loadChargers(formValues.stationId, {
      endTime: new Date(formValues.endTime).toISOString(),
      startTime: new Date(formValues.startTime).toISOString(),
    });
  }, [formValues.endTime, formValues.startTime, formValues.stationId]);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === formValues.stationId) ?? null,
    [formValues.stationId, stations],
  );

  const selectedCharger = useMemo(
    () => chargers.find((charger) => charger.id === formValues.chargerId) ?? null,
    [chargers, formValues.chargerId],
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === formValues.vehicleId) ?? null,
    [formValues.vehicleId, vehicles],
  );
  const selectedSlotAvailabilityWarning = useMemo(() => {
    if (!selectedCharger?.availabilityReason) {
      return null;
    }

    return formatAvailabilityReason(selectedCharger.availabilityReason);
  }, [selectedCharger]);
  const hasSelectionStepCompleted =
    Boolean(formValues.vehicleId) &&
    Boolean(formValues.stationId) &&
    Boolean(formValues.chargerId) &&
    Boolean(formValues.startTime) &&
    Boolean(formValues.endTime);

  const isReadyForSubmission =
    hasSelectionStepCompleted;

  const workflowSteps = [
    {
      code: '01',
      description: 'Vehicle, station, charger, and reservation time window',
      state: hasSelectionStepCompleted ? 'complete' : 'current',
      title: 'Select vehicle and charger',
    },
    {
      code: '02',
      description: validationResult?.isValid
        ? 'Compatibility validated against reservation rules'
        : 'Run compatibility check before confirming reservation',
      state: validationResult
        ? validationResult.isValid
          ? 'complete'
          : 'alert'
        : hasSelectionStepCompleted
          ? 'current'
          : 'pending',
      title: 'Verify Compatibility',
    },
    {
      code: '03',
      description: createdReservation
        ? 'Reservation confirmed and route guidance ready'
        : 'Confirm reservation and proceed to route navigation',
      state: createdReservation
        ? 'complete'
        : validationResult?.isValid
          ? 'current'
          : 'pending',
      title: 'Reservation Confirmation',
    },
  ] as const;

  async function loadInitialData(): Promise<void> {
    setIsLoadingInitialData(true);
    setGeneralErrors([]);

    try {
      const [vehicleList, stationList] = await Promise.all([
        getMyVehicles(),
        getStations(),
      ]);
      const rescheduleReservations = rescheduleFromReservationId
        ? await getMyReservations()
        : [];

      setVehicles(vehicleList);
      setStations(stationList);
      setRescheduleSourceReservation(
        rescheduleReservations.find(
          (reservation) => reservation.id === rescheduleFromReservationId,
        ) ?? null,
      );
      setFormValues((currentValues) => ({
        ...currentValues,
        vehicleId:
          currentValues.vehicleId ||
          vehicleList.find((vehicle) => vehicle.id === prefilledVehicleId)?.id ||
          vehicleList[0]?.id ||
          '',
        stationId:
          currentValues.stationId ||
          stationList.find((station) => station.id === prefilledStationId)?.id ||
          stationList[0]?.id ||
          '',
      }));
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(['Vehicle or station data cannot be retrieved at this time.']);
    } finally {
      setIsLoadingInitialData(false);
    }
  }

  async function loadChargers(
    stationId: string,
    slotFilters: { endTime: string; startTime: string },
  ): Promise<void> {
    setIsLoadingChargers(true);

    try {
      const response = await getStationChargers(stationId, slotFilters);
      const chargerList = response.chargers;

      setChargers(chargerList);
      setFormValues((currentValues) => {
        const hasCurrentSelection = chargerList.some(
          (charger) => charger.id === currentValues.chargerId,
        );
        const hasPrefilledSelection = chargerList.some(
          (charger) => charger.id === prefilledChargerId,
        );

        if (hasCurrentSelection) {
          return currentValues;
        }

        return {
          ...currentValues,
          chargerId:
            hasPrefilledSelection && currentValues.stationId === prefilledStationId
              ? prefilledChargerId
              : chargerList[0]?.id ?? '',
        };
      });
    } catch (error) {
      setChargers([]);
      setFormValues((currentValues) => ({
        ...currentValues,
        chargerId: '',
      }));
      setGeneralErrors(extractTranslatedApiMessages(error, 'Chargers at the selected station cannot be retrieved at this time.'));
    } finally {
      setIsLoadingChargers(false);
    }
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void {
    const { name, value } = event.target;

    setFormValues((currentValues) => {
      const nextValues = {
        ...currentValues,
        [name]: value,
      };

      if (name === 'stationId') {
        nextValues.chargerId = '';
      }

      return nextValues;
    });

    setValidationResult(null);
    setValidationFeedbackErrors([]);
    setSuccessMessage(null);
    setCreatedReservation(null);
    setGeneralErrors([]);
  }

  async function handleValidate(): Promise<void> {
    if (!isReadyForSubmission) {
      setGeneralErrors(['Fill in all reservation fields before running the compatibility check.']);
      return;
    }

    setIsValidating(true);
    setGeneralErrors([]);
    setValidationFeedbackErrors([]);
    setSuccessMessage(null);

    try {
      const response = await validateReservation(buildReservationPayload(formValues));
      setValidationResult(response);
    } catch (error) {
      handleAuthError(error);
      setValidationResult(null);
      const translatedErrors = extractTranslatedApiMessages(
        error,
        'Compatibility check is currently unavailable.',
      );
      setValidationFeedbackErrors(translatedErrors);
      setGeneralErrors(translatedErrors);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!isReadyForSubmission) {
      setGeneralErrors(['Fill in all fields before creating a reservation.']);
      return;
    }

    setIsCreating(true);
    setGeneralErrors([]);
    setValidationFeedbackErrors([]);
    setSuccessMessage(null);

    try {
      const reservation = await createReservation(
        buildReservationPayload(formValues),
      );

      setCreatedReservation(reservation);
      setSuccessMessage('Reservation created successfully.');
      setRescheduleStatusMessage(null);
      setValidationFeedbackErrors([]);
      showToast({
        message: 'Reservation created successfully.',
        tone: 'success',
      });
      setValidationResult((currentResult) =>
        currentResult ?? {
          charger: reservation.charger,
          errors: [],
          isValid: true,
          vehicle: reservation.vehicle,
        },
      );
    } catch (error) {
      handleAuthError(error);
      const translatedErrors = extractTranslatedApiMessages(
        error,
        'Reservation cannot be created at this time.',
      );
      setValidationFeedbackErrors(translatedErrors);
      setGeneralErrors(translatedErrors);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCancelPreviousReservation(): Promise<void> {
    if (!rescheduleFromReservationId) {
      return;
    }

    setIsCancellingSourceReservation(true);
    setGeneralErrors([]);

    try {
      const updatedReservation = await cancelReservation(rescheduleFromReservationId);
      const isAlreadyCancelled = updatedReservation.status === 'CANCELLED'
        && rescheduleSourceReservation?.status === 'CANCELLED';

      setRescheduleSourceReservation(updatedReservation);
      setRescheduleStatusMessage(
        isAlreadyCancelled
          ? 'Previous reservation is already cancelled.'
          : 'Previous reservation cancelled.',
      );
      showToast({
        message: isAlreadyCancelled
          ? 'Previous reservation is already cancelled.'
          : 'Previous reservation cancelled.',
        tone: 'success',
      });
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(
        extractTranslatedApiMessages(error, 'Previous reservation cannot be cancelled at this time.'),
      );
    } finally {
      setIsCancellingSourceReservation(false);
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
          <>
            <Link className="secondary-button secondary-button--link" to="/stations">
              Back to Station Finder
            </Link>
            <Link className="secondary-button secondary-button--link" to="/reservations">
              View Reservations
            </Link>
          </>
        }
        badge="Reservation flow"
        description="Select charging assets, verify compatibility, confirm reservation, and proceed to route navigation."
        eyebrow="Reservations"
        metrics={[
          {
            label: 'Vehicles',
            value: isLoadingInitialData ? 'Loading' : String(vehicles.length),
            hint: 'Available profiles',
          },
          {
            label: 'Stations',
            value: isLoadingInitialData ? 'Loading' : String(stations.length),
            hint: 'Loaded locations',
          },
          {
            label: 'Selected Charger',
            value: selectedCharger?.label ?? 'Make a selection',
            hint: selectedStation?.name ?? 'Current station context',
          },
        ]}
        title="Create Reservation"
      />

      <div className="insight-grid">
        <article className="insight-card">
          <span className="insight-card__label">Vehicle</span>
          <strong>{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Select vehicle'}</strong>
          <p>{selectedVehicle ? selectedVehicle.connectorType : 'Select a vehicle profile first.'}</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Station</span>
          <strong>{selectedStation?.name ?? 'Select station'}</strong>
          <p>{selectedCharger?.label ?? 'Then select a charger.'}</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Compatibility Check</span>
          <strong>{validationResult ? (validationResult.isValid ? 'Passed' : 'Action Required') : 'Pending'}</strong>
          <p>
            {validationResult
              ? validationResult.isValid
                ? 'Ready to create reservation.'
                : 'Review the returned backend rules.'
              : 'Run the compatibility check before creating a reservation.'}
          </p>
        </article>
      </div>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Reservation Flow</h2>
            <p>Follow the flow from selection to validation, confirmation, and route navigation.</p>
          </div>
        </div>

        <div className="workflow-steps">
          {workflowSteps.map((step) => (
            <article
              className={`workflow-step workflow-step--${step.state}`}
              key={step.code}
            >
              <div className="workflow-step__header">
                <span className="workflow-step__index">{step.code}</span>
                <span className="workflow-step__state">
                  {formatWorkflowStateLabel(step.state)}
                </span>
              </div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {successMessage ? (
        <div className="message-banner message-banner--success" role="status">
          {successMessage}
        </div>
      ) : null}

      {rescheduleFromReservationId ? (
        <div className="card">
          <div className="helper-card helper-card--split">
            <div>
              <span className="helper-card__eyebrow">Reschedule</span>
              <h2>Existing reservation details loaded into new form fields</h2>
              <p>
                Yeni saat aralığını seçip uygunluğu kontrol ederek yeni
                randevunuzu oluşturabilirsiniz.
              </p>
            </div>
            <div className="reservation-actions">
              {createdReservation &&
              rescheduleSourceReservation?.status !== 'CANCELLED' ? (
                <button
                  className="secondary-button"
                  disabled={isCancellingSourceReservation}
                  onClick={() => void handleCancelPreviousReservation()}
                  type="button"
                >
                  {isCancellingSourceReservation
                    ? 'Cancelling previous reservation...'
                    : 'Cancel Previous Reservation'}
                </button>
              ) : null}
            </div>
          </div>

          {rescheduleSourceReservation?.status === 'CANCELLED' || rescheduleStatusMessage ? (
            <div className="message-banner message-banner--success" role="status">
              {rescheduleStatusMessage ?? 'Previous reservation is already cancelled.'}
            </div>
          ) : null}
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

      <div className="page-grid">
        <section className="card">
          <div className="section-heading">
            <div>
                <h2>Select vehicle and charger</h2>
                <p>Select your EV profile, charging context, and reservation time window.</p>
            </div>
          </div>

          {isLoadingInitialData ? (
            <p aria-live="polite" className="empty-state" role="status">
            Loading vehicles and stations...
            </p>
          ) : vehicles.length === 0 ? (
            <div className="session-empty-state">
              <span className="session-empty-state__eyebrow">Vehicle Required</span>
              <strong>Register a vehicle before creating a reservation</strong>
              <p>
                {' '}
                <Link className="text-link" to="/vehicles">
                  Vehicle Kaydı
                </Link>{' '}
                page to add an EV profile before proceeding.
              </p>
            </div>
          ) : stations.length === 0 ? (
            <div className="session-empty-state">
              <span className="session-empty-state__eyebrow">Station Required</span>
              <strong>Station data currently unavailable</strong>
              <p>
                {' '}
                <Link className="text-link" to="/stations">
                  Station Bulucu
                </Link>{' '}
                page and refresh the network view.
              </p>
            </div>
          ) : (
            <>
              {!isLoadingChargers &&
              formValues.stationId &&
              chargers.length === 0 ? (
                <div className="message-banner" role="status">
                  <span className="message-banner__title">No Available Charger</span>
                  <span>
                    No charger at this station matches your current selection.{' '}
                    <Link className="text-link" to="/stations">
                      Station Bulucu
                    </Link>{' '}
                    page to select a different station or filter.
                  </span>
                </div>
              ) : null}

              <ReservationForm
                chargers={chargers}
                formValues={formValues}
                isCreating={isCreating}
                isLoadingChargers={isLoadingChargers}
                isReady={isReadyForSubmission}
                isValidating={isValidating}
                onChange={handleChange}
                onCreate={handleCreate}
                onValidate={handleValidate}
                selectedChargerAvailabilityWarning={selectedSlotAvailabilityWarning}
                selectedStationOperatingHours={selectedStation?.operatingHours ?? null}
                selectedStationName={
                  formValues.stationId === prefilledStationId
                    ? prefilledStationName
                    : null
                }
                stations={stations}
                vehicles={vehicles}
              />
            </>
          )}
        </section>

        <div className="page-stack">
          <section className="card selection-summary">
            <div className="section-heading">
              <div>
                <h2>Selection Summary</h2>
                <p>Review the current reservation context in a compact view.</p>
              </div>
              {prefilledStationName && formValues.stationId === prefilledStationId ? (
                <span className="status-pill status-pill--completed">Ready</span>
              ) : null}
            </div>

            <div className="selection-summary__grid">
              <article className="selection-summary__metric">
                <span>Vehicle</span>
                <strong>
                  {selectedVehicle
                    ? `${selectedVehicle.brand} ${selectedVehicle.model}`
                    : 'Not selected'}
                </strong>
                <p>{selectedVehicle?.plateNumber ?? 'Select an EV profile.'}</p>
              </article>
              <article className="selection-summary__metric">
                <span>Station</span>
                <strong>{selectedStation?.name ?? 'Not selected'}</strong>
                <p>
                  {selectedStation
                    ? `${selectedStation.address} · ${selectedStation.operatingHours}`
                    : 'Select a charging location.'}
                </p>
              </article>
              <article className="selection-summary__metric">
                <span>Selected Charger</span>
                <strong>{selectedCharger?.label ?? 'Not selected'}</strong>
                <p>
                  {selectedCharger
                    ? `${selectedCharger.connectorType} · ${formatNumber(selectedCharger.powerOutputKW)} kW${selectedCharger.availabilityReason ? ` · ${formatAvailabilityReason(selectedCharger.availabilityReason)}` : ''}`
                    : 'Select a charger from the station.'}
                </p>
              </article>
              <article className="selection-summary__metric">
                <span>Time Window</span>
                <strong>{formatReservationWindow(formValues.startTime, formValues.endTime)}</strong>
                <p>Review your planned charging schedule.</p>
              </article>
            </div>
          </section>

          <ReservationValidationPanel
            fallbackErrors={validationFeedbackErrors}
            result={validationResult}
            selectedCharger={selectedCharger}
            selectedVehicle={selectedVehicle}
          />

          {createdReservation ? <RoutePanel reservation={createdReservation} /> : null}
        </div>
      </div>
    </section>
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatReservationWindow(startTime: string, endTime: string): string {
  if (!startTime || !endTime) {
    return 'Select start and end times';
  }

  return `${formatDateTimeValue(startTime)} → ${formatDateTimeValue(endTime)}`;
}

function formatDateTimeValue(value: string): string {
  return value.replace('T', ' ');
}

function buildReservationPayload(
  formValues: ReservationFormValues,
): ReservationRequestPayload {
  return {
    vehicleId: formValues.vehicleId,
    chargerId: formValues.chargerId,
    startTime: new Date(formValues.startTime).toISOString(),
    endTime: new Date(formValues.endTime).toISOString(),
  };
}

function createInitialDateWindow(
  prefilledStartTime?: string | null,
  prefilledEndTime?: string | null,
): Pick<
  ReservationFormValues,
  'endTime' | 'startTime'
> {
  if (
    prefilledStartTime &&
    prefilledEndTime &&
    isValidDateInput(prefilledStartTime) &&
    isValidDateInput(prefilledEndTime)
  ) {
    return {
      startTime: toDateTimeInputValue(new Date(prefilledStartTime)),
      endTime: toDateTimeInputValue(new Date(prefilledEndTime)),
    };
  }

  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);

  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    startTime: toDateTimeInputValue(start),
    endTime: toDateTimeInputValue(end),
  };
}

function toDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function isValidDateInput(value: string): boolean {
  const parsedDate = new Date(value);

  return !Number.isNaN(parsedDate.getTime());
}
