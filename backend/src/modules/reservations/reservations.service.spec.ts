import { NotFoundException } from '@nestjs/common';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationRequestDto } from './dto/reservation-request.dto';
import { ReservationsService } from './reservations.service';
import {
  ChargingSessionStatus,
  ChargerStatus,
  ChargerType,
  ConnectorType,
  Prisma,
  ReservationStatus,
} from '@prisma/client';

describe('ReservationsService', () => {
  let reservationsService: ReservationsService;
  let prismaService: {
    $transaction: jest.Mock;
    vehicle: {
      findFirst: jest.Mock;
    };
    charger: {
      findUnique: jest.Mock;
    };
    station: {
      findUnique: jest.Mock;
    };
    reservation: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let notificationsService: {
    createNotification: jest.Mock;
  };

  beforeEach(() => {
    prismaService = {
      $transaction: jest.fn(),
      vehicle: {
        findFirst: jest.fn(),
      },
      charger: {
        findUnique: jest.fn(),
      },
      station: {
        findUnique: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    notificationsService = {
      createNotification: jest.fn(),
    };
    prismaService.$transaction.mockImplementation(
      async (callback: (client: typeof prismaService) => unknown) =>
        callback(prismaService),
    );

    reservationsService = new ReservationsService(
      prismaService as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
    jest
      .spyOn(
        reservationsService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));
  });

  it('creates a valid reservation', async () => {
    mockValidationContext();
    prismaService.reservation.create.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CONFIRMED,
      }),
    );

    const result = await reservationsService.createReservationForUser(
      'user-1',
      buildRequestDto(),
    );

    expect(prismaService.reservation.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        stationId: 'station-1',
        chargerId: 'charger-1',
        startTime: new Date('2026-05-03T12:00:00.000Z'),
        endTime: new Date('2026-05-03T14:00:00.000Z'),
        status: ReservationStatus.CONFIRMED,
      },
      include: {
        vehicle: true,
        charger: true,
        station: true,
      },
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'RESERVATION_CONFIRMED',
      'Randevunuz onaylandı.',
    );
    expect(result.status).toBe(ReservationStatus.CONFIRMED);
  });

  it('rejects an incompatible charger', async () => {
    mockValidationContext({
      charger: buildChargerRecord({
        connectorType: ConnectorType.TYPE2,
      }),
    });

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects a charger with too much power output', async () => {
    mockValidationContext({
      charger: buildChargerRecord({
        powerOutputKW: new Prisma.Decimal(150),
      }),
    });

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects reservation durations over 2 hours', async () => {
    mockValidationContext();

    await expect(
      reservationsService.createReservationForUser(
        'user-1',
        buildRequestDto({
          endTime: new Date('2026-05-03T14:30:00.000Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects reservations more than 24 hours in advance', async () => {
    mockValidationContext();
    jest
      .spyOn(
        reservationsService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));

    await expect(
      reservationsService.createReservationForUser(
        'user-1',
        buildRequestDto({
          startTime: new Date('2026-05-04T10:00:00.001Z'),
          endTime: new Date('2026-05-04T12:00:00.001Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects reservations with a start time in the past', async () => {
    mockValidationContext();
    jest
      .spyOn(
        reservationsService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T12:00:01.000Z'));

    await expect(
      reservationsService.createReservationForUser(
        'user-1',
        buildRequestDto({
          startTime: new Date('2026-05-03T12:00:00.000Z'),
          endTime: new Date('2026-05-03T14:00:00.000Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects reservations outside station operating hours', async () => {
    mockValidationContext({
      station: buildStationRecord(),
    });

    await expect(
      reservationsService.createReservationForUser(
        'user-1',
        buildRequestDto({
          startTime: new Date('2026-05-03T02:00:00.000Z'),
          endTime: new Date('2026-05-03T04:00:00.000Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects double booking when a confirmed reservation overlaps', async () => {
    mockValidationContext({
      existingReservations: [
        buildExistingReservation({
          status: ReservationStatus.CONFIRMED,
          startTime: new Date('2026-05-03T13:00:00.000Z'),
          endTime: new Date('2026-05-03T15:00:00.000Z'),
        }),
      ],
    });

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects offline chargers for reservation creation', async () => {
    mockValidationContext({
      charger: buildChargerRecord({
        status: ChargerStatus.OFFLINE,
      }),
    });

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('allows an occupied charger for a future non-conflicting slot', async () => {
    mockValidationContext({
      charger: buildChargerRecord({
        status: ChargerStatus.OCCUPIED,
      }),
      station: buildOpenStationRecord(),
    });
    jest
      .spyOn(
        reservationsService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));
    prismaService.reservation.create.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CONFIRMED,
      }),
    );

    const result = await reservationsService.createReservationForUser(
      'user-1',
      buildRequestDto({
        startTime: new Date('2026-05-03T13:00:00.000Z'),
        endTime: new Date('2026-05-03T15:00:00.000Z'),
      }),
    );

    expect(result.status).toBe(ReservationStatus.CONFIRMED);
  });

  it('does not double-book against a cancelled reservation', async () => {
    mockValidationContext({
      existingReservations: [
        buildExistingReservation({
          status: ReservationStatus.CANCELLED,
          startTime: new Date('2026-05-03T13:00:00.000Z'),
          endTime: new Date('2026-05-03T15:00:00.000Z'),
        }),
      ],
    });
    prismaService.reservation.create.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CONFIRMED,
      }),
    );

    const result = await reservationsService.createReservationForUser(
      'user-1',
      buildRequestDto(),
    );

    expect(result.status).toBe(ReservationStatus.CONFIRMED);
  });

  it('allows a user to cancel their own reservation', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CONFIRMED,
      }),
    );
    prismaService.reservation.update.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CANCELLED,
      }),
    );

    const result = await reservationsService.cancelReservationForUser(
      'user-1',
      'reservation-1',
    );

    expect(prismaService.reservation.update).toHaveBeenCalledWith({
      where: {
        id: 'reservation-1',
      },
      data: {
        status: ReservationStatus.CANCELLED,
      },
      include: {
        vehicle: true,
        charger: true,
        station: true,
      },
    });
    expect(result.status).toBe(ReservationStatus.CANCELLED);
  });

  it('returns an already cancelled reservation safely', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CANCELLED,
      }),
    );

    const result = await reservationsService.cancelReservationForUser(
      'user-1',
      'reservation-1',
    );

    expect(prismaService.reservation.update).not.toHaveBeenCalled();
    expect(result.status).toBe(ReservationStatus.CANCELLED);
  });

  it('rejects cancellation for completed reservations', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.COMPLETED,
      }),
    );

    await expect(
      reservationsService.cancelReservationForUser('user-1', 'reservation-1'),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(prismaService.reservation.update).not.toHaveBeenCalled();
  });

  it('rejects cancellation when an active charging session exists', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        chargingSession: {
          id: 'session-1',
          status: ChargingSessionStatus.ACTIVE,
        },
      }),
    );

    await expect(
      reservationsService.cancelReservationForUser('user-1', 'reservation-1'),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(prismaService.reservation.update).not.toHaveBeenCalled();
  });

  it('rejects cancellation when a completed charging session exists', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        chargingSession: {
          id: 'session-1',
          status: ChargingSessionStatus.COMPLETED,
        },
      }),
    );

    await expect(
      reservationsService.cancelReservationForUser('user-1', 'reservation-1'),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(prismaService.reservation.update).not.toHaveBeenCalled();
  });

  it('returns validation result without creating a reservation', async () => {
    mockValidationContext();

    const result = await reservationsService.validateReservationForUser(
      'user-1',
      buildRequestDto(),
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.charger).toBeDefined();
    expect(result.vehicle).toBeDefined();
    expect(prismaService.reservation.create).not.toHaveBeenCalled();
  });

  it('returns invalid validation result without creating a reservation', async () => {
    mockValidationContext({
      charger: buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    });

    const result = await reservationsService.validateReservationForUser(
      'user-1',
      buildRequestDto(),
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(prismaService.reservation.create).not.toHaveBeenCalled();
  });

  it('returns reservations for the authenticated user', async () => {
    prismaService.reservation.findMany.mockResolvedValue([
      buildReservationRecord({ status: ReservationStatus.CONFIRMED }),
      buildReservationRecord({ status: ReservationStatus.CANCELLED }),
    ]);

    const result = await reservationsService.findReservationsForUser('user-1');

    expect(prismaService.reservation.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: { vehicle: true, charger: true, station: true },
      orderBy: { startTime: 'desc' },
    });
    expect(result).toHaveLength(2);
  });

  it('throws NotFoundException when cancelling a non-existent reservation', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(null);

    await expect(
      reservationsService.cancelReservationForUser('user-1', 'missing-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws RESERVATION_CANNOT_BE_CANCELLED for an unknown status with no charging session', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({ status: 'UNKNOWN_STATUS' as ReservationStatus }),
    );

    await expect(
      reservationsService.cancelReservationForUser('user-1', 'reservation-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({
          code: 'RESERVATION_CANNOT_BE_CANCELLED',
        }),
      }),
    });
  });

  it('throws NotFoundException when vehicle not found during validation', async () => {
    prismaService.vehicle.findFirst.mockResolvedValue(null);
    prismaService.charger.findUnique.mockResolvedValue(buildChargerRecord());

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when charger not found during validation', async () => {
    prismaService.vehicle.findFirst.mockResolvedValue(buildVehicleRecord());
    prismaService.charger.findUnique.mockResolvedValue(null);

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when station not found during validation', async () => {
    prismaService.vehicle.findFirst.mockResolvedValue(buildVehicleRecord());
    prismaService.charger.findUnique.mockResolvedValue(buildChargerRecord());
    prismaService.station.findUnique.mockResolvedValue(null);
    prismaService.reservation.findMany.mockResolvedValue([]);

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps serialization conflicts to a user-friendly slot message', async () => {
    mockValidationContext({
      station: buildOpenStationRecord(),
    });
    prismaService.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('write conflict', {
        clientVersion: 'test',
        code: 'P2034',
      }),
    );

    await expect(
      reservationsService.createReservationForUser('user-1', buildRequestDto()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({
          code: 'RESERVATION_SLOT_JUST_TAKEN',
        }),
      }),
    });
  });

  function mockValidationContext(overrides?: {
    vehicle?: ReturnType<typeof buildVehicleRecord>;
    charger?: ReturnType<typeof buildChargerRecord>;
    station?: ReturnType<typeof buildStationRecord>;
    existingReservations?: Array<ReturnType<typeof buildExistingReservation>>;
  }): void {
    prismaService.vehicle.findFirst.mockResolvedValue(
      overrides?.vehicle ?? buildVehicleRecord(),
    );
    prismaService.charger.findUnique.mockResolvedValue(
      overrides?.charger ?? buildChargerRecord(),
    );
    prismaService.station.findUnique.mockResolvedValue(
      overrides?.station ?? buildOpenStationRecord(),
    );
    prismaService.reservation.findMany.mockResolvedValue(
      overrides?.existingReservations ?? [],
    );
  }
});

