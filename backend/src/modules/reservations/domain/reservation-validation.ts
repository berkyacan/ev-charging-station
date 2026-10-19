import { ChargerStatus, ReservationStatus } from '@prisma/client';
import {
  calculateDurationInHours,
  intervalsOverlap,
  isMoreThan24HoursInAdvance,
} from '../../shared/utils/date-time.utils';
import { isReservationWithinOperatingHours } from '../../shared/utils/operating-hours.utils';
import {
  ReservationValidationCharger,
  ReservationValidationError,
  ReservationValidationExistingReservation,
  ReservationValidationResult,
  ReservationValidationStation,
  ReservationValidationVehicle,
  ValidateReservationRequestInput,
} from './reservation-validation.types';

export const MAX_RESERVATION_DURATION_HOURS = 2;

export function validateConnectorCompatibility(
  vehicle: ReservationValidationVehicle,
  charger: ReservationValidationCharger,
): ReservationValidationError[] {
  if (vehicle.connectorType === charger.connectorType) {
    return [];
  }

  return [
    {
      code: 'INCOMPATIBLE_CONNECTOR_TYPE',
      message: 'Vehicle connector type must match charger connector type.',
      field: 'connectorType',
      details: {
        vehicleConnectorType: vehicle.connectorType,
        chargerConnectorType: charger.connectorType,
      },
    },
  ];
}

export function validatePowerCompatibility(
  vehicle: ReservationValidationVehicle,
  charger: ReservationValidationCharger,
): ReservationValidationError[] {
  if (charger.powerOutputKW <= vehicle.maxSupportedPowerKW) {
    return [];
  }

  return [
    {
      code: 'CHARGER_POWER_EXCEEDS_VEHICLE_LIMIT',
      message:
        'Charger power output must not exceed the vehicle max supported power.',
      field: 'powerOutputKW',
      details: {
        chargerPowerOutputKW: charger.powerOutputKW,
        vehicleMaxSupportedPowerKW: vehicle.maxSupportedPowerKW,
      },
    },
  ];
}

export function validateReservationDuration(
  startTime: Date,
  endTime: Date,
): ReservationValidationError[] {
  if (endTime.getTime() <= startTime.getTime()) {
    return [
      {
        code: 'INVALID_RESERVATION_TIME_RANGE',
        message: 'Reservation end time must be after start time.',
        field: 'endTime',
        details: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      },
    ];
  }

  const durationInHours = calculateDurationInHours(startTime, endTime);

  if (durationInHours <= MAX_RESERVATION_DURATION_HOURS) {
    return [];
  }

  return [
    {
      code: 'RESERVATION_DURATION_EXCEEDED',
      message: 'Reservation duration cannot exceed 2 hours.',
      field: 'endTime',
      details: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationInHours,
        maxDurationInHours: MAX_RESERVATION_DURATION_HOURS,
      },
    },
  ];
}

export function validateAdvanceReservation(
  startTime: Date,
  now: Date,
): ReservationValidationError[] {
  if (!isMoreThan24HoursInAdvance(startTime, now)) {
    return [];
  }

  return [
    {
      code: 'RESERVATION_TOO_FAR_IN_ADVANCE',
      message:
        'Reservation cannot be created more than 24 hours in advance.',
      field: 'startTime',
      details: {
        startTime: startTime.toISOString(),
        now: now.toISOString(),
      },
    },
  ];
}

export function validatePastReservationStartTime(
  startTime: Date,
  now: Date,
): ReservationValidationError[] {
  if (startTime.getTime() >= now.getTime()) {
    return [];
  }

  return [
    {
      code: 'RESERVATION_START_TIME_IN_PAST',
      message: 'Reservation start time cannot be in the past.',
      field: 'startTime',
      details: {
        now: now.toISOString(),
        startTime: startTime.toISOString(),
      },
    },
  ];
}

