import { NotFoundException } from '@nestjs/common';
import { ConnectorType, Prisma, Vehicle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let vehiclesService: VehiclesService;
  let prismaService: {
    vehicle: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      vehicle: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    vehiclesService = new VehiclesService(
      prismaService as unknown as PrismaService,
    );
  });

  it('creates a vehicle successfully', async () => {
    const userId = 'user-1';
    const createVehicleDto: CreateVehicleDto = {
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: 75,
      connectorType: ConnectorType.CCS,
      maxSupportedPowerKW: 50,
      plateNumber: '35 EV 2024',
    };
    const createdVehicle = buildVehicle({
      userId,
      brand: createVehicleDto.brand,
      model: createVehicleDto.model,
      batteryCapacityKWh: new Prisma.Decimal(createVehicleDto.batteryCapacityKWh),
      connectorType: createVehicleDto.connectorType,
      maxSupportedPowerKW: new Prisma.Decimal(createVehicleDto.maxSupportedPowerKW),
      plateNumber: createVehicleDto.plateNumber,
    });

    prismaService.vehicle.create.mockResolvedValue(createdVehicle);

    const result = await vehiclesService.createForUser(userId, createVehicleDto);

    expect(prismaService.vehicle.create).toHaveBeenCalledWith({
      data: {
        userId,
        brand: 'Tesla',
        model: 'Model 3',
        batteryCapacityKWh: 75,
        connectorType: ConnectorType.CCS,
        maxSupportedPowerKW: 50,
        plateNumber: '35 EV 2024',
      },
    });
    expect(result).toEqual({
      id: createdVehicle.id,
      userId: createdVehicle.userId,
      brand: createdVehicle.brand,
      model: createdVehicle.model,
      batteryCapacityKWh: 75,
      connectorType: ConnectorType.CCS,
      maxSupportedPowerKW: 50,
      plateNumber: createdVehicle.plateNumber,
      createdAt: createdVehicle.createdAt.toISOString(),
    });
  });

  it('lists vehicles for the authenticated user', async () => {
    prismaService.vehicle.findMany.mockResolvedValue([
      buildVehicle({
        id: 'vehicle-2',
        userId: 'user-1',
        brand: 'Hyundai',
        model: 'Kona Electric',
        batteryCapacityKWh: new Prisma.Decimal(64),
        connectorType: ConnectorType.CCS,
        maxSupportedPowerKW: new Prisma.Decimal(77),
        plateNumber: '35 EV 2025',
      }),
    ]);

    const result = await vehiclesService.findAllForUser('user-1');

    expect(prismaService.vehicle.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(result).toEqual([
      {
        id: 'vehicle-2',
        userId: 'user-1',
        brand: 'Hyundai',
        model: 'Kona Electric',
        batteryCapacityKWh: 64,
        connectorType: ConnectorType.CCS,
        maxSupportedPowerKW: 77,
        plateNumber: '35 EV 2025',
        createdAt: new Date('2026-05-03T10:00:00.000Z').toISOString(),
      },
    ]);
  });

  it('throws when a vehicle does not belong to the authenticated user', async () => {
    prismaService.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      vehiclesService.findByIdForUser('user-1', 'vehicle-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when the plate number is already registered', async () => {
    const conflictError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0', meta: {} },
    );
    prismaService.vehicle.create.mockRejectedValue(conflictError);

    await expect(
      vehiclesService.createForUser('user-1', {
        brand: 'Tesla',
        model: 'Model 3',
        batteryCapacityKWh: 75,
        connectorType: ConnectorType.CCS,
        maxSupportedPowerKW: 50,
        plateNumber: '35 EV 2024',
      }),
    ).rejects.toThrow('"35 EV 2024" is already registered in your account.');
  });

  it('re-throws unexpected database errors from createForUser', async () => {
    const unexpectedError = new Error('Unexpected DB error');
    prismaService.vehicle.create.mockRejectedValue(unexpectedError);

    await expect(
      vehiclesService.createForUser('user-1', {
        brand: 'Tesla',
        model: 'Model 3',
        batteryCapacityKWh: 75,
        connectorType: ConnectorType.CCS,
        maxSupportedPowerKW: 50,
        plateNumber: '35 EV 2024',
      }),
    ).rejects.toThrow('Unexpected DB error');
  });

  it('returns the vehicle when it belongs to the authenticated user', async () => {
    const vehicle = buildVehicle({
      id: 'vehicle-1',
      userId: 'user-1',
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: new Prisma.Decimal(75),
      connectorType: ConnectorType.CCS,
      maxSupportedPowerKW: new Prisma.Decimal(50),
      plateNumber: '35 EV 2024',
    });
    prismaService.vehicle.findFirst.mockResolvedValue(vehicle);

    const result = await vehiclesService.findByIdForUser('user-1', 'vehicle-1');

    expect(result.id).toBe('vehicle-1');
    expect(result.brand).toBe('Tesla');
  });
});

function buildVehicle(
  overrides: Partial<Vehicle> & {
    userId: string;
    brand: string;
    model: string;
    batteryCapacityKWh: Prisma.Decimal;
    connectorType: ConnectorType;
    maxSupportedPowerKW: Prisma.Decimal;
    plateNumber: string;
  },
): Vehicle {
  return {
    id: overrides.id ?? 'vehicle-1',
    userId: overrides.userId,
    brand: overrides.brand,
    model: overrides.model,
    batteryCapacityKWh: overrides.batteryCapacityKWh,
    connectorType: overrides.connectorType,
    maxSupportedPowerKW: overrides.maxSupportedPowerKW,
    plateNumber: overrides.plateNumber,
    createdAt: overrides.createdAt ?? new Date('2026-05-03T10:00:00.000Z'),
  };
}
