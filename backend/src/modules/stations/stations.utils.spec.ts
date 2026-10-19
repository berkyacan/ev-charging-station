import {
  ChargerStatus,
  ReservationStatus,
} from '@prisma/client';
import {
  buildChargerAvailabilitySummary,
  resolveChargerAvailabilityForSelectedSlot,
} from './stations.utils';

describe('stations.utils', () => {
  it('returns occupied for the selected slot when a confirmed reservation overlaps', () => {
    const availability = resolveChargerAvailabilityForSelectedSlot(
      {
        reservations: [
          {
            id: 'reservation-1',
            status: ReservationStatus.CONFIRMED,
            startTime: new Date('2026-05-03T10:00:00.000Z'),
            endTime: new Date('2026-05-03T12:00:00.000Z'),
          },
        ],
        status: ChargerStatus.AVAILABLE,
      },
      {
        startTime: new Date('2026-05-03T11:00:00.000Z'),
        endTime: new Date('2026-05-03T12:00:00.000Z'),
      },
      '24/7',
      new Date('2026-05-03T09:00:00.000Z'),
    );

    expect(availability).toEqual({
      availabilityForSelectedSlot: ChargerStatus.OCCUPIED,
      availabilityReason: 'Charger is unavailable for the selected time slot.',
    });
  });

  it('keeps an occupied charger available for a future non-conflicting slot', () => {
    const availability = resolveChargerAvailabilityForSelectedSlot(
      {
        status: ChargerStatus.OCCUPIED,
      },
      {
        startTime: new Date('2026-05-03T13:00:00.000Z'),
        endTime: new Date('2026-05-03T15:00:00.000Z'),
      },
      '24/7',
      new Date('2026-05-03T10:00:00.000Z'),
    );

    expect(availability).toEqual({
      availabilityForSelectedSlot: ChargerStatus.AVAILABLE,
    });
  });

  it('marks all non-offline chargers as occupied when the selected slot is outside operating hours', () => {
    const summary = buildChargerAvailabilitySummary(
      [
        {
          status: ChargerStatus.AVAILABLE,
        },
        {
          status: ChargerStatus.OCCUPIED,
        },
        {
          status: ChargerStatus.OFFLINE,
        },
      ],
      {
        now: new Date('2026-05-03T10:00:00.000Z'),
        operatingHours: '08:00-23:00',
        selectedSlot: {
          startTime: new Date('2026-05-03T02:00:00.000Z'),
          endTime: new Date('2026-05-03T04:00:00.000Z'),
        },
      },
    );

    expect(summary).toEqual({
      totalChargers: 3,
      availableChargers: 0,
      occupiedChargers: 2,
      offlineChargers: 1,
    });
  });
});
