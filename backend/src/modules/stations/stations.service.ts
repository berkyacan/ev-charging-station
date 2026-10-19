import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StationFiltersDto } from './dto/station-filters.dto';
import {
  ChargerDetailsResponse,
  StationChargersResponse,
  StationDetailResponse,
  StationListItemResponse,
} from './types/station-response.type';
import {
  buildChargerAvailabilitySummary,
  buildChargerWhereInput,
  getSelectedSlotAvailability,
  hasChargerFilters,
  resolveChargerAvailabilityForSelectedSlot,
  type SelectedSlotAvailability,
} from './stations.utils';

interface StationWithChargersRecord {
  id: string;
  name: string;
  address: string;
  latitude: { toString(): string };
  longitude: { toString(): string };
  operatingHours: string;
  createdAt: Date;
  chargers: Array<{
    id: string;
    stationId: string;
    label: string;
    chargerType: ChargerDetailsResponse['chargerType'];
    connectorType: ChargerDetailsResponse['connectorType'];
    powerOutputKW: { toString(): string };
    pricePerKWh: { toString(): string };
    status: ChargerDetailsResponse['status'];
    createdAt: Date;
    reservations?: Array<{
      id: string;
      status: ReservationStatus;
      startTime: Date;
      endTime: Date;
    }>;
  }>;
}

@Injectable()
export class StationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(filters: StationFiltersDto): Promise<StationListItemResponse[]> {
    const chargerWhere = buildChargerWhereInput(filters);
    const selectedSlot = getSelectedSlotAvailability(filters);
    const stations = await this.prismaService.station.findMany({
      where: hasChargerFilters(filters)
        ? {
            chargers: {
              some: chargerWhere,
            },
          }
        : undefined,
      include: {
        chargers: {
          include: selectedSlot
            ? {
                reservations: {
                  where: {
                    status: ReservationStatus.CONFIRMED,
                    startTime: {
                      lt: selectedSlot.endTime,
                    },
                    endTime: {
                      gt: selectedSlot.startTime,
                    },
                  },
                  select: {
                    id: true,
                    status: true,
                    startTime: true,
                    endTime: true,
                  },
                },
              }
            : undefined,
          where: chargerWhere,
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return stations.map((station) =>
      this.toStationListItemResponse(station, selectedSlot),
    );
  }

  async findById(stationId: string): Promise<StationDetailResponse> {
    const station = await this.prismaService.station.findUnique({
      where: { id: stationId },
      include: {
        chargers: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!station) {
      throw new NotFoundException('Station not found.');
    }

    return this.toStationDetailResponse(station);
  }

  async findChargersByStationId(
    stationId: string,
    filters: StationFiltersDto,
  ): Promise<StationChargersResponse> {
    const selectedSlot = getSelectedSlotAvailability(filters);
    const station = await this.prismaService.station.findUnique({
      where: { id: stationId },
      include: {
        chargers: {
          include: selectedSlot
            ? {
                reservations: {
                  where: {
                    status: ReservationStatus.CONFIRMED,
                    startTime: {
                      lt: selectedSlot.endTime,
                    },
                    endTime: {
                      gt: selectedSlot.startTime,
                    },
                  },
                  select: {
                    id: true,
                    status: true,
                    startTime: true,
                    endTime: true,
                  },
                },
              }
            : undefined,
          where: buildChargerWhereInput(filters),
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!station) {
      throw new NotFoundException('Station not found.');
    }

    return {
      stationId: station.id,
      stationName: station.name,
      chargerAvailabilitySummary: buildChargerAvailabilitySummary(
        station.chargers,
        selectedSlot
          ? {
              now: this.getCurrentDate(),
              operatingHours: station.operatingHours,
              selectedSlot,
            }
          : undefined,
      ),
      chargers: station.chargers.map((charger) =>
        this.toChargerDetailsResponse(
          charger,
          station.operatingHours,
          selectedSlot,
        ),
      ),
    };
  }

  private toStationListItemResponse(
    station: StationWithChargersRecord,
    selectedSlot?: SelectedSlotAvailability | null,
  ): StationListItemResponse {
    return {
      id: station.id,
      name: station.name,
      address: station.address,
      latitude: this.toNumber(station.latitude),
      longitude: this.toNumber(station.longitude),
      operatingHours: station.operatingHours,
      chargerAvailabilitySummary: buildChargerAvailabilitySummary(
        station.chargers,
        selectedSlot
          ? {
              now: this.getCurrentDate(),
              operatingHours: station.operatingHours,
              selectedSlot,
            }
          : undefined,
      ),
    };
  }

  private toStationDetailResponse(
    station: StationWithChargersRecord,
  ): StationDetailResponse {
    return {
      ...this.toStationListItemResponse(station),
      createdAt: station.createdAt.toISOString(),
    };
  }

  private toChargerDetailsResponse(
    charger: StationWithChargersRecord['chargers'][number],
    operatingHours?: string,
    selectedSlot?: SelectedSlotAvailability | null,
  ): ChargerDetailsResponse {
    const slotAwareAvailability =
      selectedSlot && operatingHours
        ? resolveChargerAvailabilityForSelectedSlot(
            charger,
            selectedSlot,
            operatingHours,
            this.getCurrentDate(),
          )
        : null;

    return {
      id: charger.id,
      stationId: charger.stationId,
      label: charger.label,
      chargerType: charger.chargerType,
      connectorType: charger.connectorType,
      powerOutputKW: this.toNumber(charger.powerOutputKW),
      pricePerKWh: this.toNumber(charger.pricePerKWh),
      status: charger.status,
      availabilityForSelectedSlot:
        slotAwareAvailability?.availabilityForSelectedSlot,
      availabilityReason: slotAwareAvailability?.availabilityReason,
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