function buildRequestDto(
  overrides?: Partial<ReservationRequestDto>,
): ReservationRequestDto {
  return {
    vehicleId: overrides?.vehicleId ?? 'vehicle-1',
    chargerId: overrides?.chargerId ?? 'charger-1',
    startTime:
      overrides?.startTime ?? new Date('2026-05-03T12:00:00.000Z'),
    endTime: overrides?.endTime ?? new Date('2026-05-03T14:00:00.000Z'),
  };
}

function buildVehicleRecord(overrides?: {
  connectorType?: ConnectorType;
  maxSupportedPowerKW?: Prisma.Decimal;
}): {
  id: string;
  userId: string;
  brand: string;
  model: string;
  batteryCapacityKWh: Prisma.Decimal;
  connectorType: ConnectorType;
  maxSupportedPowerKW: Prisma.Decimal;
  plateNumber: string;
  createdAt: Date;
} {
  return {
    id: 'vehicle-1',
    userId: 'user-1',
    brand: 'Tesla',
    model: 'Model 3',
    batteryCapacityKWh: new Prisma.Decimal(75),
    connectorType: overrides?.connectorType ?? ConnectorType.CCS,
    maxSupportedPowerKW:
      overrides?.maxSupportedPowerKW ?? new Prisma.Decimal(50),
    plateNumber: '35 EV 2024',
    createdAt: new Date('2026-05-03T09:00:00.000Z'),
  };
}

