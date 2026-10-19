import { apiClient } from '../../shared/api';
import type {
  ChargerStatus,
  ChargerType,
  ConnectorType,
  ReservationStatus,
} from '../../shared/types';

export interface ReservationRequestPayload {
  vehicleId: string;
  chargerId: string;
  startTime: string;
  endTime: string;
}

export interface ReservationVehicleInfo {
  id: string;
  brand: string;
  model: string;
  batteryCapacityKWh: number;
  connectorType: ConnectorType;
  maxSupportedPowerKW: number;
  plateNumber: string;
  createdAt?: string;
}

export interface ReservationChargerInfo {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: number;
  pricePerKWh: number;
  status: ChargerStatus;
  createdAt?: string;
}

export interface ReservationStationInfo {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
  createdAt?: string;
}

export interface ReservationValidationResponse {
  isValid: boolean;
  errors: string[];
  charger: ReservationChargerInfo;
  vehicle: ReservationVehicleInfo;
}

export interface ReservationDetailsResponse {
  id: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
  createdAt: string;
  vehicle: ReservationVehicleInfo;
  charger: ReservationChargerInfo;
  station: ReservationStationInfo;
}

export function validateReservation(
  payload: ReservationRequestPayload,
): Promise<ReservationValidationResponse> {
  return apiClient.post<ReservationValidationResponse>(
    '/reservations/validate',
    payload,
  );
}

export function createReservation(
  payload: ReservationRequestPayload,
): Promise<ReservationDetailsResponse> {
  return apiClient.post<ReservationDetailsResponse>('/reservations', payload);
}

export function getMyReservations(): Promise<ReservationDetailsResponse[]> {
  return apiClient.get<ReservationDetailsResponse[]>('/reservations/me');
}

export function cancelReservation(
  reservationId: string,
): Promise<ReservationDetailsResponse> {
  return apiClient.delete<ReservationDetailsResponse>(
    `/reservations/${reservationId}`,
  );
}
