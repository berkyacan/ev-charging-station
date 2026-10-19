import {
  ChargerStatus,
  ConnectorType,
  ReservationStatus,
} from '@prisma/client';
import {
  validateAdvanceReservation,
  validateChargerAvailability,
  validateConnectorCompatibility,
  validateNoDoubleBooking,
  validatePastReservationStartTime,
  validatePowerCompatibility,
  validateReservationDuration,
  validateReservationRequest,
  validateStationOperatingHours,
} from './reservation-validation';
import {
  ReservationValidationCharger,
  ReservationValidationExistingReservation,
  ReservationValidationStation,
  ReservationValidationVehicle,
  ValidateReservationRequestInput,
} from './reservation-validation.types';

describe('reservationValidation', () => {
  it('passes connector compatibility when vehicle and charger connectors match', () => {
    const vehicle = buildVehicle({ connectorType: ConnectorType.CCS });
    const charger = buildCharger({ connectorType: ConnectorType.CCS });

    expect(validateConnectorCompatibility(vehicle, charger)).toEqual([]);
  });

  it('fails connector compatibility when vehicle and charger connectors differ', () => {
    const vehicle = buildVehicle({ connectorType: ConnectorType.CCS });
    const charger = buildCharger({ connectorType: ConnectorType.TYPE2 });

    expect(validateConnectorCompatibility(vehicle, charger)).toEqual([
      expect.objectContaining({
        code: 'INCOMPATIBLE_CONNECTOR_TYPE',
      }),
    ]);
  });

  it('passes power compatibility when charger power is within vehicle limit', () => {
    const vehicle = buildVehicle({ maxSupportedPowerKW: 50 });
    const charger = buildCharger({ powerOutputKW: 50 });

    expect(validatePowerCompatibility(vehicle, charger)).toEqual([]);
  });

  it('fails power compatibility when charger power exceeds vehicle limit', () => {
    const vehicle = buildVehicle({ maxSupportedPowerKW: 50 });
    const charger = buildCharger({ powerOutputKW: 150 });

    expect(validatePowerCompatibility(vehicle, charger)).toEqual([
      expect.objectContaining({
        code: 'CHARGER_POWER_EXCEEDS_VEHICLE_LIMIT',
      }),
    ]);
  });

  it('rejects reservation durations greater than 2 hours', () => {
    const startTime = new Date('2026-05-03T10:00:00.000Z');
    const endTime = new Date('2026-05-03T12:30:00.000Z');

    expect(validateReservationDuration(startTime, endTime)).toEqual([
      expect.objectContaining({
        code: 'RESERVATION_DURATION_EXCEEDED',
      }),
    ]);
  });

  it('rejects reservation requests where end time is before start time', () => {
    const startTime = new Date('2026-05-03T10:00:00.000Z');
    const endTime = new Date('2026-05-03T09:00:00.000Z');

    expect(validateReservationDuration(startTime, endTime)).toEqual([
      expect.objectContaining({
        code: 'INVALID_RESERVATION_TIME_RANGE',
      }),
    ]);
  });

  it('rejects reservations more than 24 hours in advance', () => {
    const now = new Date('2026-05-03T10:00:00.000Z');
    const startTime = new Date('2026-05-04T10:00:00.001Z');

    expect(validateAdvanceReservation(startTime, now)).toEqual([
      expect.objectContaining({
        code: 'RESERVATION_TOO_FAR_IN_ADVANCE',
      }),
    ]);
  });

  it('rejects reservation start times in the past', () => {
    expect(
      validatePastReservationStartTime(
        new Date('2026-05-03T09:59:59.000Z'),
        new Date('2026-05-03T10:00:00.000Z'),
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'RESERVATION_START_TIME_IN_PAST',
      }),
    ]);
  });

  it('accepts reservations within 24/7 operating hours', () => {
    expect(
      validateStationOperatingHours(
        buildStation({ operatingHours: '24/7' }),
        new Date('2026-05-03T20:00:00.000Z'),
        new Date('2026-05-03T22:00:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('accepts reservations inside parsed operating hours', () => {
    expect(
      validateStationOperatingHours(
        buildStation({ operatingHours: '08:00-23:00' }),
        new Date('2026-05-03T09:00:00.000Z'),
        new Date('2026-05-03T11:00:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('rejects reservations outside parsed operating hours', () => {
    expect(
      validateStationOperatingHours(
        buildStation({ operatingHours: '08:00-23:00' }),
        new Date('2026-05-03T02:00:00.000Z'),
        new Date('2026-05-03T04:00:00.000Z'),
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'RESERVATION_OUTSIDE_OPERATING_HOURS',
      }),
    ]);
  });

  it('rejects offline chargers', () => {
    const charger = buildCharger({ status: ChargerStatus.OFFLINE });

    expect(
      validateChargerAvailability(
        charger,
        new Date('2026-05-03T10:00:00.000Z'),
        new Date('2026-05-03T12:00:00.000Z'),
        new Date('2026-05-03T10:30:00.000Z'),
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'CHARGER_OFFLINE',
      }),
    ]);
  });

  it('rejects occupied chargers for the current active slot', () => {
    const charger = buildCharger({ status: ChargerStatus.OCCUPIED });

    expect(
      validateChargerAvailability(
        charger,
        new Date('2026-05-03T10:00:00.000Z'),
        new Date('2026-05-03T12:00:00.000Z'),
        new Date('2026-05-03T10:30:00.000Z'),
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'CHARGER_OCCUPIED',
      }),
    ]);
  });

  it('does not reject an occupied charger for a future non-conflicting slot', () => {
    const charger = buildCharger({ status: ChargerStatus.OCCUPIED });

    expect(
      validateChargerAvailability(
        charger,
        new Date('2026-05-03T13:00:00.000Z'),
        new Date('2026-05-03T15:00:00.000Z'),
        new Date('2026-05-03T10:30:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('rejects overlapping confirmed reservations', () => {
    const existingReservations = [
      buildExistingReservation({
        id: 'reservation-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date('2026-05-03T10:00:00.000Z'),
        endTime: new Date('2026-05-03T12:00:00.000Z'),
      }),
    ];

    expect(
      validateNoDoubleBooking(
        existingReservations,
        new Date('2026-05-03T11:00:00.000Z'),
        new Date('2026-05-03T12:00:00.000Z'),
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'CHARGER_ALREADY_RESERVED',
      }),
    ]);
  });

  it('does not let cancelled reservations block a new reservation', () => {
    const existingReservations = [
      buildExistingReservation({
        id: 'reservation-1',
        status: ReservationStatus.CANCELLED,
        startTime: new Date('2026-05-03T10:00:00.000Z'),
        endTime: new Date('2026-05-03T12:00:00.000Z'),
      }),
    ];

    expect(
      validateNoDoubleBooking(
        existingReservations,
        new Date('2026-05-03T11:00:00.000Z'),
        new Date('2026-05-03T12:00:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('does not let completed reservations block a new reservation', () => {
    const existingReservations = [
      buildExistingReservation({
        id: 'reservation-1',
        status: ReservationStatus.COMPLETED,
        startTime: new Date('2026-05-03T10:00:00.000Z'),
        endTime: new Date('2026-05-03T12:00:00.000Z'),
      }),
    ];

    expect(
      validateNoDoubleBooking(
        existingReservations,
        new Date('2026-05-03T11:00:00.000Z'),
        new Date('2026-05-03T12:00:00.000Z'),
      ),
    ).toEqual([]);
  });

  it('passes a fully valid reservation request', () => {
    const result = validateReservationRequest(
      buildReservationRequest({
        existingReservations: [
          buildExistingReservation({
            id: 'reservation-1',
            status: ReservationStatus.CANCELLED,
            startTime: new Date('2026-05-03T08:00:00.000Z'),
            endTime: new Date('2026-05-03T10:00:00.000Z'),
          }),
        ],
      }),
    );

    expect(result).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('returns a clear list of validation errors when multiple rules fail', () => {
    const result = validateReservationRequest(
      buildReservationRequest({
        vehicle: buildVehicle({
          connectorType: ConnectorType.CCS,
          maxSupportedPowerKW: 50,
        }),
        charger: buildCharger({
          connectorType: ConnectorType.TYPE2,
          powerOutputKW: 150,
          status: ChargerStatus.OFFLINE,
        }),
        existingReservations: [
          buildExistingReservation({
            id: 'reservation-2',
            status: ReservationStatus.CONFIRMED,
            startTime: new Date('2026-05-04T10:30:00.000Z'),
            endTime: new Date('2026-05-04T11:30:00.000Z'),
          }),
        ],
        requestedStartTime: new Date('2026-05-04T11:00:00.001Z'),
        requestedEndTime: new Date('2026-05-04T13:30:00.001Z'),
        now: new Date('2026-05-03T10:00:00.000Z'),
      }),
    );

    expect(result.isValid).toBe(false);

    if (result.isValid) {
      throw new Error('Expected validation to fail.');
    }

    expect(result.errors.map((error) => error.code)).toEqual([
      'INCOMPATIBLE_CONNECTOR_TYPE',
      'CHARGER_POWER_EXCEEDS_VEHICLE_LIMIT',
      'RESERVATION_DURATION_EXCEEDED',
      'RESERVATION_TOO_FAR_IN_ADVANCE',
      'CHARGER_OFFLINE',
      'CHARGER_ALREADY_RESERVED',
    ]);
  });
});

function buildVehicle(
  overrides?: Partial<ReservationValidationVehicle>,
): ReservationValidationVehicle {
  return {
    connectorType: overrides?.connectorType ?? ConnectorType.CCS,
    maxSupportedPowerKW: overrides?.maxSupportedPowerKW ?? 50,
  };
}

function buildCharger(
  overrides?: Partial<ReservationValidationCharger>,
): ReservationValidationCharger {
  return {
    id: overrides?.id ?? 'charger-1',
    connectorType: overrides?.connectorType ?? ConnectorType.CCS,
    powerOutputKW: overrides?.powerOutputKW ?? 50,
    status: overrides?.status ?? ChargerStatus.AVAILABLE,
  };
}

function buildExistingReservation(
  overrides?: Partial<ReservationValidationExistingReservation>,
): ReservationValidationExistingReservation {
  return {
    id: overrides?.id ?? 'reservation-1',
    status: overrides?.status ?? ReservationStatus.CONFIRMED,
    startTime:
      overrides?.startTime ?? new Date('2026-05-03T14:00:00.000Z'),
    endTime: overrides?.endTime ?? new Date('2026-05-03T16:00:00.000Z'),
  };
}

function buildReservationRequest(
  overrides?: Partial<ValidateReservationRequestInput>,
): ValidateReservationRequestInput {
  return {
    vehicle: overrides?.vehicle ?? buildVehicle(),
    charger: overrides?.charger ?? buildCharger(),
    station: overrides?.station ?? buildStation(),
    existingReservations: overrides?.existingReservations ?? [],
    requestedStartTime:
      overrides?.requestedStartTime ??
      new Date('2026-05-03T12:00:00.000Z'),
    requestedEndTime:
      overrides?.requestedEndTime ?? new Date('2026-05-03T14:00:00.000Z'),
    now: overrides?.now ?? new Date('2026-05-03T10:00:00.000Z'),
  };
}

function buildStation(
  overrides?: Partial<ReservationValidationStation>,
): ReservationValidationStation {
  return {
    operatingHours: overrides?.operatingHours ?? '24/7',
  };
}