export function validateStationOperatingHours(
  station: ReservationValidationStation,
  startTime: Date,
  endTime: Date,
): ReservationValidationError[] {
  if (
    isReservationWithinOperatingHours(
      station.operatingHours,
      startTime,
      endTime,
    )
  ) {
    return [];
  }

  return [
    {
      code: 'RESERVATION_OUTSIDE_OPERATING_HOURS',
      message: 'Reservation time is outside station operating hours.',
      field: 'startTime',
      details: {
        endTime: endTime.toISOString(),
        operatingHours: station.operatingHours,
        startTime: startTime.toISOString(),
      },
    },
  ];
}

export function validateChargerAvailability(
  charger: ReservationValidationCharger,
  requestedStartTime: Date,
  requestedEndTime: Date,
  now: Date,
): ReservationValidationError[] {
  if (charger.status === ChargerStatus.AVAILABLE) {
    return [];
  }

  if (charger.status === ChargerStatus.OFFLINE) {
    return [
      {
        code: 'CHARGER_OFFLINE',
        message: 'Offline chargers cannot be reserved.',
        field: 'status',
        details: {
          chargerStatus: charger.status,
        },
      },
    ];
  }

  const overlapsCurrentActiveWindow =
    requestedStartTime.getTime() <= now.getTime() &&
    requestedEndTime.getTime() > now.getTime();

  if (!overlapsCurrentActiveWindow) {
    return [];
  }

  return [
    {
      code: 'CHARGER_OCCUPIED',
      message:
        'The selected charger is currently occupied for the requested time slot.',
      field: 'status',
      details: {
        chargerStatus: charger.status,
        now: now.toISOString(),
        requestedEndTime: requestedEndTime.toISOString(),
        requestedStartTime: requestedStartTime.toISOString(),
      },
    },
  ];
}

export function validateNoDoubleBooking(
  existingReservations: ReservationValidationExistingReservation[],
  requestedStartTime: Date,
  requestedEndTime: Date,
): ReservationValidationError[] {
  const conflictingReservations = existingReservations.filter(
    (reservation) =>
      reservation.status === ReservationStatus.CONFIRMED &&
      intervalsOverlap(
        reservation.startTime,
        reservation.endTime,
        requestedStartTime,
        requestedEndTime,
      ),
  );

  if (conflictingReservations.length === 0) {
    return [];
  }

  return [
    {
      code: 'CHARGER_ALREADY_RESERVED',
      message:
        'The selected charger already has a confirmed reservation for the requested time slot.',
      field: 'startTime',
      details: {
        requestedStartTime: requestedStartTime.toISOString(),
        requestedEndTime: requestedEndTime.toISOString(),
        conflictingReservationIds: conflictingReservations
          .map((reservation) => reservation.id)
          .filter((reservationId): reservationId is string =>
            Boolean(reservationId),
          ),
      },
    },
  ];
}

export function validateReservationRequest(
  input: ValidateReservationRequestInput,
): ReservationValidationResult {
  const errors = [
    ...validateConnectorCompatibility(input.vehicle, input.charger),
    ...validatePowerCompatibility(input.vehicle, input.charger),
    ...validateReservationDuration(
      input.requestedStartTime,
      input.requestedEndTime,
    ),
    ...validatePastReservationStartTime(input.requestedStartTime, input.now),
    ...validateAdvanceReservation(input.requestedStartTime, input.now),
    ...validateStationOperatingHours(
      input.station,
      input.requestedStartTime,
      input.requestedEndTime,
    ),
    ...validateChargerAvailability(
      input.charger,
      input.requestedStartTime,
      input.requestedEndTime,
      input.now,
    ),
    ...validateNoDoubleBooking(
      input.existingReservations,
      input.requestedStartTime,
      input.requestedEndTime,
    ),
  ];

  if (errors.length === 0) {
    return {
      isValid: true,
      errors: [],
    };
  }

  return {
    isValid: false,
    errors,
  };
}
