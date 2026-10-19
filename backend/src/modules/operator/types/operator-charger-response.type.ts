import {
  ChargerStatus,
  ChargerType,
  ConnectorType,
} from '@prisma/client';

export interface OperatorChargerResponse {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: number;
  pricePerKWh: number;
  status: ChargerStatus;
  createdAt: string;
}

export interface OperatorChargerStatusUpdateResponse {
  updatedCharger: OperatorChargerResponse;
  affectedActiveSessionCount: number;
  cancelledReservationsCount: number;
}

export interface OperatorChargerPricingUpdateResponse {
  updatedCharger: OperatorChargerResponse;
}
