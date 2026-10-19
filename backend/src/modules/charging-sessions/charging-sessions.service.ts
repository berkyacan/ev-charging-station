import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ChargerStatus,
  ChargingSessionStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createChargingSessionSummary,
} from './domain/charging-session-summary';
import { CompleteChargingSessionDto } from './dto/complete-charging-session.dto';
import { PayChargingSessionDto } from './dto/pay-charging-session.dto';
import { StartChargingSessionDto } from './dto/start-charging-session.dto';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ChargingSessionChargerInfo,
  ChargingSessionPaymentResponse,
  ChargingSessionStationInfo,
  ChargingSessionSummaryResponse,
} from './types/charging-session-response.type';

interface StationRecord {
  id: string;
  name: string;
  address: string;
  latitude: { toString(): string };
  longitude: { toString(): string };
  operatingHours: string;
}

interface ChargerRecord {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargingSessionChargerInfo['chargerType'];
  connectorType: ChargingSessionChargerInfo['connectorType'];
  powerOutputKW: { toString(): string };
  pricePerKWh: { toString(): string };
  status: ChargingSessionChargerInfo['status'];
}

interface ReservationRecord {
  id: string;
  userId: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
  charger: ChargerRecord;
  station: StationRecord;
  chargingSession?: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
}

interface ChargingSessionRecord {
  id: string;
  reservationId: string;
  startEnergyKWh: { toString(): string } | null;
  endEnergyKWh: { toString(): string } | null;
  consumedKWh: { toString(): string } | null;
  pricePerKWh: { toString(): string };
  totalCost: { toString(): string } | null;
  status: ChargingSessionStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  transactionId: string | null;
  receiptNumber: string | null;
  paidAt: Date | null;
  walletBalanceBeforePayment: { toString(): string } | null;
  walletBalanceAfterPayment: { toString(): string } | null;
  createdAt: Date;
  reservation: {
    id: string;
    userId: string;
    status: ReservationStatus;
    charger: ChargerRecord;
    station: StationRecord;
  };
}

