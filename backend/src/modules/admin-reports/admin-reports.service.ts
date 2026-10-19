import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ChargerStatus,
  ChargingSessionStatus,
  PaymentStatus,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import {
  AdminPeakHourReportItem,
  AdminRecentActivityItem,
  AdminReportsOverviewResponse,
  AdminRevenueReport,
  AdminStationBreakdownItem,
  AdminStationUtilizationReport,
  AdminUserActivityReport,
} from './types/admin-reports-response.type';

interface UserRoleRecord {
  role: UserRole;
}

interface StationRecord {
  id: string;
  name: string;
  chargers: Array<{
    status: ChargerStatus;
  }>;
}

interface ReservationRecord {
  id: string;
  status: ReservationStatus;
  createdAt: Date;
  startTime: Date;
  endTime: Date;
  stationId: string;
  station: {
    id: string;
    name: string;
  };
  charger: {
    label: string;
  };
}

interface ChargingSessionRecord {
  id: string;
  status: ChargingSessionStatus;
  paymentStatus: PaymentStatus;
  totalCost: { toString(): string } | null;
  createdAt: Date;
  paidAt: Date | null;
  reservation: {
    stationId: string;
    station: {
      id: string;
      name: string;
    };
    charger: {
      label: string;
    };
  };
}

interface CancellationNotificationRecord {
  createdAt: Date;
  message: string;
}

