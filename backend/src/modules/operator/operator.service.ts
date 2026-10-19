import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChargingSessionStatus,
  ChargerStatus,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateChargerPricingDto } from './dto/update-charger-pricing.dto';
import { UpdateChargerStatusDto } from './dto/update-charger-status.dto';
import {
  OperatorChargerResponse,
  OperatorChargerPricingUpdateResponse,
  OperatorChargerStatusUpdateResponse,
} from './types/operator-charger-response.type';

interface ChargerRecord {
  id: string;
  stationId: string;
  label: string;
  chargerType: OperatorChargerResponse['chargerType'];
  connectorType: OperatorChargerResponse['connectorType'];
  powerOutputKW: { toString(): string };
  pricePerKWh: { toString(): string };
  status: OperatorChargerResponse['status'];
  createdAt: Date;
}

interface FutureReservationRecord {
  id: string;
  userId: string;
  endTime: Date;
  startTime: Date;
  chargingSession: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
}

@Injectable()
export class OperatorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async updateChargerStatus(
    currentUser: JwtUserPayload,
    chargerId: string,
    dto: UpdateChargerStatusDto,
  ): Promise<OperatorChargerStatusUpdateResponse> {
    this.assertOperatorAccess(currentUser.role);

    const charger = await this.prismaService.charger.findUnique({
      where: {
        id: chargerId,
      },
    });

    if (!charger) {
      throw new NotFoundException('Charger not found.');
    }

    let cancelledReservationsCount = 0;
    let affectedActiveSessionCount = 0;

    if (
      dto.status === ChargerStatus.OFFLINE &&
      charger.status !== ChargerStatus.OFFLINE
    ) {
      const impactSummary = await this.cancelAffectedConfirmedReservations(
        charger.id,
      );
      cancelledReservationsCount = impactSummary.cancelledReservationsCount;
      affectedActiveSessionCount = impactSummary.affectedActiveSessionCount;
    }

    const updatedCharger = await this.prismaService.charger.update({
      where: {
        id: chargerId,
      },
      data: {
        status: dto.status,
      },
    });

    return {
      updatedCharger: this.toOperatorChargerResponse(updatedCharger),
      affectedActiveSessionCount,
      cancelledReservationsCount,
    };
  }

  async updateChargerPricing(
    currentUser: JwtUserPayload,
    chargerId: string,
    dto: UpdateChargerPricingDto,
  ): Promise<OperatorChargerPricingUpdateResponse> {
    this.assertOperatorAccess(currentUser.role);

    const charger = await this.prismaService.charger.findUnique({
      where: {
        id: chargerId,
      },
    });

    if (!charger) {
      throw new NotFoundException('Charger not found.');
    }

    const updatedCharger = await this.prismaService.charger.update({
      where: {
        id: chargerId,
      },
      data: {
        pricePerKWh: dto.pricePerKWh,
      },
    });

    return {
      updatedCharger: this.toOperatorChargerResponse(updatedCharger),
    };
  }

  private async cancelAffectedConfirmedReservations(
    chargerId: string,
  ): Promise<{
    affectedActiveSessionCount: number;
    cancelledReservationsCount: number;
  }> {
    const currentDate = this.getCurrentDate();
    const affectedReservations = await this.prismaService.reservation.findMany({
      where: {
        chargerId,
        status: ReservationStatus.CONFIRMED,
        endTime: {
          gt: currentDate,
        },
      },
      select: {
        chargingSession: {
          select: {
            id: true,
            status: true,
          },
        },
        endTime: true,
        id: true,
        userId: true,
        startTime: true,
      },
    });

    if (affectedReservations.length === 0) {
      return {
        affectedActiveSessionCount: 0,
        cancelledReservationsCount: 0,
      };
    }

    const reservationsWithActiveSession = affectedReservations.filter(
      (reservation) =>
        reservation.chargingSession?.status === ChargingSessionStatus.ACTIVE,
    );
    const reservationsToCancel = affectedReservations.filter(
      (reservation) =>
        reservation.chargingSession?.status !== ChargingSessionStatus.ACTIVE,
    );

    if (reservationsToCancel.length === 0) {
      return {
        affectedActiveSessionCount: reservationsWithActiveSession.length,
        cancelledReservationsCount: 0,
      };
    }

    await this.prismaService.reservation.updateMany({
      where: {
        id: {
          in: reservationsToCancel.map((reservation) => reservation.id),
        },
      },
      data: {
        status: ReservationStatus.CANCELLED,
      },
    });

    await Promise.all(
      reservationsToCancel.map((reservation) =>
        this.notificationsService.createNotification(
          reservation.userId,
          'RESERVATION_CANCELLED',
          'Şarj cihazı çevrim dışı olduğu için randevunuz iptal edildi.',
        ),
      ),
    );

    return {
      affectedActiveSessionCount: reservationsWithActiveSession.length,
      cancelledReservationsCount: reservationsToCancel.length,
    };
  }

  private assertOperatorAccess(role: UserRole): void {
    if (role !== UserRole.OPERATOR && role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only operators can update charger status.',
      );
    }
  }

  private toOperatorChargerResponse(
    charger: ChargerRecord,
  ): OperatorChargerResponse {
    return {
      id: charger.id,
      stationId: charger.stationId,
      label: charger.label,
      chargerType: charger.chargerType,
      connectorType: charger.connectorType,
      powerOutputKW: this.toNumber(charger.powerOutputKW),
      pricePerKWh: this.toNumber(charger.pricePerKWh),
      status: charger.status,
      createdAt: charger.createdAt.toISOString(),
    };
  }

  private toNumber(value: { toString(): string }): number {
    return Number(value.toString());
  }

  private getCurrentDate(): Date {
    return new Date();
  }
}
