import { ForbiddenException } from '@nestjs/common';
import {
  ChargerStatus,
  ChargingSessionStatus,
  PaymentStatus,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { AdminReportsService } from './admin-reports.service';

describe('AdminReportsService', () => {
  let adminReportsService: AdminReportsService;
  let prismaService: {
    user: {
      findMany: jest.Mock;
    };
    vehicle: {
      count: jest.Mock;
    };
    station: {
      findMany: jest.Mock;
    };
    reservation: {
      findMany: jest.Mock;
    };
    chargingSession: {
      findMany: jest.Mock;
    };
    notification: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      user: {
        findMany: jest.fn(),
      },
      vehicle: {
        count: jest.fn(),
      },
      station: {
        findMany: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
      },
      chargingSession: {
        findMany: jest.fn(),
      },
      notification: {
        findMany: jest.fn(),
      },
    };

    adminReportsService = new AdminReportsService(
      prismaService as unknown as PrismaService,
    );
  });

  it('returns a safe empty overview for administrators', async () => {
    mockEmptyState();

    const result = await adminReportsService.getOverview(buildAdminUser());

    expect(result.revenue).toEqual({
      totalPaidRevenue: 0,
      grossCompletedValue: 0,
      pendingReceivables: 0,
      completedSessionCount: 0,
      paidSessionCount: 0,
      averageRevenuePerPaidSession: 0,
    });
    expect(result.stationUtilization.totalStations).toBe(0);
    expect(result.userActivity.totalUsers).toBe(0);
    expect(result.peakHours).toHaveLength(24);
    expect(result.recentActivity).toEqual([]);
  });

  it('rejects non-admin access', async () => {
    mockEmptyState();

    await expect(
      adminReportsService.getOverview(buildJwtUser({ role: UserRole.EV_DRIVER })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      adminReportsService.getOverview(buildJwtUser({ role: UserRole.OPERATOR })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('calculates revenue, utilization, peak hours, and role counts correctly', async () => {
    prismaService.user.findMany.mockResolvedValue([
      { role: UserRole.ADMIN },
      { role: UserRole.OPERATOR },
      { role: UserRole.EV_DRIVER },
      { role: UserRole.EV_DRIVER },
    ]);
    prismaService.vehicle.count.mockResolvedValue(3);
    prismaService.station.findMany.mockResolvedValue([
      {
        id: 'station-1',
        name: 'Alsancak Hub',
        chargers: [
          { status: ChargerStatus.AVAILABLE },
          { status: ChargerStatus.OCCUPIED },
        ],
      },
      {
        id: 'station-2',
        name: 'Bornova Park',
        chargers: [{ status: ChargerStatus.OFFLINE }],
      },
    ]);
    prismaService.reservation.findMany.mockResolvedValue([
      buildReservation({
        stationId: 'station-1',
        stationName: 'Alsancak Hub',
        startTime: new Date('2026-05-11T05:00:00.000Z'),
        endTime: new Date('2026-05-11T07:00:00.000Z'),
        status: ReservationStatus.COMPLETED,
      }),
      buildReservation({
        id: 'reservation-2',
        stationId: 'station-1',
        stationName: 'Alsancak Hub',
        startTime: new Date('2026-05-11T05:30:00.000Z'),
        endTime: new Date('2026-05-11T06:30:00.000Z'),
        status: ReservationStatus.CANCELLED,
      }),
    ]);
    prismaService.chargingSession.findMany.mockResolvedValue([
      buildChargingSession({
        createdAt: new Date('2026-05-11T05:20:00.000Z'),
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date('2026-05-11T06:40:00.000Z'),
        stationId: 'station-1',
        stationName: 'Alsancak Hub',
        status: ChargingSessionStatus.COMPLETED,
        totalCost: '180',
      }),
      buildChargingSession({
        id: 'session-2',
        createdAt: new Date('2026-05-11T09:20:00.000Z'),
        paymentStatus: PaymentStatus.PENDING,
        stationId: 'station-2',
        stationName: 'Bornova Park',
        status: ChargingSessionStatus.COMPLETED,
        totalCost: '90',
      }),
    ]);
    prismaService.notification.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-05-11T08:00:00.000Z'),
        message: 'Bir rezervasyon çevrim dışı cihaz nedeniyle iptal edildi.',
      },
    ]);

    const result = await adminReportsService.getOverview(buildAdminUser());

    expect(result.revenue).toEqual({
      totalPaidRevenue: 180,
      grossCompletedValue: 270,
      pendingReceivables: 90,
      completedSessionCount: 2,
      paidSessionCount: 1,
      averageRevenuePerPaidSession: 180,
    });
    expect(result.stationUtilization).toEqual({
      totalStations: 2,
      totalChargers: 3,
      availableChargers: 1,
      occupiedChargers: 1,
      offlineChargers: 1,
      utilizationRate: 33.33,
    });
    expect(result.userActivity).toEqual({
      totalUsers: 4,
      driverCount: 2,
      operatorCount: 1,
      adminCount: 1,
      vehicleCount: 3,
      reservationCount: 2,
      completedReservationCount: 1,
      cancelledReservationCount: 1,
      completedSessionCount: 2,
      paidSessionCount: 1,
    });
    expect(result.peakHours.find((item) => item.hour === '08:00')).toMatchObject({
      reservationCount: 2,
      sessionCount: 1,
    });
    expect(result.peakHours.find((item) => item.hour === '12:00')).toMatchObject({
      reservationCount: 0,
      sessionCount: 1,
    });
    expect(result.stationBreakdown).toEqual([
      {
        stationId: 'station-1',
        stationName: 'Alsancak Hub',
        totalChargers: 2,
        availableChargers: 1,
        occupiedChargers: 1,
        offlineChargers: 0,
        reservationCount: 2,
        completedSessionCount: 1,
        revenue: 180,
        reservedHours: 2,
      },
      {
        stationId: 'station-2',
        stationName: 'Bornova Park',
        totalChargers: 1,
        availableChargers: 0,
        occupiedChargers: 0,
        offlineChargers: 1,
        reservationCount: 0,
        completedSessionCount: 1,
        revenue: 0,
        reservedHours: 0,
      },
    ]);
    expect(result.recentActivity[0]).toMatchObject({
      type: 'SESSION',
      title: 'Şarj oturumu tamamlandı',
    });
    expect(result.recentActivity.some((item) => item.type === 'PAYMENT')).toBe(true);
    expect(result.recentActivity.some((item) => item.type === 'CANCELLATION')).toBe(true);
  });

  function mockEmptyState(): void {
    prismaService.user.findMany.mockResolvedValue([]);
    prismaService.vehicle.count.mockResolvedValue(0);
    prismaService.station.findMany.mockResolvedValue([]);
    prismaService.reservation.findMany.mockResolvedValue([]);
    prismaService.chargingSession.findMany.mockResolvedValue([]);
    prismaService.notification.findMany.mockResolvedValue([]);
  }
});

function buildJwtUser(
  overrides?: Partial<JwtUserPayload>,
): JwtUserPayload {
  return {
    sub: overrides?.sub ?? 'user-1',
    email: overrides?.email ?? 'admin@evcharging.local',
    role: overrides?.role ?? UserRole.ADMIN,
  };
}

function buildAdminUser(): JwtUserPayload {
  return buildJwtUser({ role: UserRole.ADMIN });
}

function buildReservation(overrides?: {
  id?: string;
  stationId?: string;
  stationName?: string;
  startTime?: Date;
  endTime?: Date;
  status?: ReservationStatus;
}): {
  id: string;
  status: ReservationStatus;
  createdAt: Date;
  startTime: Date;
  endTime: Date;
  stationId: string;
  station: { id: string; name: string };
  charger: { label: string };
} {
  return {
    id: overrides?.id ?? 'reservation-1',
    status: overrides?.status ?? ReservationStatus.CONFIRMED,
    createdAt: new Date('2026-05-11T05:10:00.000Z'),
    startTime: overrides?.startTime ?? new Date('2026-05-11T05:00:00.000Z'),
    endTime: overrides?.endTime ?? new Date('2026-05-11T07:00:00.000Z'),
    stationId: overrides?.stationId ?? 'station-1',
    station: {
      id: overrides?.stationId ?? 'station-1',
      name: overrides?.stationName ?? 'Alsancak Hub',
    },
    charger: {
      label: 'DC 50kW #01',
    },
  };
}

function buildChargingSession(overrides?: {
  id?: string;
  status?: ChargingSessionStatus;
  paymentStatus?: PaymentStatus;
  totalCost?: string | null;
  createdAt?: Date;
  paidAt?: Date | null;
  stationId?: string;
  stationName?: string;
}): {
  id: string;
  status: ChargingSessionStatus;
  paymentStatus: PaymentStatus;
  totalCost: { toString(): string } | null;
  createdAt: Date;
  paidAt: Date | null;
  reservation: {
    stationId: string;
    station: { id: string; name: string };
    charger: { label: string };
  };
} {
  return {
    id: overrides?.id ?? 'session-1',
    status: overrides?.status ?? ChargingSessionStatus.COMPLETED,
    paymentStatus: overrides?.paymentStatus ?? PaymentStatus.PAID,
    totalCost: overrides?.totalCost === null
      ? null
      : {
          toString: () => overrides?.totalCost ?? '180',
        },
    createdAt: overrides?.createdAt ?? new Date('2026-05-11T05:20:00.000Z'),
    paidAt: overrides?.paidAt ?? new Date('2026-05-11T06:40:00.000Z'),
    reservation: {
      stationId: overrides?.stationId ?? 'station-1',
      station: {
        id: overrides?.stationId ?? 'station-1',
        name: overrides?.stationName ?? 'Alsancak Hub',
      },
      charger: {
        label: 'DC 50kW #01',
      },
    },
  };
}
