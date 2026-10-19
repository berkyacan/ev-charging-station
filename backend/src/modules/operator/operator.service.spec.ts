import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ChargingSessionStatus,
  ChargerStatus,
  ChargerType,
  ConnectorType,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateChargerPricingDto } from './dto/update-charger-pricing.dto';
import { UpdateChargerStatusDto } from './dto/update-charger-status.dto';
import { OperatorService } from './operator.service';

describe('OperatorService', () => {
  let operatorService: OperatorService;
  let prismaService: {
    charger: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    reservation: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let notificationsService: {
    createNotification: jest.Mock;
  };

  beforeEach(() => {
    prismaService = {
      charger: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    notificationsService = {
      createNotification: jest.fn(),
    };

    operatorService = new OperatorService(
      prismaService as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('updates charger status to OFFLINE', async () => {
    prismaService.charger.findUnique.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.AVAILABLE }),
    );
    prismaService.reservation.findMany.mockResolvedValue([]);
    prismaService.charger.update.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    );

    const result = await operatorService.updateChargerStatus(
      buildOperatorUser(),
      'charger-1',
      buildUpdateDto({ status: ChargerStatus.OFFLINE }),
    );

    expect(prismaService.charger.update).toHaveBeenCalledWith({
      where: {
        id: 'charger-1',
      },
      data: {
        status: ChargerStatus.OFFLINE,
      },
    });
    expect(result.updatedCharger.status).toBe(ChargerStatus.OFFLINE);
    expect(result.affectedActiveSessionCount).toBe(0);
    expect(result.cancelledReservationsCount).toBe(0);
  });

  it('cancels confirmed reservations with endTime after now when charger becomes offline', async () => {
    jest
      .spyOn(
        operatorService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));

    prismaService.charger.findUnique.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.AVAILABLE }),
    );
    prismaService.reservation.findMany.mockResolvedValue([
      buildFutureReservation({
        id: 'reservation-1',
        userId: 'user-1',
      }),
      buildFutureReservation({
        id: 'reservation-2',
        userId: 'user-2',
        startTime: new Date('2026-05-03T09:30:00.000Z'),
        endTime: new Date('2026-05-03T10:30:00.000Z'),
      }),
    ]);
    prismaService.reservation.updateMany.mockResolvedValue({ count: 2 });
    prismaService.charger.update.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    );

    const result = await operatorService.updateChargerStatus(
      buildOperatorUser(),
      'charger-1',
      buildUpdateDto({ status: ChargerStatus.OFFLINE }),
    );

    expect(prismaService.reservation.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['reservation-1', 'reservation-2'],
        },
      },
      data: {
        status: ReservationStatus.CANCELLED,
      },
    });
    expect(result.cancelledReservationsCount).toBe(2);
    expect(result.affectedActiveSessionCount).toBe(0);
  });

  it('creates a notification for each affected user', async () => {
    jest
      .spyOn(
        operatorService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));

    prismaService.charger.findUnique.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.AVAILABLE }),
    );
    prismaService.reservation.findMany.mockResolvedValue([
      buildFutureReservation({
        id: 'reservation-1',
        userId: 'user-1',
      }),
    ]);
    prismaService.reservation.updateMany.mockResolvedValue({ count: 1 });
    prismaService.charger.update.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    );

    await operatorService.updateChargerStatus(
      buildOperatorUser(),
      'charger-1',
      buildUpdateDto({ status: ChargerStatus.OFFLINE }),
    );

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'RESERVATION_CANCELLED',
      'Şarj cihazı çevrim dışı olduğu için randevunuz iptal edildi.',
    );
  });

  it('does not cancel confirmed reservations that already have an active charging session', async () => {
    jest
      .spyOn(
        operatorService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));

    prismaService.charger.findUnique.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.AVAILABLE }),
    );
    prismaService.reservation.findMany.mockResolvedValue([
      buildFutureReservation({
        chargingSession: {
          id: 'session-1',
          status: ChargingSessionStatus.ACTIVE,
        },
        endTime: new Date('2026-05-03T12:00:00.000Z'),
        id: 'reservation-1',
        startTime: new Date('2026-05-03T10:15:00.000Z'),
        userId: 'user-1',
      }),
    ]);
    prismaService.charger.update.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    );

    const result = await operatorService.updateChargerStatus(
      buildOperatorUser(),
      'charger-1',
      buildUpdateDto({ status: ChargerStatus.OFFLINE }),
    );

    expect(prismaService.reservation.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
    expect(result.cancelledReservationsCount).toBe(0);
    expect(result.affectedActiveSessionCount).toBe(1);
  });

  it('does not cancel already cancelled reservations again', async () => {
    prismaService.charger.findUnique.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    );
    prismaService.charger.update.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.OFFLINE }),
    );

    const result = await operatorService.updateChargerStatus(
      buildOperatorUser(),
      'charger-1',
      buildUpdateDto({ status: ChargerStatus.OFFLINE }),
    );

    expect(prismaService.reservation.findMany).not.toHaveBeenCalled();
    expect(prismaService.reservation.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
    expect(result.affectedActiveSessionCount).toBe(0);
    expect(result.cancelledReservationsCount).toBe(0);
  });

  it('rejects non-operator charger status updates', async () => {
    await expect(
      operatorService.updateChargerStatus(
        buildOperatorUser({ role: UserRole.EV_DRIVER }),
        'charger-1',
        buildUpdateDto({ status: ChargerStatus.OFFLINE }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing chargers', async () => {
    prismaService.charger.findUnique.mockResolvedValue(null);

    await expect(
      operatorService.updateChargerStatus(
        buildOperatorUser(),
        'charger-1',
        buildUpdateDto({ status: ChargerStatus.OFFLINE }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates charger pricing successfully', async () => {
    prismaService.charger.findUnique.mockResolvedValue(
      buildChargerRecord({ status: ChargerStatus.AVAILABLE }),
    );
    prismaService.charger.update.mockResolvedValue(
      buildChargerRecord({
        pricePerKWh: new Prisma.Decimal(6.5),
        status: ChargerStatus.AVAILABLE,
      }),
    );

    const result = await operatorService.updateChargerPricing(
      buildOperatorUser(),
      'charger-1',
      buildPricingDto({ pricePerKWh: 6.5 }),
    );

    expect(prismaService.charger.update).toHaveBeenCalledWith({
      where: {
        id: 'charger-1',
      },
      data: {
        pricePerKWh: 6.5,
      },
    });
    expect(result.updatedCharger.pricePerKWh).toBe(6.5);
  });

  it('rejects non-operator charger pricing updates', async () => {
    await expect(
      operatorService.updateChargerPricing(
        buildOperatorUser({ role: UserRole.EV_DRIVER }),
        'charger-1',
        buildPricingDto({ pricePerKWh: 6.5 }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function buildOperatorUser(
  overrides?: Partial<JwtUserPayload>,
): JwtUserPayload {
  return {
    sub: overrides?.sub ?? 'operator-1',
    email: overrides?.email ?? 'operator.demo@evcharging.local',
    role: overrides?.role ?? UserRole.OPERATOR,
  };
}

function buildUpdateDto(
  overrides?: Partial<UpdateChargerStatusDto>,
): UpdateChargerStatusDto {
  return {
    status: overrides?.status ?? ChargerStatus.OFFLINE,
  };
}

function buildPricingDto(
  overrides?: Partial<UpdateChargerPricingDto>,
): UpdateChargerPricingDto {
  return {
    pricePerKWh: overrides?.pricePerKWh ?? 4,
  };
}

function buildChargerRecord(overrides?: {
  pricePerKWh?: Prisma.Decimal;
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
    connectorType: ConnectorType.CCS,
    powerOutputKW: new Prisma.Decimal(50),
    pricePerKWh: overrides?.pricePerKWh ?? new Prisma.Decimal(4),
    status: overrides?.status ?? ChargerStatus.AVAILABLE,
    createdAt: new Date('2026-05-03T09:00:00.000Z'),
  };
}

function buildFutureReservation(overrides?: {
  chargingSession?: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
  endTime?: Date;
  id?: string;
  startTime?: Date;
  userId?: string;
}): {
  chargingSession: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
  endTime: Date;
  id: string;
  startTime: Date;
  userId: string;
} {
  return {
    chargingSession: overrides?.chargingSession ?? null,
    endTime: overrides?.endTime ?? new Date('2026-05-03T14:00:00.000Z'),
    id: overrides?.id ?? 'reservation-1',
    startTime:
      overrides?.startTime ?? new Date('2026-05-03T12:00:00.000Z'),
    userId: overrides?.userId ?? 'user-1',
  };
}
