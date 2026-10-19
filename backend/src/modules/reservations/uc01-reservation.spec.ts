/**
 * UC-01: Charging Slot Reservation
 * ─────────────────────────────────────────────────────────────────────────────
 * Actors : EV Driver, Map Service Provider
 *
 * Main flow:
 *   1. Driver views nearby stations on a map.
 *   2. Driver selects a station and a charger.
 *   3. Driver selects a registered vehicle.
 *   4. System validates vehicle–charger compatibility.
 *   5. System validates reservation rules.
 *   6. If valid → reservation is created.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST CASE TABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * | ID       | Requirement Tested                    | Expected Outcome       |
 * |----------|---------------------------------------|------------------------|
 * | TC-01-01 | Happy path – valid reservation        | isValid = true         |
 * | TC-01-02 | Incompatible connector type           | INCOMPATIBLE_CONNECTOR  |
 * | TC-01-03 | Charger power exceeds vehicle limit   | CHARGER_POWER_EXCEEDED  |
 * | TC-01-04 | Double booking – slot already taken   | CHARGER_ALREADY_RESERVED|
 * | TC-01-05 | Duration longer than 2 hours          | DURATION_EXCEEDED       |
 * | TC-01-06 | Reservation more than 24 h in advance | TOO_FAR_IN_ADVANCE      |
 * | TC-01-07 | Charger is offline                    | CHARGER_OFFLINE         |
 * | TC-01-08 | Start time is in the past             | START_TIME_IN_PAST      |
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ChargerStatus, ConnectorType, ReservationStatus } from '@prisma/client';
import {
  validateReservationRequest,
} from './domain/reservation-validation';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationsService } from './reservations.service';

// ─── Shared test data builders ────────────────────────────────────────────────

const NOW = new Date('2026-06-01T10:00:00.000Z');

/** A future 1-hour slot that fits all rules. */
const VALID_SLOT = {
  startTime: new Date('2026-06-01T12:00:00.000Z'),
  endTime:   new Date('2026-06-01T13:00:00.000Z'),
};

function makeVehicle(overrides?: Partial<{ connectorType: ConnectorType; maxSupportedPowerKW: number }>) {
  return {
    connectorType:      overrides?.connectorType      ?? ConnectorType.CCS,
    maxSupportedPowerKW: overrides?.maxSupportedPowerKW ?? 50,
  };
}

function makeCharger(overrides?: Partial<{ connectorType: ConnectorType; powerOutputKW: number; status: ChargerStatus }>) {
  return {
    id:             'charger-1',
    connectorType:  overrides?.connectorType  ?? ConnectorType.CCS,
    powerOutputKW:  overrides?.powerOutputKW  ?? 50,
    status:         overrides?.status         ?? ChargerStatus.AVAILABLE,
  };
}

