import {
  ChargerStatus,
  ConnectorType,
  ReservationStatus,
} from '@prisma/client';

export interface ReservationValidationVehicle {
  connectorType: ConnectorType;
  maxSupportedPowerKW: number;
}

export interface ReservationValidationCharger {
  id?: string;
  connectorType: ConnectorType;
  powerOutputKW: number;
  status: ChargerStatus;
}

export interface ReservationValidationStation {
  operatingHours: string;
}

export interface ReservationValidationExistingReservation {
  id?: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
}

export type ReservationValidationErrorCode =
  | 'INCOMPATIBLE_CONNECTOR_TYPE'
  | 'CHARGER_POWER_EXCEEDS_VEHICLE_LIMIT'
  | 'INVALID_RESERVATION_TIME_RANGE'
  | 'RESERVATION_DURATION_EXCEEDED'
  | 'RESERVATION_START_TIME_IN_PAST'
  | 'RESERVATION_TOO_FAR_IN_ADVANCE'
  | 'RESERVATION_OUTSIDE_OPERATING_HOURS'
  | 'CHARGER_OFFLINE'
  | 'CHARGER_OCCUPIED'
  | 'CHARGER_ALREADY_RESERVED';

export interface ReservationValidationError {
  code: ReservationValidationErrorCode;
  message: string;
  field: string;
  details?: Record<string, unknown>;
}

export type ReservationValidationResult =
  | {
      isValid: true;
      errors: [];
    }
  | {
      isValid: false;
      errors: ReservationValidationError[];
    };

export interface ValidateReservationRequestInput {
  vehicle: ReservationValidationVehicle;
  charger: ReservationValidationCharger;
  station: ReservationValidationStation;
  existingReservations: ReservationValidationExistingReservation[];
  requestedStartTime: Date;
  requestedEndTime: Date;
  now: Date;
}
