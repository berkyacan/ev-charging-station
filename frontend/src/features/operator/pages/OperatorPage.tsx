import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import { useToast } from '../../shared/components/ToastProvider';
import { formatChargerStatusLabel } from '../../shared/utils/labels';
import {
  extractTranslatedApiMessages,
  translateUiMessage,
} from '../../shared/utils/messages';
import type {
  Charger,
  ChargerStatus,
  Station,
} from '../../shared/types';
import { clearToken } from '../../shared/utils/authToken';
import {
  getStationChargers,
  getStations,
} from '../../stations/api/stationsApi';
import {
  updateOperatorChargerStatus,
  updateOperatorChargerPricing,
  type OperatorChargerPricingUpdateResponse,
  type OperatorChargerStatusUpdateResponse,
} from '../api/operatorApi';

const chargerStatusOptions: ChargerStatus[] = ['AVAILABLE', 'OCCUPIED', 'OFFLINE'];

interface OperatorChargerListItem extends Charger {
  stationName: string;
  stationAddress: string;
}

export function OperatorPage(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [chargers, setChargers] = useState<OperatorChargerListItem[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, ChargerStatus>>({});
  const [isLoadingChargers, setIsLoadingChargers] = useState(true);
  const [isSavingChargerId, setIsSavingChargerId] = useState<string | null>(null);
  const [isSavingPriceChargerId, setIsSavingPriceChargerId] =
    useState<string | null>(null);
  const [chargerError, setChargerError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] =
    useState<OperatorChargerStatusUpdateResponse | null>(null);
  const [lastPricingUpdate, setLastPricingUpdate] =
    useState<OperatorChargerPricingUpdateResponse | null>(null);

  useEffect(() => {
    void loadChargerList();
  }, []);

  const groupedChargers = useMemo(() => {
    return chargers.reduce<Record<string, OperatorChargerListItem[]>>((groups, charger) => {
      if (!groups[charger.stationId]) {
        groups[charger.stationId] = [];
      }

      groups[charger.stationId].push(charger);
      return groups;
    }, {});
  }, [chargers]);
  const stationCount = Object.keys(groupedChargers).length;
  const availableChargerCount = chargers.filter(
    (charger) => charger.status === 'AVAILABLE',
  ).length;
  const occupiedChargerCount = chargers.filter(
    (charger) => charger.status === 'OCCUPIED',
  ).length;
  const offlineChargerCount = chargers.filter(
    (charger) => charger.status === 'OFFLINE',
  ).length;

  async function loadChargerList(): Promise<void> {
    setIsLoadingChargers(true);
    setChargerError(null);

    try {
      const stations = await getStations();
      const stationChargers = await Promise.all(
        stations.map((station) => loadStationChargers(station)),
      );

      const flattenedChargers = stationChargers.flat();
      setChargers(flattenedChargers);
      setStatusDrafts(
        flattenedChargers.reduce<Record<string, ChargerStatus>>((drafts, charger) => {
          drafts[charger.id] = charger.status;
          return drafts;
        }, {}),
      );
      setPriceDrafts(
        flattenedChargers.reduce<Record<string, string>>((drafts, charger) => {
          drafts[charger.id] = formatNumber(charger.pricePerKWh);
          return drafts;
        }, {}),
      );
    } catch (error) {
      if (handleAuthError(error)) {
        return;
      }

      setChargerError(resolveOperatorError(error, 'Charger records cannot be retrieved at this time.'));
    } finally {
      setIsLoadingChargers(false);
    }
  }

  async function loadStationChargers(
    station: Station,
  ): Promise<OperatorChargerListItem[]> {
    const response = await getStationChargers(station.id);

    return response.chargers.map((charger) => ({
      ...charger,
      stationName: station.name,
      stationAddress: station.address,
    }));
  }

  function handleStatusDraftChange(
    chargerId: string,
    event: ChangeEvent<HTMLSelectElement>,
  ): void {
    const nextStatus = event.target.value as ChargerStatus;

    setStatusDrafts((currentDrafts) => ({
      ...currentDrafts,
      [chargerId]: nextStatus,
    }));
  }

  async function handleSaveStatus(chargerId: string): Promise<void> {
    const selectedStatus = statusDrafts[chargerId];

    if (!selectedStatus) {
      return;
    }

    setIsSavingChargerId(chargerId);
    setChargerError(null);

    try {
      const response = await updateOperatorChargerStatus(chargerId, {
        status: selectedStatus,
      });

      setChargers((currentChargers) =>
        currentChargers.map((charger) =>
          charger.id === chargerId
            ? {
                ...charger,
                ...response.updatedCharger,
              }
            : charger,
        ),
      );
      setStatusDrafts((currentDrafts) => ({
        ...currentDrafts,
        [chargerId]: response.updatedCharger.status,
      }));
      setLastUpdate(response);
      setLastPricingUpdate(null);

      showToast({
        message:
          response.updatedCharger.status === 'OFFLINE'
            ? [
                `${response.updatedCharger.label} çevrim dışı olarak güncellendi.`,
                `Etkilenen randevu sayısı: ${response.cancelledReservationsCount}.`,
                response.cancelledReservationsCount > 0
                  ? 'Notifications created.'
                  : null,
                response.affectedActiveSessionCount > 0
                  ? `Aktif oturum sayısı: ${response.affectedActiveSessionCount}.`
                  : null,
              ]
                .filter(Boolean)
                .join(' ')
            : `${response.updatedCharger.label} durumu ${formatTokenLabel(response.updatedCharger.status)} olarak güncellendi.`,
        tone: 'success',
      });
    } catch (error) {
      if (handleAuthError(error)) {
        return;
      }

      setChargerError(
        resolveOperatorError(error, 'Charger status cannot be updated right now.'),
      );
    } finally {
      setIsSavingChargerId(null);
    }
  }

  function handlePriceDraftChange(
    chargerId: string,
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const nextPrice = event.target.value;

    setPriceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [chargerId]: nextPrice,
    }));
  }

  async function handleSavePrice(chargerId: string): Promise<void> {
    const parsedPrice = Number(priceDrafts[chargerId]);

    setIsSavingPriceChargerId(chargerId);
    setChargerError(null);

    try {
      const response = await updateOperatorChargerPricing(chargerId, {
        pricePerKWh: parsedPrice,
      });

      setChargers((currentChargers) =>
        currentChargers.map((charger) =>
          charger.id === chargerId
            ? {
                ...charger,
                ...response.updatedCharger,
              }
            : charger,
        ),
      );
      setPriceDrafts((currentDrafts) => ({
        ...currentDrafts,
        [chargerId]: formatNumber(response.updatedCharger.pricePerKWh),
      }));
      setLastPricingUpdate(response);
      showToast({
        message: 'Charging price updated.',
        tone: 'success',
      });
    } catch (error) {
      if (handleAuthError(error)) {
        return;
      }

      setChargerError(resolveOperatorError(error, 'Charging price cannot be updated right now.'));
    } finally {
      setIsSavingPriceChargerId(null);
    }
  }

  function handleAuthError(error: unknown): boolean {
    if (error instanceof ApiClientError && error.status === 401) {
      clearToken();
      navigate('/login', { replace: true });
      return true;
    }

    return false;
  }

  return (
    <section className="page-shell">
      <PageHero
        actions={
          <button
            className="secondary-button"
            onClick={() => void loadChargerList()}
            type="button"
          >
            Refresh Data
          </button>
        }
        badge="Station and device operations"
        description="Monitor charger status, update availability, and manage operation impact from one panel."
        eyebrow="Network Operations"
        metrics={[
          {
            label: 'Chargers',
            value: isLoadingChargers ? 'Loading' : String(chargers.length),
            hint: 'Total assets loaded',
          },
          {
            label: 'Available',
            value: String(availableChargerCount),
            hint: 'Ready for new reservations',
          },
          {
            label: 'Occupied',
            value: String(occupiedChargerCount),
            hint: 'Active use or blocked capacity',
          },
          {
            label: 'Offline',
            value: String(offlineChargerCount),
            hint: lastUpdate?.updatedCharger.label ?? 'Out of service tracking',
          },
        ]}
        title="Operator Panel"
      />

      <div className="insight-grid">
        <article className="insight-card">
          <span className="insight-card__label">Station / Device Status</span>
          <strong>{isLoadingChargers ? 'Loading' : String(stationCount)}</strong>
          <p>Station groups monitored on the operator panel.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Available</span>
          <strong>{String(availableChargerCount)}</strong>
          <p>Yeni randevular için uygun cihazlar.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Occupied / Offline</span>
          <strong>{String(occupiedChargerCount + offlineChargerCount)}</strong>
          <p>Capacity requiring operational tracking.</p>
        </article>
        <article className="insight-card">
          <span className="insight-card__label">Operation Impact</span>
          <strong>
            {lastUpdate
              ? String(lastUpdate.cancelledReservationsCount)
              : '0'}
          </strong>
          <p>Reservations affected since the last availability update.</p>
        </article>
      </div>

      <div className="page-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Station / Charger Status</h2>
              <p>Monitor charger inventory and live status information by station.</p>
            </div>
          </div>

          {chargerError ? (
            <div className="message-banner message-banner--error" role="alert">
              {chargerError}
            </div>
          ) : null}

          {isLoadingChargers ? (
            <div
              aria-live="polite"
              className="session-empty-state session-empty-state--loading"
              role="status"
            >
              <span className="session-empty-state__eyebrow">Loading</span>
              <strong>Loading operator inventory</strong>
              <p>Station and charger status records being transferred to the panel.</p>
            </div>
          ) : chargers.length === 0 ? (
            <div className="session-empty-state">
              <span className="session-empty-state__eyebrow">No Records</span>
              <strong>Operator inventory is currently empty</strong>
              <p>This area will be populated when station and charger data is available.</p>
            </div>
          ) : (
            <div className="stack-list">
              {Object.values(groupedChargers).map((stationChargers) => {
                const station = stationChargers[0];
                const availableCount = stationChargers.filter(
                  (charger) => charger.status === 'AVAILABLE',
                ).length;
                const occupiedCount = stationChargers.filter(
                  (charger) => charger.status === 'OCCUPIED',
                ).length;
                const offlineCount = stationChargers.filter(
                  (charger) => charger.status === 'OFFLINE',
                ).length;

                return (
                  <section
                    className="operator-station-group operator-station-group--panel"
                    key={station.stationId}
                  >
                    <div className="operator-station-group__header">
                      <div>
                        <h3>{station.stationName}</h3>
                        <p>{station.stationAddress}</p>
                      </div>
                      <div className="operator-station-group__meta">
                        <span className="helper-chip">{stationChargers.length} cihaz</span>
                        <span className="helper-chip">{availableCount} uygun</span>
                        <span className="helper-chip">{occupiedCount} dolu</span>
                        <span className="helper-chip">{offlineCount} çevrim dışı</span>
                      </div>
                    </div>

                    <div className="stack-list">
                      {stationChargers.map((charger) => (
                        <article className="reservation-item console-asset-card" key={charger.id}>
                          <div className="reservation-item__header">
                            <div>
                              <h3>{charger.label ?? `${charger.chargerType} ${charger.powerOutputKW} kW`}</h3>
                              <p>
                                {charger.chargerType} device · {charger.connectorType} connector ·{' '}
                                {formatNumber(charger.powerOutputKW)} kW ·{' '}
                                {formatNumber(charger.pricePerKWh)} TL/kWh
                              </p>
                            </div>
                            <span className={`status-pill ${toChargerStatusClass(charger.status)}`}>
                              {formatTokenLabel(charger.status)}
                            </span>
                          </div>

                          <div className="console-asset-card__grid">
                            <article className="console-asset-card__metric">
                              <span>Connector</span>
                              <strong>{charger.connectorType}</strong>
                            </article>
                            <article className="console-asset-card__metric">
                              <span>Power</span>
                              <strong>{formatNumber(charger.powerOutputKW)} kW</strong>
                            </article>
                            <article className="console-asset-card__metric">
                              <span>Rate</span>
                              <strong>{formatNumber(charger.pricePerKWh)} TL/kWh</strong>
                            </article>
                            <article className="console-asset-card__metric">
                              <span>Current Status</span>
                              <strong>{formatTokenLabel(charger.status)}</strong>
                            </article>
                          </div>

                          <div className="operator-status-row">
                            <label className="field-group operator-status-field">
                              <span className="field-label">New Status</span>
                              <select
                                className="text-input"
                                onChange={(event) =>
                                  handleStatusDraftChange(charger.id, event)
                                }
                                value={statusDrafts[charger.id] ?? charger.status}
                              >
                                {chargerStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {formatTokenLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <button
                              className="primary-button primary-button--auto"
                              disabled={
                                isSavingChargerId === charger.id ||
                                (statusDrafts[charger.id] ?? charger.status) === charger.status
                              }
                              onClick={() => void handleSaveStatus(charger.id)}
                              type="button"
                            >
                              {isSavingChargerId === charger.id ? 'Saving...' : 'Update Status'}
                            </button>
                          </div>

                          <div className="operator-status-row">
                            <label className="field-group operator-status-field">
                              <span className="field-label">kWh Price (TL/kWh)</span>
                              <input
                                className="text-input"
                                inputMode="decimal"
                                max="100"
                                min="0.1"
                                onChange={(event) =>
                                  handlePriceDraftChange(charger.id, event)
                                }
                                step="0.1"
                                type="number"
                                value={priceDrafts[charger.id] ?? formatNumber(charger.pricePerKWh)}
                              />
                            </label>

                            <button
                              className="secondary-button secondary-button--link"
                              disabled={
                                isSavingPriceChargerId === charger.id ||
                                (priceDrafts[charger.id] ?? formatNumber(charger.pricePerKWh)) ===
                                  formatNumber(charger.pricePerKWh)
                              }
                              onClick={() => void handleSavePrice(charger.id)}
                              type="button"
                            >
                              {isSavingPriceChargerId === charger.id
                                ? 'Updating price...'
                                : 'Update Price'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Charger Availability</h2>
              <p>Review availability definitions and the impact of operator operations on device status.</p>
            </div>
          </div>

          <div className="stack-list">
            <article className="helper-card">
              <span className="helper-card__eyebrow">Status Description</span>
              <h3>Availability Definitions</h3>
              <div className="helper-card__specs">
                <span className="status-pill status-pill--available">Available</span>
                <span className="status-pill status-pill--occupied">Occupied</span>
                <span className="status-pill status-pill--offline">Offline</span>
              </div>
              <p>Available status indicates capacity ready for new reservations and sessions. Occupied means active use or blocked capacity. Offline removes the device from service; affected reservations are managed by the backend.</p>
            </article>

            <article className="helper-card">
              <span className="helper-card__eyebrow">Control Behavior</span>
              <h3>Live status updates</h3>
              <p>Her cihaz kartındaki durum seçiciyi kullanarak Available, Occupied veya Offline durumlarını kaydedin. Güncellemeler backend uygunluk kuralları korunarak uygulanır.</p>
            </article>
          </div>
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Out of Service Management</h2>
              <p>Monitor the reservation impact of offline operations and manage capacity risk across the network.</p>
            </div>
          </div>

          {lastUpdate ? (
            <div className="message-banner message-banner--success" role="status">
              {lastUpdate.updatedCharger.label} charger{' '}
              {formatTokenLabel(lastUpdate.updatedCharger.status)} olarak
              updated. Affected reservations:{' '}
              {lastUpdate.cancelledReservationsCount}.{' '}
              {lastUpdate.cancelledReservationsCount > 0
                ? 'Notifications created.'
                : 'No reservations requiring notification.'}{' '}
              {lastUpdate.affectedActiveSessionCount > 0
                ? `Aktif oturum sayısı: ${lastUpdate.affectedActiveSessionCount}.`
                : null}
            </div>
          ) : null}

          {lastPricingUpdate ? (
            <div className="message-banner message-banner--success" role="status">
              {lastPricingUpdate.updatedCharger.label}: new price:{' '}
              {formatNumber(lastPricingUpdate.updatedCharger.pricePerKWh)} TL/kWh.
            </div>
          ) : null}

          <div className="stack-list">
            <article className="helper-card">
              <span className="helper-card__eyebrow">Service Impact</span>
              <h3>Offline operations are protected by the backend</h3>
              <p>Bir cihaz Offline olarak ayarlandığında bitiş zamanı henüz geçmemiş onaylı randevular değerlendirilir. Aktif oturumu olan kayıtlar otomatik iptal edilmez.</p>
              <div className="helper-card__specs">
                <span className="helper-chip">Affected reservations processed</span>
                <span className="helper-chip">Live availability sync</span>
                <span className="helper-chip">Operator visibility</span>
              </div>
            </article>

            <article className="reservation-item console-asset-card">
              <div className="reservation-item__header">
                <div>
                  <h3>Latest operation summary</h3>
                  <p>Backend result of the latest charger availability update.</p>
                </div>
                <span className="feature-card__note">
                  {lastUpdate ? 'Saved' : 'Pending'}
                </span>
              </div>

              <div className="console-asset-card__grid">
                <article className="console-asset-card__metric">
                  <span>Latest Device</span>
                  <strong>{lastUpdate?.updatedCharger.label ?? 'No updates yet'}</strong>
                </article>
                <article className="console-asset-card__metric">
                  <span>Status</span>
                  <strong>
                    {lastUpdate
                      ? formatTokenLabel(lastUpdate.updatedCharger.status)
                      : 'Pending'}
                  </strong>
                </article>
                <article className="console-asset-card__metric">
                  <span>Cancelled Reservations</span>
                  <strong>{String(lastUpdate?.cancelledReservationsCount ?? 0)}</strong>
                </article>
                <article className="console-asset-card__metric">
                  <span>Active Sessions</span>
                  <strong>{String(lastUpdate?.affectedActiveSessionCount ?? 0)}</strong>
                </article>
              </div>
            </article>
          </div>
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Operation Notes</h2>
              <p>Maintenance and incident management workflows are limited in this workspace.</p>
            </div>
          </div>

          <div className="session-empty-state">
            <span className="session-empty-state__eyebrow">Workspace Availability</span>
            <strong>Maintenance workflow is currently unavailable in this workspace.</strong>
            <p>Advanced analytics are currently unavailable. Contact your administrator for additional operation access.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

function toChargerStatusClass(status: ChargerStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'status-pill--available';
    case 'OCCUPIED':
      return 'status-pill--occupied';
    case 'OFFLINE':
      return 'status-pill--offline';
    default:
      return 'status-pill--available';
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTokenLabel(value: string): string {
  return formatChargerStatusLabel(value);
}

function resolveOperatorError(error: unknown, fallbackMessage: string): string {
  if (!(error instanceof ApiClientError)) {
    return translateUiMessage(fallbackMessage);
  }

  if (error.status === 403) {
    return 'Operator permission is required to view this screen.';
  }

  return extractTranslatedApiMessages(error, fallbackMessage).join(' ');
}