const OPEN_STATION  = { operatingHours: '24/7' };
const NO_EXISTING: { id: string; status: ReservationStatus; startTime: Date; endTime: Date }[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// UC-01 — Domain Validation (pure function, no database)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-01 | Reservation Validation Rules', () => {

  // TC-01-01 ──────────────────────────────────────────────────────────────────
  it('TC-01-01 | Happy path: valid reservation is accepted', () => {
    const result = validateReservationRequest({
      vehicle:              makeVehicle(),
      charger:              makeCharger(),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   VALID_SLOT.startTime,
      requestedEndTime:     VALID_SLOT.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // TC-01-02 ──────────────────────────────────────────────────────────────────
  it('TC-01-02 | Incompatible connector: vehicle CCS vs charger Type2', () => {
    const result = validateReservationRequest({
      vehicle:              makeVehicle({ connectorType: ConnectorType.CCS }),
      charger:              makeCharger({ connectorType: ConnectorType.TYPE2 }),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   VALID_SLOT.startTime,
      requestedEndTime:     VALID_SLOT.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('INCOMPATIBLE_CONNECTOR_TYPE');
  });

  // TC-01-03 ──────────────────────────────────────────────────────────────────
  it('TC-01-03 | Charger power (150 kW) exceeds vehicle limit (50 kW)', () => {
    const result = validateReservationRequest({
      vehicle:              makeVehicle({ maxSupportedPowerKW: 50 }),
      charger:              makeCharger({ powerOutputKW: 150 }),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   VALID_SLOT.startTime,
      requestedEndTime:     VALID_SLOT.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('CHARGER_POWER_EXCEEDS_VEHICLE_LIMIT');
  });

  // TC-01-04 ──────────────────────────────────────────────────────────────────
  it('TC-01-04 | Double booking: overlapping confirmed reservation exists', () => {
    const existingReservation = {
      id:        'res-existing',
      status:    ReservationStatus.CONFIRMED,
      startTime: new Date('2026-06-01T12:30:00.000Z'), // overlaps VALID_SLOT
      endTime:   new Date('2026-06-01T13:30:00.000Z'),
    };

    const result = validateReservationRequest({
      vehicle:              makeVehicle(),
      charger:              makeCharger(),
      station:              OPEN_STATION,
      existingReservations: [existingReservation],
      requestedStartTime:   VALID_SLOT.startTime,
      requestedEndTime:     VALID_SLOT.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('CHARGER_ALREADY_RESERVED');
  });

  // TC-01-05 ──────────────────────────────────────────────────────────────────
  it('TC-01-05 | Duration > 2 hours is rejected (3-hour slot)', () => {
    const result = validateReservationRequest({
      vehicle:              makeVehicle(),
      charger:              makeCharger(),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   new Date('2026-06-01T12:00:00.000Z'),
      requestedEndTime:     new Date('2026-06-01T15:00:00.000Z'), // 3 hours
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('RESERVATION_DURATION_EXCEEDED');
    expect(result.errors[0].details?.durationInHours).toBe(3);
  });

  // TC-01-06 ──────────────────────────────────────────────────────────────────
  it('TC-01-06 | Reservation more than 24 hours in advance is rejected', () => {
    const farFuture = {
      startTime: new Date('2026-06-03T12:00:00.000Z'), // 2 days ahead
      endTime:   new Date('2026-06-03T13:00:00.000Z'),
    };

    const result = validateReservationRequest({
      vehicle:              makeVehicle(),
      charger:              makeCharger(),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   farFuture.startTime,
      requestedEndTime:     farFuture.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('RESERVATION_TOO_FAR_IN_ADVANCE');
  });

  // TC-01-07 ──────────────────────────────────────────────────────────────────
  it('TC-01-07 | Offline charger cannot be reserved', () => {
    const result = validateReservationRequest({
      vehicle:              makeVehicle(),
      charger:              makeCharger({ status: ChargerStatus.OFFLINE }),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   VALID_SLOT.startTime,
      requestedEndTime:     VALID_SLOT.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('CHARGER_OFFLINE');
  });

  // TC-01-08 ──────────────────────────────────────────────────────────────────
  it('TC-01-08 | Start time in the past is rejected', () => {
    const pastSlot = {
      startTime: new Date('2026-06-01T08:00:00.000Z'), // before NOW
      endTime:   new Date('2026-06-01T09:00:00.000Z'),
    };

    const result = validateReservationRequest({
      vehicle:              makeVehicle(),
      charger:              makeCharger(),
      station:              OPEN_STATION,
      existingReservations: NO_EXISTING,
      requestedStartTime:   pastSlot.startTime,
      requestedEndTime:     pastSlot.endTime,
      now:                  NOW,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('RESERVATION_START_TIME_IN_PAST');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-01 — Service Layer (with mocked database)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-01 | ReservationsService — creates or rejects reservations', () => {
  let reservationsService: ReservationsService;
  let prismaService: {
    $transaction: jest.Mock;
    vehicle:     { findFirst: jest.Mock };
    charger:     { findUnique: jest.Mock };
    station:     { findUnique: jest.Mock };
    reservation: { findMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let notificationsService: { createNotification: jest.Mock };

  beforeEach(() => {
    prismaService = {
      $transaction: jest.fn(),
      vehicle:     { findFirst:  jest.fn() },
      charger:     { findUnique: jest.fn() },
      station:     { findUnique: jest.fn() },
      reservation: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    notificationsService = { createNotification: jest.fn() };

    // Make $transaction simply run the callback inline
    prismaService.$transaction.mockImplementation(
      async (callback: (client: typeof prismaService) => unknown) =>
        callback(prismaService),
    );

    reservationsService = new ReservationsService(
      prismaService as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );

    // Pin "now" so time-based rules are deterministic
    jest.spyOn(
      reservationsService as unknown as { getCurrentDate(): Date },
      'getCurrentDate',
    ).mockReturnValue(NOW);
  });

  it('TC-01-01 | Service creates reservation when all rules pass', async () => {
    mockDatabaseWithCompatibleVehicleAndCharger();
    prismaService.reservation.create.mockResolvedValue(buildConfirmedReservationRecord());

    const result = await reservationsService.createReservationForUser('user-1', {
      vehicleId: 'vehicle-1',
      chargerId: 'charger-1',
      startTime: VALID_SLOT.startTime,
      endTime:   VALID_SLOT.endTime,
    });

    expect(prismaService.reservation.create).toHaveBeenCalled();
    expect(result.status).toBe(ReservationStatus.CONFIRMED);
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'RESERVATION_CONFIRMED',
      expect.any(String),
    );
  });

  it('TC-01-04 | Service rejects double booking via DomainValidationException', async () => {
    mockDatabaseWithCompatibleVehicleAndCharger({
      existingReservations: [
        {
          id:        'res-existing',
          status:    ReservationStatus.CONFIRMED,
          startTime: new Date('2026-06-01T12:30:00.000Z'),
          endTime:   new Date('2026-06-01T13:30:00.000Z'),
        },
      ],
    });

    await expect(
      reservationsService.createReservationForUser('user-1', {
        vehicleId: 'vehicle-1',
        chargerId: 'charger-1',
        startTime: VALID_SLOT.startTime,
        endTime:   VALID_SLOT.endTime,
      }),
    ).rejects.toBeInstanceOf(DomainValidationException);

    expect(prismaService.reservation.create).not.toHaveBeenCalled();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function mockDatabaseWithCompatibleVehicleAndCharger(
    overrides?: { existingReservations?: typeof NO_EXISTING },
  ) {
    prismaService.vehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1', userId: 'user-1',
      brand: 'Tesla', model: 'Model 3',
      batteryCapacityKWh: { toString: () => '75' },
      connectorType: ConnectorType.CCS,
      maxSupportedPowerKW: { toString: () => '50' },
      plateNumber: '35 EV 001',
      createdAt: new Date(),
    });
    prismaService.charger.findUnique.mockResolvedValue({
      id: 'charger-1', stationId: 'station-1',
      label: 'DC 50kW #01',
      chargerType: 'DC', connectorType: ConnectorType.CCS,
      powerOutputKW: { toString: () => '50' },
      pricePerKWh: { toString: () => '4' },
      status: ChargerStatus.AVAILABLE,
      createdAt: new Date(),
    });
    prismaService.station.findUnique.mockResolvedValue({
      id: 'station-1', name: 'Karsiyaka Hub', address: 'Izmir',
      latitude: { toString: () => '38.46' },
      longitude: { toString: () => '27.11' },
      operatingHours: '24/7', createdAt: new Date(),
    });
    prismaService.reservation.findMany.mockResolvedValue(
      overrides?.existingReservations ?? [],
    );
  }

  function buildConfirmedReservationRecord() {
    const charger = {
      id: 'charger-1', stationId: 'station-1', label: 'DC 50kW #01',
      chargerType: 'DC', connectorType: ConnectorType.CCS,
      powerOutputKW: { toString: () => '50' },
      pricePerKWh: { toString: () => '4' },
      status: ChargerStatus.AVAILABLE, createdAt: new Date(),
    };
    const station = {
      id: 'station-1', name: 'Karsiyaka Hub', address: 'Izmir',
      latitude: { toString: () => '38.46' }, longitude: { toString: () => '27.11' },
      operatingHours: '24/7', createdAt: new Date(),
    };
    const vehicle = {
      id: 'vehicle-1', userId: 'user-1',
      brand: 'Tesla', model: 'Model 3',
      batteryCapacityKWh: { toString: () => '75' },
      connectorType: ConnectorType.CCS,
      maxSupportedPowerKW: { toString: () => '50' },
      plateNumber: '35 EV 001', createdAt: new Date(),
    };
    return {
      id: 'reservation-1',
      status: ReservationStatus.CONFIRMED,
      startTime: VALID_SLOT.startTime,
      endTime:   VALID_SLOT.endTime,
      createdAt: new Date(),
      vehicle, charger, station,
    };
  }
});
