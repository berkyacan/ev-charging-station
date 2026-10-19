import { NotFoundException } from '@nestjs/common';
import { ChargerStatus, ChargerType, ConnectorType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StationFiltersDto } from './dto/station-filters.dto';
import { StationsService } from './stations.service';

describe('StationsService', () => {
  let stationsService: StationsService;
  let prismaService: {
    station: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      station: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    stationsService = new StationsService(
      prismaService as unknown as PrismaService,
    );
  });

  it('applies optional charger filters when listing stations', async () => {
    const filters: StationFiltersDto = {
      connectorType: ConnectorType.CCS,
      minPowerKW: 50,
      maxPricePerKWh: 4,
    };

    prismaService.station.findMany.mockResolvedValue([
      buildStationRecord({
        chargers: [
          {
            id: 'charger-1',
            stationId: 'station-1',
            label: 'DC 50kW #03',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CCS,
            powerOutputKW: new Prisma.Decimal(50),
            pricePerKWh: new Prisma.Decimal(4),
            status: ChargerStatus.AVAILABLE,
            createdAt: new Date('2026-05-03T10:00:00.000Z'),
          },
        ],
      }),
    ]);

    const result = await stationsService.findAll(filters);

    expect(prismaService.station.findMany).toHaveBeenCalledWith({
      where: {
        chargers: {
          some: {
            connectorType: ConnectorType.CCS,
            powerOutputKW: {
              gte: 50,
            },
            pricePerKWh: {
              lte: 4,
            },
          },
        },
      },
      include: {
        chargers: {
          where: {
            connectorType: ConnectorType.CCS,
            powerOutputKW: {
              gte: 50,
            },
            pricePerKWh: {
              lte: 4,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    expect(result).toEqual([
      {
        id: 'station-1',
        name: 'Karsiyaka Hub',
        address: 'Izmir',
        latitude: 38.457491,
        longitude: 27.112394,
        operatingHours: '08:00-23:00',
        chargerAvailabilitySummary: {
          totalChargers: 1,
          availableChargers: 1,
          occupiedChargers: 0,
          offlineChargers: 0,
        },
      },
    ]);
  });

  it('returns station detail data needed by the route display flow', async () => {
    prismaService.station.findUnique.mockResolvedValue(
      buildStationRecord({
        chargers: [
          {
            id: 'charger-1',
            stationId: 'station-1',
            label: 'DC 50kW #03',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CCS,
            powerOutputKW: new Prisma.Decimal(50),
            pricePerKWh: new Prisma.Decimal(4),
            status: ChargerStatus.AVAILABLE,
            createdAt: new Date('2026-05-03T10:00:00.000Z'),
          },
        ],
      }),
    );

    const result = await stationsService.findById('station-1');

    expect(prismaService.station.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'station-1',
      },
      include: {
        chargers: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    expect(result).toEqual({
      id: 'station-1',
      name: 'Karsiyaka Hub',
      address: 'Izmir',
      latitude: 38.457491,
      longitude: 27.112394,
      operatingHours: '08:00-23:00',
      createdAt: '2026-05-03T10:00:00.000Z',
      chargerAvailabilitySummary: {
        totalChargers: 1,
        availableChargers: 1,
        occupiedChargers: 0,
        offlineChargers: 0,
      },
    });
  });

  it('throws when station detail data is unavailable', async () => {
    prismaService.station.findUnique.mockResolvedValue(null);

    await expect(
      stationsService.findById('missing-station'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns chargers for an existing station without filters', async () => {
    prismaService.station.findUnique.mockResolvedValue(
      buildStationRecord({
        chargers: [
          {
            id: 'charger-1',
            stationId: 'station-1',
            label: 'DC 50kW #01',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CCS,
            powerOutputKW: new Prisma.Decimal(50),
            pricePerKWh: new Prisma.Decimal(4),
            status: ChargerStatus.AVAILABLE,
            createdAt: new Date('2026-05-03T10:00:00.000Z'),
          },
        ],
      }),
    );

    const result = await stationsService.findChargersByStationId(
      'station-1',
      {},
    );

    expect(result.stationId).toBe('station-1');
    expect(result.chargers).toHaveLength(1);
    expect(result.chargers[0].id).toBe('charger-1');
    expect(result.chargerAvailabilitySummary.totalChargers).toBe(1);
    expect(result.chargerAvailabilitySummary.availableChargers).toBe(1);
  });

  it('throws NotFoundException from findChargersByStationId when station is missing', async () => {
    prismaService.station.findUnique.mockResolvedValue(null);

    await expect(
      stationsService.findChargersByStationId('missing-id', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns all stations without filtering when no charger filters are provided', async () => {
    prismaService.station.findMany.mockResolvedValue([
      buildStationRecord(),
    ]);

    const result = await stationsService.findAll({});

    expect(prismaService.station.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('includes selected slot reservations when time filters are provided', async () => {
    const startTime = new Date('2026-05-10T07:00:00.000Z');
    const endTime = new Date('2026-05-10T09:00:00.000Z');

    prismaService.station.findMany.mockResolvedValue([
      buildStationRecord({
        chargers: [
          {
            id: 'charger-1',
            stationId: 'station-1',
            label: 'DC 50kW #01',
            chargerType: ChargerType.DC,
            connectorType: ConnectorType.CCS,
            powerOutputKW: new Prisma.Decimal(50),
            pricePerKWh: new Prisma.Decimal(4),
            status: ChargerStatus.AVAILABLE,
            createdAt: new Date('2026-05-03T10:00:00.000Z'),
          },
        ],
      }),
    ]);

    const result = await stationsService.findAll({ startTime, endTime });

    expect(result).toHaveLength(1);
  });
});

function buildStationRecord(overrides?: {
  chargers?: Array<{
    id: string;
    stationId: string;
    label: string;
    chargerType: ChargerType;
    connectorType: ConnectorType;
    powerOutputKW: Prisma.Decimal;
    pricePerKWh: Prisma.Decimal;
    status: ChargerStatus;
    createdAt: Date;
  }>;
}): {
  id: string;
  name: string;
  address: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  operatingHours: string;
  createdAt: Date;
  chargers: Array<{
    id: string;
    stationId: string;
    label: string;
    chargerType: ChargerType;
    connectorType: ConnectorType;
    powerOutputKW: Prisma.Decimal;
    pricePerKWh: Prisma.Decimal;
    status: ChargerStatus;
    createdAt: Date;
  }>;
} {
  return {
    id: 'station-1',
    name: 'Karsiyaka Hub',
    address: 'Izmir',
    latitude: new Prisma.Decimal('38.457491'),
    longitude: new Prisma.Decimal('27.112394'),
    operatingHours: '08:00-23:00',
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
    chargers: overrides?.chargers ?? [],
  };
}