@Injectable()
export class AdminReportsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOverview(
    currentUser: JwtUserPayload,
  ): Promise<AdminReportsOverviewResponse> {
    this.assertAdminAccess(currentUser.role);

    const [
      users,
      vehicleCount,
      stations,
      reservations,
      sessions,
      cancellationNotifications,
    ] = await Promise.all([
      this.prismaService.user.findMany({
        select: {
          role: true,
        },
      }),
      this.prismaService.vehicle.count(),
      this.prismaService.station.findMany({
        include: {
          chargers: {
            select: {
              status: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prismaService.reservation.findMany({
        include: {
          station: {
            select: {
              id: true,
              name: true,
            },
          },
          charger: {
            select: {
              label: true,
            },
          },
        },
      }),
      this.prismaService.chargingSession.findMany({
        include: {
          reservation: {
            select: {
              stationId: true,
              station: {
                select: {
                  id: true,
                  name: true,
                },
              },
              charger: {
                select: {
                  label: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.notification.findMany({
        where: {
          type: 'RESERVATION_CANCELLED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          createdAt: true,
          message: true,
        },
      }),
    ]);

    const revenue = this.buildRevenueReport(sessions);
    const stationUtilization = this.buildStationUtilizationReport(stations);
    const userActivity = this.buildUserActivityReport(
      users,
      vehicleCount,
      reservations,
      revenue,
    );
    const peakHours = this.buildPeakHoursReport(reservations, sessions);
    const stationBreakdown = this.buildStationBreakdown(
      stations,
      reservations,
      sessions,
    );
    const recentActivity = this.buildRecentActivity(
      reservations,
      sessions,
      cancellationNotifications,
    );

    return {
      revenue,
      stationUtilization,
      userActivity,
      peakHours,
      stationBreakdown,
      recentActivity,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildRevenueReport(
    sessions: ChargingSessionRecord[],
  ): AdminRevenueReport {
    let totalPaidRevenue = 0;
    let grossCompletedValue = 0;
    let pendingReceivables = 0;
    let completedSessionCount = 0;
    let paidSessionCount = 0;

    for (const session of sessions) {
      const totalCost = this.toNullableNumber(session.totalCost) ?? 0;

      if (session.status === ChargingSessionStatus.COMPLETED) {
        completedSessionCount += 1;
        grossCompletedValue += totalCost;

        if (session.paymentStatus !== PaymentStatus.PAID) {
          pendingReceivables += totalCost;
        }
      }

      if (session.paymentStatus === PaymentStatus.PAID) {
        paidSessionCount += 1;
        totalPaidRevenue += totalCost;
      }
    }

    return {
      totalPaidRevenue: this.roundToTwoDecimals(totalPaidRevenue),
      grossCompletedValue: this.roundToTwoDecimals(grossCompletedValue),
      pendingReceivables: this.roundToTwoDecimals(pendingReceivables),
      completedSessionCount,
      paidSessionCount,
      averageRevenuePerPaidSession:
        paidSessionCount > 0
          ? this.roundToTwoDecimals(totalPaidRevenue / paidSessionCount)
          : 0,
    };
  }

  private buildStationUtilizationReport(
    stations: StationRecord[],
  ): AdminStationUtilizationReport {
    let totalChargers = 0;
    let availableChargers = 0;
    let occupiedChargers = 0;
    let offlineChargers = 0;

    for (const station of stations) {
      totalChargers += station.chargers.length;

      for (const charger of station.chargers) {
        if (charger.status === ChargerStatus.AVAILABLE) {
          availableChargers += 1;
        }

        if (charger.status === ChargerStatus.OCCUPIED) {
          occupiedChargers += 1;
        }

        if (charger.status === ChargerStatus.OFFLINE) {
          offlineChargers += 1;
        }
      }
    }

    return {
      totalStations: stations.length,
      totalChargers,
      availableChargers,
      occupiedChargers,
      offlineChargers,
      utilizationRate:
        totalChargers > 0
          ? this.roundToTwoDecimals((occupiedChargers / totalChargers) * 100)
          : 0,
    };
  }

  private buildUserActivityReport(
    users: UserRoleRecord[],
    vehicleCount: number,
    reservations: ReservationRecord[],
    revenue: AdminRevenueReport,
  ): AdminUserActivityReport {
    let driverCount = 0;
    let operatorCount = 0;
    let adminCount = 0;
    let completedReservationCount = 0;
    let cancelledReservationCount = 0;

    for (const user of users) {
      if (user.role === UserRole.EV_DRIVER) {
        driverCount += 1;
      }

      if (user.role === UserRole.OPERATOR) {
        operatorCount += 1;
      }

      if (user.role === UserRole.ADMIN) {
        adminCount += 1;
      }
    }

    for (const reservation of reservations) {
      if (reservation.status === ReservationStatus.COMPLETED) {
        completedReservationCount += 1;
      }

      if (reservation.status === ReservationStatus.CANCELLED) {
        cancelledReservationCount += 1;
      }
    }

    return {
      totalUsers: users.length,
      driverCount,
      operatorCount,
      adminCount,
      vehicleCount,
      reservationCount: reservations.length,
      completedReservationCount,
      cancelledReservationCount,
      completedSessionCount: revenue.completedSessionCount,
      paidSessionCount: revenue.paidSessionCount,
    };
  }

  private buildPeakHoursReport(
    reservations: ReservationRecord[],
    sessions: ChargingSessionRecord[],
  ): AdminPeakHourReportItem[] {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      reservationCount: 0,
      sessionCount: 0,
    }));

    for (const reservation of reservations) {
      const hour = this.getIstanbulHour(reservation.startTime);
      buckets[hour].reservationCount += 1;
    }

    for (const session of sessions) {
      const hour = this.getIstanbulHour(session.createdAt);
      buckets[hour].sessionCount += 1;
    }

    return buckets;
  }

  private buildStationBreakdown(
    stations: StationRecord[],
    reservations: ReservationRecord[],
    sessions: ChargingSessionRecord[],
  ): AdminStationBreakdownItem[] {
    const breakdownByStationId = stations.reduce<
      Record<string, AdminStationBreakdownItem>
    >((accumulator, station) => {
      let availableChargers = 0;
      let occupiedChargers = 0;
      let offlineChargers = 0;

      for (const charger of station.chargers) {
        if (charger.status === ChargerStatus.AVAILABLE) {
          availableChargers += 1;
        }

        if (charger.status === ChargerStatus.OCCUPIED) {
          occupiedChargers += 1;
        }

        if (charger.status === ChargerStatus.OFFLINE) {
          offlineChargers += 1;
        }
      }

      accumulator[station.id] = {
        stationId: station.id,
        stationName: station.name,
        totalChargers: station.chargers.length,
        availableChargers,
        occupiedChargers,
        offlineChargers,
        reservationCount: 0,
        completedSessionCount: 0,
        revenue: 0,
        reservedHours: 0,
      };

      return accumulator;
    }, {});

    for (const reservation of reservations) {
      const stationBreakdown = breakdownByStationId[reservation.stationId];

      if (!stationBreakdown) {
        continue;
      }

      stationBreakdown.reservationCount += 1;

      if (reservation.status !== ReservationStatus.CANCELLED) {
        const reservationHours =
          (reservation.endTime.getTime() - reservation.startTime.getTime()) /
          (1000 * 60 * 60);
        stationBreakdown.reservedHours += reservationHours;
      }
    }

    for (const session of sessions) {
      const stationBreakdown =
        breakdownByStationId[session.reservation.stationId];

      if (!stationBreakdown) {
        continue;
      }

      if (session.status === ChargingSessionStatus.COMPLETED) {
        stationBreakdown.completedSessionCount += 1;
      }

      if (session.paymentStatus === PaymentStatus.PAID) {
        stationBreakdown.revenue += this.toNullableNumber(session.totalCost) ?? 0;
      }
    }

    return Object.values(breakdownByStationId).map((stationBreakdown) => ({
      ...stationBreakdown,
      revenue: this.roundToTwoDecimals(stationBreakdown.revenue),
      reservedHours: this.roundToTwoDecimals(stationBreakdown.reservedHours),
    }));
  }

  private buildRecentActivity(
    reservations: ReservationRecord[],
    sessions: ChargingSessionRecord[],
    cancellationNotifications: CancellationNotificationRecord[],
  ): AdminRecentActivityItem[] {
    const paymentActivity = sessions
      .filter(
        (session) =>
          session.paymentStatus === PaymentStatus.PAID && session.paidAt,
      )
      .map<AdminRecentActivityItem>((session) => ({
        type: 'PAYMENT',
        title: 'Ödeme onaylandı',
        description: `${session.reservation.station.name} · ${session.reservation.charger.label} için tahsilat tamamlandı.`,
        amount: this.toNullableNumber(session.totalCost),
        createdAt: session.paidAt!.toISOString(),
      }));

    const sessionActivity = sessions
      .filter((session) => session.status === ChargingSessionStatus.COMPLETED)
      .map<AdminRecentActivityItem>((session) => ({
        type: 'SESSION',
        title: 'Şarj oturumu tamamlandı',
        description: `${session.reservation.station.name} · ${session.reservation.charger.label} oturumu kapatıldı.`,
        amount: this.toNullableNumber(session.totalCost),
        createdAt: session.createdAt.toISOString(),
      }));

    const reservationActivity = reservations
      .filter((reservation) => reservation.status !== ReservationStatus.CANCELLED)
      .map<AdminRecentActivityItem>((reservation) => ({
        type: 'RESERVATION',
        title: 'Yeni randevu oluşturuldu',
        description: `${reservation.station.name} · ${reservation.charger.label} için yeni rezervasyon kaydı oluşturuldu.`,
        amount: null,
        createdAt: reservation.createdAt.toISOString(),
      }));

    const cancellationActivity = cancellationNotifications.map<AdminRecentActivityItem>(
      (notification) => ({
        type: 'CANCELLATION',
        title: 'Randevu iptal edildi',
        description: notification.message,
        amount: null,
        createdAt: notification.createdAt.toISOString(),
      }),
    );

    return [
      ...paymentActivity,
      ...sessionActivity,
      ...reservationActivity,
      ...cancellationActivity,
    ]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .slice(0, 12);
  }

  private assertAdminAccess(role: UserRole): void {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only administrators can access management reports.',
      );
    }
  }

  private getIstanbulHour(date: Date): number {
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Europe/Istanbul',
      }).format(date),
    );
  }

  private toNullableNumber(value: { toString(): string } | null): number | null {
    if (!value) {
      return null;
    }

    return Number(value.toString());
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
