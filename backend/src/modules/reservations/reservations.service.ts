import {
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import {
  ChargingSessionStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ReservationValidationExistingReservation,
  ValidateReservationRequestInput,
} from './domain/reservation-validation.types';
import { validateReservationRequest } from './domain/reservation-validation';
import { ReservationRequestDto } from './dto/reservation-request.dto';
import {
  ReservationChargerInfo,
  ReservationDetailsResponse,
  ReservationStationInfo,
  ReservationValidationResponse,
  ReservationVehicleInfo,
} from './types/reservation-response.type';

interface VehicleRecord {
  id: string;
  userId: string;
  brand: string;
  model: string;
  batteryCapacityKWh: { toString(): string };
  connectorType: ReservationVehicleInfo['connectorType'];
  maxSupportedPowerKW: { toString(): string };
  plateNumber: string;
  createdAt: Date;
}

interface ChargerRecord {
  id: string;
  stationId: string;
  label: string;
  chargerType: ReservationChargerInfo['chargerType'];
  connectorType: ReservationChargerInfo['connectorType'];
  powerOutputKW: { toString(): string };
  pricePerKWh: { toString(): string };
  status: ReservationChargerInfo['status'];
  createdAt: Date;
}

interface StationRecord {
  id: string;
  name: string;
  address: string;
  latitude: { toString(): string };
  longitude: { toString(): string };
  operatingHours: string;
  createdAt: Date;
}

interface ReservationRecord {
  id: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  vehicle: VehicleRecord;
  charger: ChargerRecord;
  station: StationRecord;
}

interface ReservationRecordWithChargingSession extends ReservationRecord {
  chargingSession?: {
    id: string;
    status: ChargingSessionStatus;
  } | null;
}

interface ReservationValidationContext {
  vehicle: VehicleRecord;
  charger: ChargerRecord;
  validationResult: ReturnType<typeof validateReservationRequest>;
}

interface ReservationPrismaClient {
  vehicle: {
    findFirst: PrismaService['vehicle']['findFirst'];
  };
  charger: {
    findUnique: PrismaService['charger']['findUnique'];
  };
  station: {
    findUnique: PrismaService['station']['findUnique'];
  };
  reservation: {
    create: PrismaService['reservation']['create'];
    findMany: PrismaService['reservation']['findMany'];
    findFirst: PrismaService['reservation']['findFirst'];
    update: PrismaService['reservation']['update'];
  };
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async validateReservationForUser(
    userId: string,
    requestDto: ReservationRequestDto,
  ): Promise<ReservationValidationResponse> {
    const context = await this.buildValidationContext(userId, requestDto);

    return {
      isValid: context.validationResult.isValid,
      errors: context.validationResult.errors.map((error) => error.message),
      charger: this.toReservationChargerInfo(context.charger),
      vehicle: this.toReservationVehicleInfo(context.vehicle),
    };
  }

  async createReservationForUser(
    userId: string,
    requestDto: ReservationRequestDto,
  ): Promise<ReservationDetailsResponse> {
    let reservation: ReservationRecord;

    try {
      reservation = await this.prismaService.$transaction(
        async (transactionClient) => {
          const context = await this.buildValidationContext(
            userId,
            requestDto,
            transactionClient as unknown as ReservationPrismaClient,
          );

          if (!context.validationResult.isValid) {
            const errorMessages = context.validationResult.errors.map(
              (error) => error.message,
            );

            throw new DomainValidationException(
              errorMessages.join('; '),
              'RESERVATION_VALIDATION_FAILED',
              {
                errors: errorMessages,
                validationErrors: context.validationResult.errors,
              },
            );
          }

          return transactionClient.reservation.create({
            data: {
              userId,
              vehicleId: context.vehicle.id,
              stationId: context.charger.stationId,
              chargerId: context.charger.id,
              startTime: requestDto.startTime,
              endTime: requestDto.endTime,
              status: ReservationStatus.CONFIRMED,
            },
            include: this.reservationInclude,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (this.isTransactionConflictError(error)) {
        throw new DomainValidationException(
          'The selected time slot was just reserved. Please choose another slot.',
          'RESERVATION_SLOT_JUST_TAKEN',
          {
            errors: [
              'The selected time slot was just reserved. Please choose another slot.',
            ],
          },
        );
      }

      throw error;
    }

    await this.notificationsService.createNotification(
      userId,
      'RESERVATION_CONFIRMED',
      'Randevunuz onaylandı.',
    );

    return this.toReservationDetailsResponse(reservation);
  }

  async findReservationsForUser(
    userId: string,
  ): Promise<ReservationDetailsResponse[]> {
    const reservations = await this.prismaService.reservation.findMany({
      where: { userId },
      include: this.reservationInclude,
      orderBy: {
        startTime: 'desc',
      },
    });

    return reservations.map((reservation) =>
      this.toReservationDetailsResponse(reservation),
    );
  }

  async cancelReservationForUser(
    userId: string,
    reservationId: string,
  ): Promise<ReservationDetailsResponse> {
    const existingReservation = await this.prismaService.reservation.findFirst({
      where: {
        id: reservationId,
        userId,
      },
      include: {
        ...this.reservationInclude,
        chargingSession: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!existingReservation) {
      throw new NotFoundException('Reservation not found.');
    }

    if (existingReservation.status === ReservationStatus.CANCELLED) {
      return this.toReservationDetailsResponse(
        existingReservation as ReservationRecord,
      );
    }

    if (existingReservation.status === ReservationStatus.COMPLETED) {
      throw new DomainValidationException(
        'Tamamlanmış randevular iptal edilemez.',
        'RESERVATION_ALREADY_COMPLETED',
        {
          errors: ['Tamamlanmış randevular iptal edilemez.'],
        },
      );
    }

    if (this.hasStartedChargingSession(existingReservation)) {
      throw new DomainValidationException(
        'Şarj oturumu başlatılmış randevular iptal edilemez.',
        'RESERVATION_HAS_CHARGING_SESSION',
        {
          errors: ['Şarj oturumu başlatılmış randevular iptal edilemez.'],
        },
      );
    }

    if (existingReservation.status !== ReservationStatus.CONFIRMED) {
      throw new DomainValidationException(
        'Bu randevu şu anda iptal edilemez.',
        'RESERVATION_CANNOT_BE_CANCELLED',
        {
          errors: ['Bu randevu şu anda iptal edilemez.'],
        },
      );
    }

    const updatedReservation = await this.prismaService.reservation.update({
      where: {
        id: reservationId,
      },
      data: {
        status: ReservationStatus.CANCELLED,
      },
      include: this.reservationInclude,
    });

    return this.toReservationDetailsResponse(updatedReservation);
  }

  private async buildValidationContext(
    userId: string,
    requestDto: ReservationRequestDto,
    prismaClient: ReservationPrismaClient = this.prismaService,
  ): Promise<ReservationValidationContext> {
    const [vehicle, charger] = await Promise.all([
      prismaClient.vehicle.findFirst({
        where: {
          id: requestDto.vehicleId,
          userId,
        },
      }),
      prismaClient.charger.findUnique({
        where: {
          id: requestDto.chargerId,
        },
      }),
    ]);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    if (!charger) {
      throw new NotFoundException('Charger not found.');
    }

    const [station, existingReservations] = await Promise.all([
      prismaClient.station.findUnique({
        where: {
          id: charger.stationId,
        },
      }),
      prismaClient.reservation.findMany({
        where: {
          chargerId: charger.id,
          status: ReservationStatus.CONFIRMED,
        },
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);

    if (!station) {
      throw new NotFoundException('Station not found.');
    }

    const validationInput: ValidateReservationRequestInput = {
      vehicle: {
        connectorType: vehicle.connectorType,
        maxSupportedPowerKW: this.toNumber(vehicle.maxSupportedPowerKW),
      },
      charger: {
        id: charger.id,
        connectorType: charger.connectorType,
        powerOutputKW: this.toNumber(charger.powerOutputKW),
        status: charger.status,
      },
      station: {
        operatingHours: station.operatingHours,
      },
      existingReservations:
        existingReservations as ReservationValidationExistingReservation[],
      requestedStartTime: requestDto.startTime,
      requestedEndTime: requestDto.endTime,
      now: this.getCurrentDate(),
    };

    return {
      vehicle,
      charger,
      validationResult: validateReservationRequest(validationInput),
    };
  }

  private toReservationDetailsResponse(
    reservation: ReservationRecord,
  ): ReservationDetailsResponse {
    return {
      id: reservation.id,
      status: reservation.status,
      startTime: reservation.startTime.toISOString(),
      endTime: reservation.endTime.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      vehicle: this.toReservationVehicleInfo(reservation.vehicle, true),
      charger: this.toReservationChargerInfo(reservation.charger, true),
      station: this.toReservationStationInfo(reservation.station, true),
    };
  }

  private toReservationVehicleInfo(
    vehicle: VehicleRecord,
    includeCreatedAt = false,
  ): ReservationVehicleInfo {
    return {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      batteryCapacityKWh: this.toNumber(vehicle.batteryCapacityKWh),
      connectorType: vehicle.connectorType,
      maxSupportedPowerKW: this.toNumber(vehicle.maxSupportedPowerKW),
      plateNumber: vehicle.plateNumber,
      createdAt: includeCreatedAt ? vehicle.createdAt.toISOString() : undefined,
    };
  }

  private toReservationChargerInfo(
    charger: ChargerRecord,
    includeCreatedAt = false,
  ): ReservationChargerInfo {
    return {
      id: charger.id,
      stationId: charger.stationId,
      label: charger.label,
      chargerType: charger.chargerType,
      connectorType: charger.connectorType,
      powerOutputKW: this.toNumber(charger.powerOutputKW),
      pricePerKWh: this.toNumber(charger.pricePerKWh),
      status: charger.status,
      createdAt: includeCreatedAt ? charger.createdAt.toISOString() : undefined,
    };
  }

  private toReservationStationInfo(
    station: StationRecord,
    includeCreatedAt = false,
  ): ReservationStationInfo {
    return {
      id: station.id,
      name: station.name,
      address: station.address,
      latitude: this.toNumber(station.latitude),
      longitude: this.toNumber(station.longitude),
      operatingHours: station.operatingHours,
      createdAt: includeCreatedAt ? station.createdAt.toISOString() : undefined,
    };
  }

  private toNumber(value: { toString(): string }): number {
    return Number(value.toString());
  }

  private getCurrentDate(): Date {
    return new Date();
  }

  private isTransactionConflictError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private hasStartedChargingSession(
    reservation: ReservationRecordWithChargingSession,
  ): boolean {
    return (
      reservation.chargingSession?.status === ChargingSessionStatus.ACTIVE ||
      reservation.chargingSession?.status === ChargingSessionStatus.COMPLETED
    );
  }

  private get reservationInclude() {
    return {
      vehicle: true,
      charger: true,
      station: true,
    } as const;
  }
}