function buildChargerRecord(overrides?: {
  connectorType?: ConnectorType;
  powerOutputKW?: Prisma.Decimal;
  status?: ChargerStatus;
}): {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: Prisma.Decimal;
  pricePerKWh: Prisma.Decimal;
  status: ChargerStatus;
  createdAt: Date;
} {
  return {
    id: 'charger-1',
    stationId: 'station-1',
    label: 'DC 50kW #03',
    chargerType: ChargerType.DC,
    connectorType: overrides?.connectorType ?? ConnectorType.CCS,
    powerOutputKW: overrides?.powerOutputKW ?? new Prisma.Decimal(50),
    pricePerKWh: new Prisma.Decimal(4),
    status: overrides?.status ?? ChargerStatus.AVAILABLE,
    createdAt: new Date('2026-05-03T09:00:00.000Z'),
  };
}

function buildStationRecord(): {
  id: string;
  name: string;
  address: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  operatingHours: string;
  createdAt: Date;
} {
  return {
    id: 'station-1',
    name: 'Karsiyaka Hub',
    address: 'Izmir',
    latitude: new Prisma.Decimal('38.457491'),
    longitude: new Prisma.Decimal('27.112394'),
    operatingHours: '08:00-23:00',
    createdAt: new Date('2026-05-03T09:00:00.000Z'),
  };
}

