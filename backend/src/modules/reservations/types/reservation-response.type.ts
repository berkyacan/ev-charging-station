import {
  ChargerStatus,
  ChargerType,
  ConnectorType,
  ReservationStatus,
} from '@prisma/client';

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