@Injectable()
export class ChargingSessionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startSessionForUser(
    userId: string,
    dto: StartChargingSessionDto,
  ): Promise<ChargingSessionSummaryResponse> {
    const session = await this.prismaService.$transaction(async (transactionClient) => {
      const reservation = await transactionClient.reservation.findFirst({
        where: {
          id: dto.reservationId,
          userId,
        },
        include: {
          charger: true,
          station: true,
          chargingSession: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found.');
      }

      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new DomainValidationException(
          'Only confirmed reservations can start a charging session.',
          'RESERVATION_NOT_CONFIRMABLE_FOR_START',
        );
      }

      const now = this.getCurrentDate();

      if (now.getTime() < reservation.startTime.getTime()) {
        throw new DomainValidationException(
          'Şarj oturumu randevu başlangıç saatinden önce başlatılamaz.',
          'CHARGING_SESSION_BEFORE_RESERVATION_START',
          {
            reservationEndTime: reservation.endTime.toISOString(),
            reservationStartTime: reservation.startTime.toISOString(),
          },
        );
      }

      if (now.getTime() >= reservation.endTime.getTime()) {
        throw new DomainValidationException(
          'Randevu süresi sona erdiği için şarj oturumu başlatılamaz.',
          'CHARGING_SESSION_AFTER_RESERVATION_END',
          {
            reservationEndTime: reservation.endTime.toISOString(),
            reservationStartTime: reservation.startTime.toISOString(),
          },
        );
      }

      if (reservation.chargingSession) {
        throw new DomainValidationException(
          'A charging session has already been started for this reservation.',
          'CHARGING_SESSION_ALREADY_EXISTS',
        );
      }

      const activeSession = await transactionClient.chargingSession.findFirst({
        where: {
          status: ChargingSessionStatus.ACTIVE,
          reservation: {
            is: {
              userId,
            },
          },
        },
      });

      if (activeSession) {
        throw new DomainValidationException(
          'Only one active charging session is allowed at a time.',
          'ACTIVE_CHARGING_SESSION_EXISTS',
        );
      }

      const createdSession = await transactionClient.chargingSession.create({
        data: {
          reservationId: reservation.id,
          startEnergyKWh: null,
          endEnergyKWh: null,
          consumedKWh: null,
          pricePerKWh: reservation.charger.pricePerKWh,
          totalCost: null,
          status: ChargingSessionStatus.ACTIVE,
        },
      });

      await transactionClient.charger.update({
        where: {
          id: reservation.charger.id,
        },
        data: {
          status: ChargerStatus.OCCUPIED,
        },
      });

      const hydratedSession = await transactionClient.chargingSession.findFirst({
        where: {
          id: createdSession.id,
          reservation: {
            is: {
              userId,
            },
          },
        },
        include: this.chargingSessionInclude,
      });

      if (!hydratedSession) {
        throw new NotFoundException('Charging session not found.');
      }

      return hydratedSession;
    });

    return this.toChargingSessionSummaryResponse(session);
  }

  async completeSessionForUser(
    userId: string,
    sessionId: string,
    dto: CompleteChargingSessionDto,
  ): Promise<ChargingSessionSummaryResponse> {
    const updatedSession = await this.prismaService.$transaction(async (transactionClient) => {
      const existingSession = await transactionClient.chargingSession.findFirst({
        where: {
          id: sessionId,
          reservation: {
            is: {
              userId,
            },
          },
        },
        include: this.chargingSessionInclude,
      });

      if (!existingSession) {
        throw new NotFoundException('Charging session not found.');
      }

      if (existingSession.status !== ChargingSessionStatus.ACTIVE) {
        throw new DomainValidationException(
          'Only active charging sessions can be completed.',
          'CHARGING_SESSION_NOT_ACTIVE',
        );
      }

      const pricePerKWh = this.toNumber(existingSession.pricePerKWh);
      const summaryResult = createChargingSessionSummary(
        dto.startEnergyKWh,
        dto.endEnergyKWh,
        pricePerKWh,
      );

      if (!summaryResult.isValid) {
        const errorMessages = summaryResult.errors.map((error) => error.message);

        throw new DomainValidationException(
          errorMessages.join('; '),
          'CHARGING_SESSION_VALIDATION_FAILED',
          {
            errors: errorMessages,
            validationErrors: summaryResult.errors,
          },
        );
      }

      await transactionClient.chargingSession.update({
        where: {
          id: sessionId,
        },
        data: {
          startEnergyKWh: summaryResult.summary.startEnergyKWh,
          endEnergyKWh: summaryResult.summary.endEnergyKWh,
          consumedKWh: summaryResult.summary.consumedKWh,
          totalCost: summaryResult.summary.totalCost,
          status: ChargingSessionStatus.COMPLETED,
        },
      });

      await transactionClient.reservation.update({
        where: {
          id: existingSession.reservationId,
        },
        data: {
          status: ReservationStatus.COMPLETED,
        },
      });

      await transactionClient.charger.updateMany({
        where: {
          id: existingSession.reservation.charger.id,
          status: ChargerStatus.OCCUPIED,
        },
        data: {
          status: ChargerStatus.AVAILABLE,
        },
      });

      const hydratedSession = await transactionClient.chargingSession.findFirst({
        where: {
          id: sessionId,
          reservation: {
            is: {
              userId,
            },
          },
        },
        include: this.chargingSessionInclude,
      });

      if (!hydratedSession) {
        throw new NotFoundException('Charging session not found.');
      }

      return hydratedSession;
    });

    await this.notificationsService.createNotification(
      userId,
      'CHARGING_SESSION_COMPLETED',
      `Şarj oturumu tamamlandı. Toplam tutar: ${updatedSession.totalCost?.toString() ?? '0'} TL.`,
    );

    return this.toChargingSessionSummaryResponse(updatedSession);
  }

  async confirmPaymentForUser(
    userId: string,
    sessionId: string,
    dto: PayChargingSessionDto,
  ): Promise<ChargingSessionPaymentResponse> {
    const paymentResult = await this.prismaService.$transaction(async (transactionClient) => {
      const existingSession = await transactionClient.chargingSession.findFirst({
        where: {
          id: sessionId,
          reservation: {
            is: {
              userId,
            },
          },
        },
        include: this.chargingSessionInclude,
      });

      if (!existingSession) {
        throw new NotFoundException('Charging session not found.');
      }

      if (existingSession.status !== ChargingSessionStatus.COMPLETED) {
        throw new DomainValidationException(
          'Only completed charging sessions can be paid.',
          'CHARGING_SESSION_NOT_COMPLETED_FOR_PAYMENT',
        );
      }

      if (
        existingSession.paymentStatus === PaymentStatus.PAID &&
        existingSession.paymentMethod &&
        existingSession.transactionId &&
        existingSession.receiptNumber &&
        existingSession.paidAt
      ) {
        return {
          session: existingSession,
          wasAlreadyPaid: true,
        };
      }

      const user = await transactionClient.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const totalCost = this.toNullableNumber(existingSession.totalCost);

      if (totalCost === null) {
        throw new DomainValidationException(
          'Charging session total cost is not available yet.',
          'CHARGING_SESSION_TOTAL_COST_NOT_READY',
        );
      }

      const walletBalanceBeforePayment = Number(user.demoWalletBalance.toString());
      let walletBalanceAfterPayment = walletBalanceBeforePayment;

      if (dto.paymentMethod === PaymentMethod.DEMO_WALLET) {
        if (walletBalanceBeforePayment < totalCost) {
          throw new DomainValidationException(
            'Insufficient wallet balance. Please top up your wallet.',
            'INSUFFICIENT_WALLET_BALANCE',
            {
              walletBalance: walletBalanceBeforePayment,
              totalCost,
            },
          );
        }

        walletBalanceAfterPayment = this.roundToTwoDecimals(
          walletBalanceBeforePayment - totalCost,
        );

        await transactionClient.user.update({
          where: {
            id: userId,
          },
          data: {
            demoWalletBalance: walletBalanceAfterPayment,
          },
        });
      }

      const paymentTime = new Date(Date.now());
      const { transactionId, receiptNumber } =
        this.createSimulatedPaymentIdentifiers(paymentTime, existingSession.id);

      await transactionClient.chargingSession.update({
        where: {
          id: sessionId,
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: dto.paymentMethod,
          transactionId,
          receiptNumber,
          paidAt: paymentTime,
          walletBalanceBeforePayment,
          walletBalanceAfterPayment,
        },
      });

      const hydratedSession = await transactionClient.chargingSession.findFirst({
        where: {
          id: sessionId,
          reservation: {
            is: {
              userId,
            },
          },
        },
        include: this.chargingSessionInclude,
      });

      if (!hydratedSession) {
        throw new NotFoundException('Charging session not found.');
      }

      return {
        session: hydratedSession,
        wasAlreadyPaid: false,
      };
    });

    if (!paymentResult.wasAlreadyPaid) {
      await this.notificationsService.createNotification(
        userId,
        'PAYMENT_CONFIRMED',
        `Payment confirmed. Receipt number: ${paymentResult.session.receiptNumber ?? '-'}.`,
      );
    }

    return this.toPaymentResponse(paymentResult.session);
  }

  async getSessionSummaryForUser(
    userId: string,
    sessionId: string,
  ): Promise<ChargingSessionSummaryResponse> {
    const session = await this.prismaService.chargingSession.findFirst({
      where: {
        id: sessionId,
        reservation: {
          is: {
            userId,
          },
        },
      },
      include: this.chargingSessionInclude,
    });

    if (!session) {
      throw new NotFoundException('Charging session not found.');
    }

    return this.toChargingSessionSummaryResponse(session);
  }

  async getActiveSessionForUser(
    userId: string,
  ): Promise<ChargingSessionSummaryResponse | null> {
    const activeSession = await this.prismaService.chargingSession.findFirst({
      where: {
        status: ChargingSessionStatus.ACTIVE,
        reservation: {
          is: {
            userId,
          },
        },
      },
      include: this.chargingSessionInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return activeSession
      ? this.toChargingSessionSummaryResponse(activeSession)
      : null;
  }

  async getCompletedHistoryForUser(
    userId: string,
  ): Promise<ChargingSessionSummaryResponse[]> {
    const sessions = await this.prismaService.chargingSession.findMany({
      where: {
        status: ChargingSessionStatus.COMPLETED,
        reservation: {
          is: {
            userId,
          },
        },
      },
      include: this.chargingSessionInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map((session) =>
      this.toChargingSessionSummaryResponse(session),
    );
  }

  private toChargingSessionSummaryResponse(
    session: ChargingSessionRecord,
  ): ChargingSessionSummaryResponse {
    return {
      id: session.id,
      reservationId: session.reservationId,
      startEnergyKWh: this.toNullableNumber(session.startEnergyKWh),
      endEnergyKWh: this.toNullableNumber(session.endEnergyKWh),
      consumedKWh: this.toNullableNumber(session.consumedKWh),
      pricePerKWh: this.toNumber(session.pricePerKWh),
      totalCost: this.toNullableNumber(session.totalCost),
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      station: this.toStationInfo(session.reservation.station),
      charger: this.toChargerInfo(session.reservation.charger),
      payment:
        session.paymentStatus === PaymentStatus.PAID
          ? this.toPaymentResponse(session)
          : null,
    };
  }

  private toStationInfo(station: StationRecord): ChargingSessionStationInfo {
    return {
      id: station.id,
      name: station.name,
      address: station.address,
      latitude: this.toNumber(station.latitude),
      longitude: this.toNumber(station.longitude),
      operatingHours: station.operatingHours,
    };
  }

  private toChargerInfo(charger: ChargerRecord): ChargingSessionChargerInfo {
    return {
      id: charger.id,
      stationId: charger.stationId,
      label: charger.label,
      chargerType: charger.chargerType,
      connectorType: charger.connectorType,
      powerOutputKW: this.toNumber(charger.powerOutputKW),
      pricePerKWh: this.toNumber(charger.pricePerKWh),
      status: charger.status,
    };
  }

  private toNumber(value: { toString(): string }): number {
    return Number(value.toString());
  }

  private toNullableNumber(
    value: { toString(): string } | null,
  ): number | null {
    return value ? Number(value.toString()) : null;
  }

  private toPaymentResponse(
    session: ChargingSessionRecord,
  ): ChargingSessionPaymentResponse {
    return {
      paymentStatus: PaymentStatus.PAID,
      transactionId: session.transactionId ?? '',
      receiptNumber: session.receiptNumber ?? '',
      paidAmount: this.toNullableNumber(session.totalCost) ?? 0,
      paidAt: session.paidAt?.toISOString() ?? session.createdAt.toISOString(),
      paymentMethod: session.paymentMethod ?? PaymentMethod.DEMO_CARD,
      walletBalanceBeforePayment: this.toNullableNumber(
        session.walletBalanceBeforePayment,
      ),
      walletBalanceAfterPayment: this.toNullableNumber(
        session.walletBalanceAfterPayment,
      ),
    };
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getCurrentDate(): Date {
    return new Date();
  }

  private createSimulatedPaymentIdentifiers(
    paymentTime: Date,
    sessionId: string,
  ): {
    transactionId: string;
    receiptNumber: string;
  } {
    const year = paymentTime.getUTCFullYear();
    const sequence = `${(paymentTime.getTime() + sessionId.length) % 1_000_000}`.padStart(6, '0');

    return {
      transactionId: `TXN-${year}-${sequence}`,
      receiptNumber: `RCPT-${year}-${sequence}`,
    };
  }

  private get chargingSessionInclude() {
    return {
      reservation: {
        include: {
          charger: true,
          station: true,
        },
      },
    } as const;
  }
}
