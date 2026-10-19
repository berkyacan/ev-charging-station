import {
  ChargerStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { StationFiltersDto } from './dto/station-filters.dto';
import { ChargerAvailabilitySummary } from './types/station-response.type';
import { intervalsOverlap } from '../shared/utils/date-time.utils';
import { isReservationWithinOperatingHours } from '../shared/utils/operating-hours.utils';

export interface ChargerSummarySource {
  status: ChargerStatus;
  reservations?: Array<{
    endTime: Date;
    id?: string;
    startTime: Date;
    status: ReservationStatus;
  }>;
}

export interface SelectedSlotAvailability {
  endTime: Date;
  startTime: Date;
}

export interface SlotAwareChargerAvailability {
  availabilityForSelectedSlot: ChargerStatus;
  availabilityReason?: string;
}

export function buildChargerWhereInput(
  filters: StationFiltersDto,
): Prisma.ChargerWhereInput {
  const where: Prisma.ChargerWhereInput = {};

  if (filters.connectorType) {
    where.connectorType = filters.connectorType;
  }

  if (typeof filters.minPowerKW === 'number') {
    where.powerOutputKW = {
      gte: filters.minPowerKW,
    };
  }

  if (typeof filters.maxPricePerKWh === 'number') {
    where.pricePerKWh = {
      lte: filters.maxPricePerKWh,
    };
  }

  return where;
}

export function hasChargerFilters(
  filters: StationFiltersDto,
): boolean {
  return (
    Boolean(filters.connectorType) ||
    typeof filters.minPowerKW === 'number' ||
    typeof filters.maxPricePerKWh === 'number'
  );
}

export function buildChargerAvailabilitySummary(
  chargers: ChargerSummarySource[],
  options?: {
    now?: Date;
    operatingHours?: string;
    selectedSlot?: SelectedSlotAvailability | null;
  },
): ChargerAvailabilitySummary {
  const summary: ChargerAvailabilitySummary = {
    totalChargers: chargers.length,
    availableChargers: 0,
    occupiedChargers: 0,
    offlineChargers: 0,
  };

  for (const charger of chargers) {
    const availabilityStatus = options?.selectedSlot
      ? resolveChargerAvailabilityForSelectedSlot(
          charger,
          options.selectedSlot,
          options.operatingHours,
          options.now,
        ).availabilityForSelectedSlot
      : charger.status;

    if (availabilityStatus === ChargerStatus.AVAILABLE) {
      summary.availableChargers += 1;
    }

    if (availabilityStatus === ChargerStatus.OCCUPIED) {
      summary.occupiedChargers += 1;
    }

    if (availabilityStatus === ChargerStatus.OFFLINE) {
      summary.offlineChargers += 1;
    }
  }

  return summary;
}

export function getSelectedSlotAvailability(
  filters: Pick<StationFiltersDto, 'endTime' | 'startTime'>,
): SelectedSlotAvailability | null {
  if (!(filters.startTime instanceof Date) || !(filters.endTime instanceof Date)) {
    return null;
  }

  if (
    Number.isNaN(filters.startTime.getTime()) ||
    Number.isNaN(filters.endTime.getTime())
  ) {
    return null;
  }

  return {
    endTime: filters.endTime,
    startTime: filters.startTime,
  };
}

export function resolveChargerAvailabilityForSelectedSlot(
  charger: ChargerSummarySource,
  selectedSlot: SelectedSlotAvailability,
  operatingHours?: string,
  now: Date = new Date(),
): SlotAwareChargerAvailability {
  if (charger.status === ChargerStatus.OFFLINE) {
    return {
      availabilityForSelectedSlot: ChargerStatus.OFFLINE,
      availabilityReason: 'Charger is offline.',
    };
  }

  if (
    operatingHours &&
    !isReservationWithinOperatingHours(
      operatingHours,
      selectedSlot.startTime,
      selectedSlot.endTime,
    )
  ) {
    return {
      availabilityForSelectedSlot: ChargerStatus.OCCUPIED,
      availabilityReason: 'Reservation time is outside station operating hours.',
    };
  }

  const overlapsCurrentActiveWindow =
    charger.status === ChargerStatus.OCCUPIED &&
    selectedSlot.startTime.getTime() <= now.getTime() &&
    selectedSlot.endTime.getTime() > now.getTime();

  if (overlapsCurrentActiveWindow) {
    return {
      availabilityForSelectedSlot: ChargerStatus.OCCUPIED,
      availabilityReason: 'Charger is currently occupied for the selected time slot.',
    };
  }

  const hasOverlappingReservation =
    charger.reservations?.some(
      (reservation) =>
        reservation.status === ReservationStatus.CONFIRMED &&
        intervalsOverlap(
          reservation.startTime,
          reservation.endTime,
          selectedSlot.startTime,
          selectedSlot.endTime,
        ),
    ) ?? false;

  if (hasOverlappingReservation) {
    return {
      availabilityForSelectedSlot: ChargerStatus.OCCUPIED,
      availabilityReason: 'Charger is unavailable for the selected time slot.',
    };
  }

  return {
    availabilityForSelectedSlot: ChargerStatus.AVAILABLE,
  };
}
