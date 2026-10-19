export type UserRole = 'EV_DRIVER' | 'OPERATOR' | 'ADMIN';

export type ConnectorType = 'TYPE2' | 'CCS' | 'CHADEMO';

export type ChargerType = 'AC' | 'DC';

export type ChargerStatus = 'AVAILABLE' | 'OCCUPIED' | 'OFFLINE';

export type ReservationStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type ChargingSessionStatus = 'ACTIVE' | 'COMPLETED';

export type PaymentStatus = 'PENDING' | 'PAID';

export type PaymentMethod = 'DEMO_WALLET' | 'DEMO_CARD';

export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type IssueType =
  | 'CONNECTOR_DAMAGED'
  | 'PAYMENT_TERMINAL_BROKEN'
  | 'CHARGER_OFFLINE'
  | 'OTHER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  demoWalletBalance: number;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  brand: string;
  model: string;
  batteryCapacityKWh: number;
  connectorType: ConnectorType;
  maxSupportedPowerKW: number;
  plateNumber: string;
  createdAt: string;
}

export interface ChargerAvailabilitySummary {
  totalChargers: number;
  availableChargers: number;
  occupiedChargers: number;
  offlineChargers: number;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
  createdAt?: string;
  chargerAvailabilitySummary?: ChargerAvailabilitySummary;
}

export interface Charger {
  id: string;
  stationId: string;
  label?: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: number;
  pricePerKWh: number;
  status: ChargerStatus;
  availabilityForSelectedSlot?: ChargerStatus;
  availabilityReason?: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  userId: string;
  vehicleId: string;
  stationId: string;
  chargerId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdAt: string;
  vehicle?: Vehicle;
  station?: Station;
  charger?: Charger;
}

export interface ChargingSession {
  id: string;
  reservationId: string;
  startEnergyKWh: number | null;
  endEnergyKWh: number | null;
  consumedKWh: number | null;
  pricePerKWh: number;
  totalCost: number | null;
  status: ChargingSessionStatus;
  createdAt: string;
  reservation?: Reservation;
  station?: Station;
  charger?: Charger;
  payment?: ChargingSessionPayment | null;
}

export interface ChargingSessionPayment {
  paymentStatus: PaymentStatus;
  transactionId: string;
  receiptNumber: string;
  paidAmount: number;
  paidAt: string;
  paymentMethod: PaymentMethod;
  walletBalanceBeforePayment: number | null;
  walletBalanceAfterPayment: number | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  userId?: string;
}

export interface IssueReport {
  id: string;
  issueType: IssueType;
  description: string;
  status: IssueStatus;
  createdAt: string;
  userId?: string;
  stationId?: string;
  chargerId?: string;
  station?: Pick<Station, 'id' | 'name' | 'address'>;
  charger?: Pick<Charger, 'id' | 'label' | 'status'>;
  user?: User;
}
