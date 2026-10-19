import { apiClient } from '../../shared/api';
import type {
  ChargerStatus,
  ChargerType,
  ChargingSessionStatus,
  ConnectorType,
  PaymentMethod,
} from '../../shared/types';

export interface ChargingSessionStationInfo {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
}

export interface ChargingSessionChargerInfo {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: number;
  pricePerKWh: number;
  status: ChargerStatus;
}

export interface ChargingSessionSummaryResponse {
  id: string;
  reservationId: string;
  startEnergyKWh: number | null;
  endEnergyKWh: number | null;
  consumedKWh: number | null;
  pricePerKWh: number;
  totalCost: number | null;
  status: ChargingSessionStatus;
  createdAt: string;
  station: ChargingSessionStationInfo;
  charger: ChargingSessionChargerInfo;
  payment: ChargingSessionPaymentResponse | null;
}

export interface ChargingSessionPaymentResponse {
  paymentStatus: 'PAID';
  transactionId: string;
  receiptNumber: string;
  paidAmount: number;
  paidAt: string;
  paymentMethod: PaymentMethod;
  walletBalanceBeforePayment: number | null;
  walletBalanceAfterPayment: number | null;
}

export interface StartChargingSessionPayload {
  reservationId: string;
}

export interface CompleteChargingSessionPayload {
  startEnergyKWh: number;
  endEnergyKWh: number;
}

export interface ConfirmChargingSessionPaymentPayload {
  paymentMethod: PaymentMethod;
}

export function startChargingSession(
  payload: StartChargingSessionPayload,
): Promise<ChargingSessionSummaryResponse> {
  return apiClient.post<ChargingSessionSummaryResponse>(
    '/charging-sessions/start',
    payload,
  );
}

export function completeChargingSession(
  sessionId: string,
  payload: CompleteChargingSessionPayload,
): Promise<ChargingSessionSummaryResponse> {
  return apiClient.post<ChargingSessionSummaryResponse>(
    `/charging-sessions/${sessionId}/complete`,
    payload,
  );
}

export function getChargingSessionSummary(
  sessionId: string,
): Promise<ChargingSessionSummaryResponse> {
  return apiClient.get<ChargingSessionSummaryResponse>(
    `/charging-sessions/${sessionId}/summary`,
  );
}

export function confirmChargingSessionPayment(
  sessionId: string,
  payload: ConfirmChargingSessionPaymentPayload,
): Promise<ChargingSessionPaymentResponse> {
  return apiClient.post<ChargingSessionPaymentResponse>(
    `/charging-sessions/${sessionId}/pay`,
    payload,
  );
}

export function getActiveChargingSession(): Promise<ChargingSessionSummaryResponse | null> {
  return apiClient.get<ChargingSessionSummaryResponse | null>(
    '/charging-sessions/active',
  );
}

export function getChargingHistory(): Promise<ChargingSessionSummaryResponse[]> {
  return apiClient.get<ChargingSessionSummaryResponse[]>('/charging-history/me');
}
