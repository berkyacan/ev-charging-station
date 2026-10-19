import { ChargerStatus, ChargerType, ConnectorType } from '@prisma/client';

export interface ChargerAvailabilitySummary {
  totalChargers: number;
  availableChargers: number;
  occupiedChargers: number;
  offlineChargers: number;
}

export interface StationListItemResponse {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
  chargerAvailabilitySummary: ChargerAvailabilitySummary;
}

export interface StationDetailResponse extends StationListItemResponse {
  createdAt: string;
}

export interface ChargerDetailsResponse {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: number;
  pricePerKWh: number;
  status: ChargerStatus;
  availabilityForSelectedSlot?: ChargerStatus;
  availabilityReason?: string;
  createdAt: string;
}

export interface StationChargersResponse {
  stationId: string;
  stationName: string;
  chargerAvailabilitySummary: ChargerAvailabilitySummary;
  chargers: ChargerDetailsResponse[];
}
