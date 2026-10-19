import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import { useToast } from '../../shared/components/ToastProvider';
import { clearToken } from '../../shared/utils/authToken';
import {
  formatChargingSessionStatusLabel,
  formatReservationStatusLabel,
} from '../../shared/utils/labels';
import { extractTranslatedApiMessages } from '../../shared/utils/messages';
import {
  completeChargingSession,
  getActiveChargingSession,
  startChargingSession,
  type ChargingSessionSummaryResponse,
} from '../api/chargingSessionsApi';
import { ChargingSessionCompletionForm, type ChargingSessionFormValues } from '../components/ChargingSessionCompletionForm';
import {
  getMyReservations,
  type ReservationDetailsResponse,
} from '../../reservations/api/reservationsApi';

const initialCompletionValues: ChargingSessionFormValues = {
  startEnergyKWh: '',
  endEnergyKWh: '',
};

const SESSION_STORAGE_KEY = 'chargingSessionEstimate';

const initialSessionPlanningValues = {
  startEnergyKWh: '',
  targetEndEnergyKWh: '',
};

function loadPersistedEstimate(): {
  effectiveChargingRateKWhPerHour: number;
  estimatedCost: number;
  estimatedDurationMinutes: number;
  remainingReservationMinutes: number;
  reservationId: string;
  requiredEnergyKWh: number;
  targetEndEnergyKWh: number;
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReturnType<typeof loadPersistedEstimate>) : null;
  } catch {
    return null;
  }
}

function savePersistedEstimate(
  value: {
    effectiveChargingRateKWhPerHour: number;
    estimatedCost: number;
    estimatedDurationMinutes: number;
    remainingReservationMinutes: number;
    reservationId: string;
    requiredEnergyKWh: number;
    targetEndEnergyKWh: number;
  } | null,
): void {
  try {
    if (value === null) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    // sessionStorage erişilemezse sessizce geç
  }
}

const CHARGING_EFFICIENCY = 0.9;

interface SessionPlanningValues {
  startEnergyKWh: string;
  targetEndEnergyKWh: string;
}

interface ChargingEstimatePreview {
  status: 'invalid' | 'pending' | 'ready';
  effectiveChargingRateKWhPerHour: number | null;
  estimatedCost: number | null;
  estimatedDurationMinutes: number | null;
  remainingReservationMinutes: number | null;
  requiredEnergyKWh: number | null;
  targetEndEnergyKWh: number | null;
  warning: string | null;
}

