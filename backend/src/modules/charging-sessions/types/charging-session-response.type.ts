import {
  ChargerStatus,
  ChargerType,
  ChargingSessionStatus,
  ConnectorType,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';

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

export interface ChargingSessionPaymentResponse {
  paymentStatus: PaymentStatus;
  transactionId: string;
  receiptNumber: string;
  paidAmount: number;
  paidAt: string;
  paymentMethod: PaymentMethod;
  walletBalanceBeforePayment: number | null;
  walletBalanceAfterPayment: number | null;
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