function buildOpenStationRecord(): {
  id: string;
  name: string;
  address: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  operatingHours: string;
  createdAt: Date;
} {
  return {
    ...buildStationRecord(),
    operatingHours: '24/7',
  };
}

function buildExistingReservation(overrides?: {
  id?: string;
  status?: ReservationStatus;
  startTime?: Date;
  endTime?: Date;
}): {
  id: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
} {
  return {
    id: overrides?.id ?? 'reservation-existing',
    status: overrides?.status ?? ReservationStatus.CONFIRMED,
    startTime:
      overrides?.startTime ?? new Date('2026-05-03T16:00:00.000Z'),
    endTime: overrides?.endTime ?? new Date('2026-05-03T18:00:00.000Z'),
  };
}

function buildReservationRecord(overrides?: {
  status?: ReservationStatus;
  chargingSession?: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
}): {
  id: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  vehicle: ReturnType<typeof buildVehicleRecord>;
  charger: ReturnType<typeof buildChargerRecord>;
  station: ReturnType<typeof buildStationRecord>;
  chargingSession?: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
} {
  return {
    id: 'reservation-1',
    status: overrides?.status ?? ReservationStatus.CONFIRMED,
    startTime: new Date('2026-05-03T12:00:00.000Z'),
    endTime: new Date('2026-05-03T14:00:00.000Z'),
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
    vehicle: buildVehicleRecord(),
    charger: buildChargerRecord(),
    station: buildStationRecord(),
    chargingSession: overrides?.chargingSession,
  };
}