export function ChargingSessionsPage(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const preferredReservationId = searchParams.get('reservationId');
  const [reservations, setReservations] = useState<ReservationDetailsResponse[]>([]);
  const [activeSession, setActiveSession] =
    useState<ChargingSessionSummaryResponse | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [completionValues, setCompletionValues] =
    useState<ChargingSessionFormValues>(initialCompletionValues);
  const [reservationToStart, setReservationToStart] =
    useState<ReservationDetailsResponse | null>(null);
  const [sessionPlanningValues, setSessionPlanningValues] =
    useState<SessionPlanningValues>(initialSessionPlanningValues);
  const [latestSessionEstimate, setLatestSessionEstimate] = useState<{
    effectiveChargingRateKWhPerHour: number;
    estimatedCost: number;
    estimatedDurationMinutes: number;
    remainingReservationMinutes: number;
    reservationId: string;
    requiredEnergyKWh: number;
    targetEndEnergyKWh: number;
  } | null>(loadPersistedEstimate);
  const [hasAutoCompleted, setHasAutoCompleted] = useState(false);
  const [autoCompleteFailed, setAutoCompleteFailed] = useState(false);
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [isStartingReservationId, setIsStartingReservationId] =
    useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [generalErrors, setGeneralErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadSessionWorkspace();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const confirmedReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.status === 'CONFIRMED')
        .sort((leftReservation, rightReservation) => {
          if (leftReservation.id === preferredReservationId) {
            return -1;
          }

          if (rightReservation.id === preferredReservationId) {
            return 1;
          }

          return (
            new Date(leftReservation.startTime).getTime() -
            new Date(rightReservation.startTime).getTime()
          );
        }),
    [preferredReservationId, reservations],
  );
  const activeReservation = useMemo(
    () =>
      activeSession
        ? reservations.find(
            (reservation) => reservation.id === activeSession.reservationId,
          ) ?? null
        : null,
    [activeSession, reservations],
  );
  const preferredReservation = useMemo(
    () =>
      preferredReservationId
        ? confirmedReservations.find(
            (reservation) => reservation.id === preferredReservationId,
          ) ?? null
        : null,
    [confirmedReservations, preferredReservationId],
  );
  const completionPreview = useMemo(
    () =>
      buildCompletionPreview(
        completionValues,
        activeSession?.pricePerKWh ?? 0,
      ),
    [activeSession?.pricePerKWh, completionValues],
  );
  const activeSessionEstimate =
    activeSession && latestSessionEstimate?.reservationId === activeSession.reservationId
      ? latestSessionEstimate
      : null;
  const reservationToStartWindowState = reservationToStart
    ? getReservationWindowState(reservationToStart, currentTime)
    : null;
  const sessionPlanningEstimate = useMemo(
    () =>
      reservationToStart
        ? buildChargingEstimate(
            reservationToStart,
            sessionPlanningValues,
            currentTime,
          )
        : null,
    [currentTime, reservationToStart, sessionPlanningValues],
  );
  const activeReservationWindowState = activeReservation
    ? getReservationWindowState(activeReservation, currentTime)
    : null;
  const activeRemainingReservationMinutes = activeReservation
    ? getRemainingReservationMinutes(activeReservation, currentTime)
    : null;

  const simulatedStartEnergyKWh = activeSessionEstimate
    ? activeSessionEstimate.targetEndEnergyKWh - activeSessionEstimate.requiredEnergyKWh
    : null;

  const currentSimulatedEnergyKWh = useMemo(() => {
    if (!activeSessionEstimate || !activeSession || simulatedStartEnergyKWh === null) return null;
    const elapsedHours =
      (currentTime.getTime() - new Date(activeSession.createdAt).getTime()) / 3_600_000;
    const charged = activeSessionEstimate.effectiveChargingRateKWhPerHour * elapsedHours;
    return parseFloat(
      Math.min(activeSessionEstimate.targetEndEnergyKWh, simulatedStartEnergyKWh + charged).toFixed(2),
    );
  }, [activeSession, activeSessionEstimate, currentTime, simulatedStartEnergyKWh]);

  const chargingProgressPercent = useMemo(() => {
    if (
      !activeSessionEstimate ||
      currentSimulatedEnergyKWh === null ||
      simulatedStartEnergyKWh === null ||
      activeSessionEstimate.requiredEnergyKWh <= 0
    ) {
      return 0;
    }
    const raw =
      ((currentSimulatedEnergyKWh - simulatedStartEnergyKWh) /
        activeSessionEstimate.requiredEnergyKWh) *
      100;
    return parseFloat(Math.min(100, Math.max(0, raw)).toFixed(1));
  }, [activeSessionEstimate, currentSimulatedEnergyKWh, simulatedStartEnergyKWh]);

  const isChargingComplete = Boolean(
    activeSessionEstimate &&
      currentSimulatedEnergyKWh !== null &&
      currentSimulatedEnergyKWh >= activeSessionEstimate.targetEndEnergyKWh,
  );

  const remainingSimulatedMinutes = useMemo(() => {
    if (!activeSessionEstimate || isChargingComplete || currentSimulatedEnergyKWh === null) {
      return null;
    }
    const remainingKWh = activeSessionEstimate.targetEndEnergyKWh - currentSimulatedEnergyKWh;
    return Math.max(
      0,
      Math.ceil((remainingKWh / activeSessionEstimate.effectiveChargingRateKWhPerHour) * 60),
    );
  }, [activeSessionEstimate, currentSimulatedEnergyKWh, isChargingComplete]);

  useEffect(() => {
    if (!isChargingComplete || hasAutoCompleted || autoCompleteFailed || isCompleting) return;
    if (!activeSession || !activeSessionEstimate) return;
    setHasAutoCompleted(true);
    const timeoutId = window.setTimeout(() => {
      void handleAutoCompleteSession();
    }, 1_500);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChargingComplete]);

  async function loadSessionWorkspace(): Promise<void> {
    setIsLoadingReservations(true);
    setGeneralErrors([]);

    try {
      const [reservationList, activeSessionResponse] = await Promise.all([
        getMyReservations(),
        getActiveChargingSession(),
      ]);
      setReservations(reservationList);
      setActiveSession(activeSessionResponse);
      if (!activeSessionResponse) {
        savePersistedEstimate(null);
        setLatestSessionEstimate(null);
        setHasAutoCompleted(false);
        setAutoCompleteFailed(false);
      }
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(['Confirmed reservations cannot be retrieved at this time.']);
    } finally {
      setIsLoadingReservations(false);
    }
  }

  async function handleStartSession(
    reservationId: string,
    estimate?: ChargingEstimatePreview | null,
  ): Promise<void> {
    setIsStartingReservationId(reservationId);
    setGeneralErrors([]);
    setSuccessMessage(null);

    try {
      const session = await startChargingSession({ reservationId });
      setActiveSession(session);
      setCompletionValues({
        endEnergyKWh: '',
        startEnergyKWh: sessionPlanningValues.startEnergyKWh,
      });
      const nextEstimate =
        estimate?.status === 'ready' && estimate.effectiveChargingRateKWhPerHour !== null
          ? {
              effectiveChargingRateKWhPerHour:
                estimate.effectiveChargingRateKWhPerHour,
              estimatedCost: estimate.estimatedCost ?? 0,
              estimatedDurationMinutes: estimate.estimatedDurationMinutes ?? 0,
              remainingReservationMinutes: estimate.remainingReservationMinutes ?? 0,
              reservationId,
              requiredEnergyKWh: estimate.requiredEnergyKWh ?? 0,
              targetEndEnergyKWh: estimate.targetEndEnergyKWh ?? 0,
            }
          : null;
      setLatestSessionEstimate(nextEstimate);
      savePersistedEstimate(nextEstimate);
      setReservationToStart(null);
      setSessionPlanningValues(initialSessionPlanningValues);
      setSuccessMessage('Charging session started successfully.');
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(
        extractTranslatedApiMessages(error, 'Charging session cannot be started at this time.'),
      );
    } finally {
      setIsStartingReservationId(null);
    }
  }

  async function handleAutoCompleteSession(): Promise<void> {
    if (!activeSession || !activeSessionEstimate || simulatedStartEnergyKWh === null) return;

    const startEnergyKWh = simulatedStartEnergyKWh;
    const endEnergyKWh = activeSessionEstimate.targetEndEnergyKWh;

    setIsCompleting(true);
    setGeneralErrors([]);
    setSuccessMessage(null);

    try {
      const completedSession = await completeChargingSession(activeSession.id, {
        startEnergyKWh,
        endEnergyKWh,
      });
      setActiveSession(completedSession);
      showToast({
        message: `Şarj tamamlandı. Target energy: ${formatNumber(endEnergyKWh)} kWh · Toplam tutar: ${formatNumber(completedSession.totalCost ?? 0)} TL.`,
        tone: 'success',
      });
      await loadSessionWorkspace();
      navigate(`/charging-sessions/${completedSession.id}/summary`);
    } catch (error) {
      handleAuthError(error);
      setHasAutoCompleted(false);
      setAutoCompleteFailed(true);
      setGeneralErrors(
        extractTranslatedApiMessages(
          error,
          'Auto-complete failed. Please enter meter readings manually.',
        ),
      );
    } finally {
      setIsCompleting(false);
    }
  }

  function handleCompletionInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const { name, value } = event.target;

    setCompletionValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
    setGeneralErrors([]);
    setSuccessMessage(null);
  }

  function openStartSessionDialog(reservation: ReservationDetailsResponse): void {
    setReservationToStart(reservation);
    setSessionPlanningValues({
      startEnergyKWh: '',
      targetEndEnergyKWh: formatInputNumber(reservation.vehicle.batteryCapacityKWh),
    });
    setGeneralErrors([]);
  }

  function handlePlanningInputChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const { name, value } = event.target;

    setSessionPlanningValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  async function handleCompleteSession(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!activeSession) {
      setGeneralErrors(['Start a charging session before completing.']);
      return;
    }

    setIsCompleting(true);
    setGeneralErrors([]);
    setSuccessMessage(null);

    try {
      const completedSession = await completeChargingSession(activeSession.id, {
        startEnergyKWh: Number(completionValues.startEnergyKWh),
        endEnergyKWh: Number(completionValues.endEnergyKWh),
      });

      setActiveSession(completedSession);
      setSuccessMessage('Charging session completed successfully.');
      showToast({
        message: `Şarj oturumu tamamlandı. Toplam tutar: ${formatNumber(
          completedSession.totalCost ?? 0,
        )} TL.`,
        tone: 'success',
      });
      await loadSessionWorkspace();
      navigate(`/charging-sessions/${completedSession.id}/summary`);
    } catch (error) {
      handleAuthError(error);
      setGeneralErrors(
        extractTranslatedApiMessages(error, 'Charging session cannot be completed at this time.'),
      );
    } finally {
      setIsCompleting(false);
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
            <Link className="secondary-button secondary-button--link" to="/reservations">
              View Reservations
            </Link>
            <Link className="secondary-button secondary-button--link" to="/history">
              Open Session History
            </Link>
          </>
        }
        badge="Live charging operations"
        description="Start a confirmed reservation, record energy values, and complete the charging session summary."
        eyebrow="Charging Operations"
        metrics={[
          {
            label: 'Confirmed',
            value: isLoadingReservations ? 'Loading' : String(confirmedReservations.length),
            hint: 'Reservations ready to start',
          },
          {
            label: 'Session',
            value: activeSession ? toStatusLabel(activeSession.status) : 'Idle',
            hint: activeSession?.charger?.label ?? 'No active session',
          },
          {
            label: 'Completion Preview',
            value:
              completionPreview.totalCost !== null
                ? `${formatNumber(completionPreview.totalCost)} TL`
                : 'Pending',
            hint: 'Calculated from final meter readings',
          },
        ]}
        title="Active Charging Session"
      />

      <div className="card">
        <div className="helper-card helper-card--split">
          <div>
            <span className="helper-card__eyebrow">Charging Cost Formula</span>
            <h2>Consumed kWh × unit price = total amount</h2>
            <p>Use final meter readings to maintain cost visibility throughout the session.</p>
            <div className="helper-card__specs">
              <span className="helper-chip">Energy difference between meter readings</span>
              <span className="helper-chip">Selected charger rate</span>
              <span className="helper-chip">Backend total amount</span>
            </div>
          </div>
          <Link className="secondary-button secondary-button--link" to="/reservations">
            Back to Reservations
          </Link>
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

      {preferredReservation && !activeSession ? (
        <div className="message-banner message-banner--success" role="status">
          <span className="message-banner__title">Confirmed Reservation</span>
          <span>
            {preferredReservation.station?.name ?? 'the selected station'}: a confirmed reservation is selected. Start the charging session from the card below.
          </span>
        </div>
      ) : null}

      {preferredReservationId && !preferredReservation && !activeSession ? (
        <div className="message-banner" role="status">
          <span className="message-banner__title">Reservation Status</span>
          <span>
            The selected reservation is no longer eligible to start charging. Choose a current confirmed reservation or{' '}
            <Link className="text-link" to="/reservations">
              reservation list
            </Link>{' '}
            dönün.
          </span>
        </div>
      ) : null}

      <div className="page-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Confirmed Reservationlar</h2>
              <p>Select a confirmed reservation to start a live charging session.</p>
            </div>
          </div>

          {isLoadingReservations ? (
            <div
              aria-live="polite"
              className="session-empty-state session-empty-state--loading"
              role="status"
            >
              <span className="session-empty-state__eyebrow">Loading</span>
              <strong>Preparing confirmed reservations</strong>
              <p>Loading reservation records for session start.</p>
            </div>
          ) : confirmedReservations.length === 0 ? (
            <div className="session-empty-state">
              <span className="session-empty-state__eyebrow">No Reservations</span>
              <strong>No confirmed reservations ready to start</strong>
              <p>
                To create a new record, open the{' '}
                <Link className="text-link" to="/reservations/new">
                  reservation form
                </Link>{' '}
                açın.
              </p>
            </div>
          ) : (
            <div className="stack-list">
              {confirmedReservations.map((reservation) => (
                <article
                  className={
                    reservation.id === preferredReservationId
                      ? 'reservation-item reservation-launch-card reservation-launch-card--selected'
                      : 'reservation-item reservation-launch-card'
                  }
                  key={reservation.id}
                >
                  <div className="reservation-item__header">
                    <div>
                      <h3>{reservation.station?.name ?? 'Station info unavailable'}</h3>
                      <p>
                        {(reservation.charger?.label ?? 'Charger info unavailable')} · {reservation.charger?.connectorType ?? 'Connector info unavailable'}
                      </p>
                    </div>
                    <div className="reservation-card__status">
                      {reservation.id === preferredReservationId ? (
                        <span className="station-list-item__focus">Selected reservation</span>
                      ) : null}
                      <span className="status-pill status-pill--confirmed">
                        {toStatusLabel(reservation.status)}
                      </span>
                    </div>
                  </div>

                  <div className="reservation-launch-card__grid">
                    <article className="reservation-launch-card__metric">
                      <span>Start</span>
                      <strong>{formatDateTime(reservation.startTime)}</strong>
                    </article>
                    <article className="reservation-launch-card__metric">
                      <span>End</span>
                      <strong>{formatDateTime(reservation.endTime)}</strong>
                    </article>
                    <article className="reservation-launch-card__metric">
                      <span>Station</span>
                      <strong>{reservation.station?.address ?? 'Address info unavailable'}</strong>
                    </article>
                    <article className="reservation-launch-card__metric">
                      <span>Rate</span>
                      <strong>
                        {typeof reservation.charger?.pricePerKWh === 'number'
                          ? `${formatNumber(reservation.charger.pricePerKWh)} TL/kWh`
                          : 'Rate info unavailable'}
                      </strong>
                    </article>
                    <article className="reservation-launch-card__metric">
                      <span>Time Status</span>
                      <strong>{formatReservationWindowStateLabel(getReservationWindowState(reservation, currentTime))}</strong>
                      <p>{formatReservationWindowStateHint(reservation, currentTime)}</p>
                    </article>
                  </div>

                  <div className="reservation-item__actions">
                    <button
                      className="primary-button primary-button--auto"
                      disabled={
                        isStartActionDisabled(
                          reservation,
                          currentTime,
                          activeSession,
                          isStartingReservationId,
                        )
                      }
                      onClick={() => openStartSessionDialog(reservation)}
                      type="button"
                    >
                      {resolveStartActionLabel(
                        reservation,
                        currentTime,
                        activeSession,
                        isStartingReservationId,
                        reservation.id,
                      )}
                    </button>
                    {reservation.station?.id ? (
                      <Link
                        className="secondary-button secondary-button--link"
                        to={`/route/${reservation.station.id}`}
                      >
                        Route Navigation
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="page-stack">
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Active Session</h2>
                <p>Monitor the live session context and complete with meter readings.</p>
              </div>
            </div>

            {!activeSession ? (
              <div className="session-empty-state">
                <span className="session-empty-state__eyebrow">Pending</span>
                <strong>No active charging session yet</strong>
                <p>Start one of your confirmed reservations to open the live operations panel.</p>
              </div>
            ) : (
              <>
                <div className="session-live-banner">
                  <div>
                    <span className="session-live-banner__eyebrow">Live Session</span>
                    <strong>{activeSession.station?.name ?? 'Station info unavailable'}</strong>
                    <p>
                      {(activeSession.charger?.label ?? 'Charger info unavailable')} · {activeSession.station?.address ?? 'Address info unavailable'}
                    </p>
                    <p>Start: {formatDateTime(activeSession.createdAt)}</p>
                  </div>
                  <span className="status-pill status-pill--live">
                    {toStatusLabel(activeSession.status)}
                  </span>
                </div>

                <div className="session-operations-grid">
                  <article className="session-operations-card">
                    <span>Reservation Duration</span>
                    <strong>{formatReservationDuration(activeReservation)}</strong>
                    <p>Calculated from the linked reservation time window.</p>
                  </article>
                  <article className="session-operations-card">
                    <span>Remaining Reservation Time</span>
                    <strong>
                      {activeRemainingReservationMinutes !== null
                        ? formatMinutesDuration(activeRemainingReservationMinutes)
                        : 'Unavailable'}
                    </strong>
                    <p>Time between current time and reservation end.</p>
                  </article>
                  <article className="session-operations-card">
                    <span>Unit Price</span>
                    <strong>{formatNumber(activeSession.pricePerKWh)} TL/kWh</strong>
                    <p>Defined rate returned by the backend.</p>
                  </article>
                  {activeSessionEstimate ? (
                    <>
                      <article className="session-operations-card">
                        <span>Effective Charging Rate</span>
                        <strong>
                          {formatNumber(activeSessionEstimate.effectiveChargingRateKWhPerHour)} kW
                        </strong>
                        <p>Charger power and vehicle limit evaluated together.</p>
                      </article>
                      <article className="session-operations-card">
                        <span>Estimated Charging Duration</span>
                        <strong>
                          {formatMinutesDuration(activeSessionEstimate.estimatedDurationMinutes)}
                        </strong>
                        <p>Calculated from start and target energy values.</p>
                      </article>
                      <article className="session-operations-card">
                        <span>Estimated Consumption</span>
                        <strong>{formatNumber(activeSessionEstimate.requiredEnergyKWh)} kWh</strong>
                        <p>
                          Target energy: {formatNumber(activeSessionEstimate.targetEndEnergyKWh)} kWh
                        </p>
                      </article>
                      <article className="session-operations-card">
                        <span>Estimated Cost</span>
                        <strong>{formatNumber(activeSessionEstimate.estimatedCost)} TL</strong>
                        <p>
                          Remaining reservation time:{' '}
                          {formatMinutesDuration(activeSessionEstimate.remainingReservationMinutes)}
                        </p>
                      </article>
                    </>
                  ) : null}
                  <article className="session-operations-card">
                    <span>Charger</span>
                    <strong>{activeSession.charger?.label ?? 'Charger info unavailable'}</strong>
                    <p>
                      {activeSession.charger?.connectorType ?? 'Connector info unavailable'} ·{' '}
                      {typeof activeSession.charger?.powerOutputKW === 'number'
                        ? `${formatNumber(activeSession.charger.powerOutputKW)} kW`
                        : 'Power info unavailable'}
                    </p>
                  </article>
                  <article className="session-operations-card">
                    <span>Station</span>
                    <strong>{activeSession.station?.name ?? 'Station info unavailable'}</strong>
                    <p>{activeSession.station?.address ?? 'Address info unavailable'}</p>
                  </article>
                </div>

                <div className="session-form-shell">
                  {activeReservationWindowState === 'expired' ? (
                    <div className="message-banner" role="status">
                      <span className="message-banner__title">Reservation Duration Sona Erdi</span>
                      <span>
                        Reservation expired. Enter meter readings to complete the session and proceed to payment.
                      </span>
                    </div>
                  ) : null}

                  {activeSessionEstimate && !autoCompleteFailed ? (
                    <div className="form-stack">
                      <section className="form-section">
                        <div className="form-section__header">
                          <span className="form-section__eyebrow">Charging Progress</span>
                          <h3>Current charging status</h3>
                          <p>
                            {isChargingComplete
                              ? 'Target energy reached. Completing session...'
                              : 'Session will auto-complete when the energy target is reached.'}
                          </p>
                        </div>

                        <div className="payment-breakdown-grid">
                          <article className="payment-breakdown-card">
                            <span>Current Energy</span>
                            <strong>
                              {currentSimulatedEnergyKWh !== null
                                ? `${formatNumber(currentSimulatedEnergyKWh)} kWh`
                                : '—'}
                            </strong>
                          </article>
                          <article className="payment-breakdown-card">
                            <span>Target Energy</span>
                            <strong>
                              {formatNumber(activeSessionEstimate.targetEndEnergyKWh)} kWh
                            </strong>
                          </article>
                          <article className="payment-breakdown-card">
                            <span>Progress</span>
                            <strong>{formatNumber(chargingProgressPercent)}%</strong>
                          </article>
                          <article className="payment-breakdown-card">
                            <span>Estimated Time Remaining</span>
                            <strong>
                              {isChargingComplete
                                ? 'Completed'
                                : remainingSimulatedMinutes !== null
                                  ? formatMinutesDuration(remainingSimulatedMinutes)
                                  : '—'}
                            </strong>
                          </article>
                        </div>

                        <div
                          style={{
                            height: '8px',
                            background: 'var(--border, #e2e8f0)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            margin: '0.25rem 0',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${chargingProgressPercent}%`,
                              background: isChargingComplete
                                ? '#22c55e'
                                : 'var(--primary, #3b82f6)',
                              borderRadius: '4px',
                              transition: 'width 0.8s ease',
                            }}
                          />
                        </div>
                      </section>

                      {isChargingComplete || hasAutoCompleted ? (
                        <div className="message-banner message-banner--success" role="status">
                          <span className="message-banner__title">Target Energyye Ulaşıldı</span>
                          <span>
                            {formatNumber(activeSessionEstimate.targetEndEnergyKWh)} kWh hedefine ulaşıldı.
                            Session tamamlanıyor...
                          </span>
                        </div>
                      ) : (
                        <div className="message-banner" role="status">
                          <span className="message-banner__title">Charging in Progress</span>
                          <span>
                            {formatNumber(activeSessionEstimate.targetEndEnergyKWh)} kWh hedefine
                            ulaşıldığında oturum otomatik tamamlanacak.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {!activeSessionEstimate ? (
                        <div className="message-banner" role="status">
                          <span className="message-banner__title">Estimated Duration</span>
                          <span>
                            Tahmini şarj süresi ve maliyetini görmek için oturumu başlatırken
                            başlangıç ve hedef enerji bilgilerini girin.
                          </span>
                        </div>
                      ) : null}
                      {autoCompleteFailed ? (
                        <div className="message-banner message-banner--error" role="alert">
                          <span className="message-banner__title">Auto-complete Failed</span>
                          <span>Please enter meter readings manually to complete the session.</span>
                        </div>
                      ) : null}
                      <ChargingSessionCompletionForm
                        formValues={completionValues}
                        isSubmitting={isCompleting}
                        onChange={handleCompletionInputChange}
                        onSubmit={handleCompleteSession}
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {reservationToStart ? (
        <div
          aria-modal="true"
          className="dialog-backdrop"
          role="dialog"
        >
          <div className="dialog-panel">
            <div className="dialog-panel__content">
              <span className="dialog-panel__eyebrow">Session Start Preparation</span>
              <h2>Review session start preparation details</h2>
              <p>
                Start and target energy values are used for estimated duration and power visibility.
              </p>
            </div>

            <div className="two-column-grid">
              <label className="field-group" htmlFor="sessionStartEnergyKWh">
                <span className="field-label">Start Energy (kWh)</span>
                <input
                  className="text-input"
                  id="sessionStartEnergyKWh"
                  inputMode="decimal"
                  min="0"
                  name="startEnergyKWh"
                  onChange={handlePlanningInputChange}
                  step="0.1"
                  type="number"
                  value={sessionPlanningValues.startEnergyKWh}
                />
              </label>

              <label className="field-group" htmlFor="sessionTargetEndEnergyKWh">
                <span className="field-label">Target Energy (kWh)</span>
                <input
                  className="text-input"
                  id="sessionTargetEndEnergyKWh"
                  inputMode="decimal"
                  min="0"
                  name="targetEndEnergyKWh"
                  onChange={handlePlanningInputChange}
                  step="0.1"
                  type="number"
                  value={sessionPlanningValues.targetEndEnergyKWh}
                />
              </label>
            </div>

            <div className="payment-breakdown-grid">
              <article className="payment-breakdown-card">
                <span>Effective Charging Rate</span>
                <strong>
                  {sessionPlanningEstimate?.effectiveChargingRateKWhPerHour !== null &&
                  sessionPlanningEstimate?.effectiveChargingRateKWhPerHour !== undefined
                    ? `${formatNumber(sessionPlanningEstimate.effectiveChargingRateKWhPerHour)} kW`
                    : 'Pending'}
                </strong>
              </article>
              <article className="payment-breakdown-card">
                <span>Estimated Charging Duration</span>
                <strong>
                  {sessionPlanningEstimate?.estimatedDurationMinutes !== null &&
                  sessionPlanningEstimate?.estimatedDurationMinutes !== undefined
                    ? formatMinutesDuration(sessionPlanningEstimate.estimatedDurationMinutes)
                    : 'Pending'}
                </strong>
              </article>
              <article className="payment-breakdown-card">
                <span>Remaining Reservation Time</span>
                <strong>
                  {sessionPlanningEstimate?.remainingReservationMinutes !== null &&
                  sessionPlanningEstimate?.remainingReservationMinutes !== undefined
                    ? formatMinutesDuration(sessionPlanningEstimate.remainingReservationMinutes)
                    : 'Pending'}
                </strong>
              </article>
              <article className="payment-breakdown-card">
                <span>Time Status</span>
                <strong>
                  {reservationToStartWindowState
                    ? formatReservationWindowStateLabel(reservationToStartWindowState)
                    : 'Pending'}
                </strong>
              </article>
            </div>

            {sessionPlanningEstimate?.warning ? (
              <div className="message-banner" role="status">
                <span className="message-banner__title">Duration Warning</span>
                <span>{sessionPlanningEstimate.warning}</span>
              </div>
            ) : null}

            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setReservationToStart(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={
                  isStartingReservationId === reservationToStart.id ||
                  Boolean(activeSession) ||
                  reservationToStartWindowState !== 'available'
                }
                onClick={() =>
                  void handleStartSession(
                    reservationToStart.id,
                    sessionPlanningEstimate,
                  )
                }
                type="button"
              >
                {isStartingReservationId === reservationToStart.id
                  ? 'Starting charge...'
                  : 'Start Charging'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildCompletionPreview(
  values: ChargingSessionFormValues,
  pricePerKWh: number,
): {
  consumedKWh: number | null;
  status: 'invalid' | 'pending' | 'ready';
  totalCost: number | null;
} {
  const startValue = Number(values.startEnergyKWh);
  const endValue = Number(values.endEnergyKWh);

  if (values.startEnergyKWh === '' || values.endEnergyKWh === '') {
    return {
      consumedKWh: null,
      status: 'pending',
      totalCost: null,
    };
  }

  if (
    Number.isNaN(startValue) ||
    Number.isNaN(endValue) ||
    endValue < startValue
  ) {
    return {
      consumedKWh: null,
      status: 'invalid',
      totalCost: null,
    };
  }

  const consumedKWh = endValue - startValue;

  return {
    consumedKWh,
    status: 'ready',
    totalCost: consumedKWh * pricePerKWh,
  };
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

function formatReservationDuration(
  reservation: ReservationDetailsResponse | null,
): string {
  if (!reservation) {
    return 'Unavailable';
  }

  const start = new Date(reservation.startTime).getTime();
  const end = new Date(reservation.endTime).getTime();
  const minutes = Math.max(0, Math.round((end - start) / 60000));

  return formatMinutesDuration(minutes);
}

function resolveStartActionLabel(
  reservation: ReservationDetailsResponse,
  currentTime: Date,
  activeSession: ChargingSessionSummaryResponse | null,
  isStartingReservationId: string | null,
  reservationId: string,
): string {
  const windowState = getReservationWindowState(reservation, currentTime);

  if (isStartingReservationId === reservationId) {
    return 'Starting session...';
  }

  if (windowState === 'waiting') {
    return 'Waiting for Start Time';
  }

  if (windowState === 'expired') {
    return 'Reservation Duration Doldu';
  }

  if (activeSession?.reservationId === reservationId) {
    return 'Session Active';
  }

  if (activeSession) {
    return 'Another Session Active';
  }

  return 'Start Charging';
}

function getReservationWindowState(
  reservation: ReservationDetailsResponse,
  currentTime: Date,
): 'available' | 'expired' | 'waiting' {
  const now = currentTime.getTime();
  const startTime = new Date(reservation.startTime).getTime();
  const endTime = new Date(reservation.endTime).getTime();

  if (now < startTime) {
    return 'waiting';
  }

  if (now >= endTime) {
    return 'expired';
  }

  return 'available';
}

function formatReservationWindowStateLabel(
  state: 'available' | 'expired' | 'waiting',
): string {
  switch (state) {
    case 'waiting':
      return 'Waiting for reservation start';
    case 'expired':
      return 'Reservation expired';
    case 'available':
    default:
      return 'Charging can start';
  }
}

function formatReservationWindowStateHint(
  reservation: ReservationDetailsResponse,
  currentTime: Date,
): string {
  const state = getReservationWindowState(reservation, currentTime);

  if (state === 'waiting') {
    const minutesUntilStart = Math.max(
      0,
      Math.ceil(
        (new Date(reservation.startTime).getTime() - currentTime.getTime()) /
          60000,
      ),
    );

    return `Şarj oturumu randevu saatinde başlatılabilir. Başlamasına kalan süre: ${formatMinutesDuration(minutesUntilStart)}.`;
  }

  if (state === 'expired') {
    return 'The start window for this reservation has expired.';
  }

  return 'Charging session can be started within this time window.';
}

function isStartActionDisabled(
  reservation: ReservationDetailsResponse,
  currentTime: Date,
  activeSession: ChargingSessionSummaryResponse | null,
  isStartingReservationId: string | null,
): boolean {
  if (isStartingReservationId === reservation.id) {
    return true;
  }

  if (activeSession) {
    return true;
  }

  return getReservationWindowState(reservation, currentTime) !== 'available';
}

function buildChargingEstimate(
  reservation: ReservationDetailsResponse,
  values: SessionPlanningValues,
  currentTime: Date,
): ChargingEstimatePreview {
  const remainingReservationMinutes = getRemainingReservationMinutes(
    reservation,
    currentTime,
  );

  if (values.startEnergyKWh === '' || values.targetEndEnergyKWh === '') {
    return {
      status: 'pending',
      effectiveChargingRateKWhPerHour: null,
      estimatedCost: null,
      estimatedDurationMinutes: null,
      remainingReservationMinutes,
      requiredEnergyKWh: null,
      targetEndEnergyKWh: null,
      warning: null,
    };
  }

  const startEnergyKWh = Number(values.startEnergyKWh);
  const targetEndEnergyKWh = Number(values.targetEndEnergyKWh);

  if (
    Number.isNaN(startEnergyKWh) ||
    Number.isNaN(targetEndEnergyKWh) ||
    startEnergyKWh < 0 ||
    targetEndEnergyKWh <= startEnergyKWh ||
    targetEndEnergyKWh > reservation.vehicle.batteryCapacityKWh
  ) {
    return {
      status: 'invalid',
      effectiveChargingRateKWhPerHour: null,
      estimatedCost: null,
      estimatedDurationMinutes: null,
      remainingReservationMinutes,
      requiredEnergyKWh: null,
      targetEndEnergyKWh: null,
      warning: null,
    };
  }

  const effectiveChargingRateKWhPerHour =
    Math.min(
      reservation.charger.powerOutputKW,
      reservation.vehicle.maxSupportedPowerKW,
    ) * CHARGING_EFFICIENCY;

  if (effectiveChargingRateKWhPerHour <= 0) {
    return {
      status: 'invalid',
      effectiveChargingRateKWhPerHour: null,
      estimatedCost: null,
      estimatedDurationMinutes: null,
      remainingReservationMinutes,
      requiredEnergyKWh: null,
      targetEndEnergyKWh: null,
      warning: null,
    };
  }

  const requiredEnergyKWh = targetEndEnergyKWh - startEnergyKWh;
  const estimatedDurationMinutes = Math.ceil(
    (requiredEnergyKWh / effectiveChargingRateKWhPerHour) * 60,
  );

  return {
    status: 'ready',
    effectiveChargingRateKWhPerHour,
    estimatedCost: requiredEnergyKWh * reservation.charger.pricePerKWh,
    estimatedDurationMinutes,
    remainingReservationMinutes,
    requiredEnergyKWh,
    targetEndEnergyKWh,
    warning:
      estimatedDurationMinutes > remainingReservationMinutes
        ? 'The target energy may not be reached within this reservation window.'
        : null,
  };
}

function getRemainingReservationMinutes(
  reservation: ReservationDetailsResponse,
  currentTime: Date,
): number {
  return Math.max(
    0,
    Math.ceil(
      (new Date(reservation.endTime).getTime() - currentTime.getTime()) / 60000,
    ),
  );
}

function formatMinutesDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} dk`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${hours} sa`
    : `${hours} sa ${remainingMinutes} dk`;
}

function formatInputNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function toStatusLabel(status: string): string {
  if (status === 'CONFIRMED') {
    return formatReservationStatusLabel(status);
  }

  return formatChargingSessionStatusLabel(status);
}
