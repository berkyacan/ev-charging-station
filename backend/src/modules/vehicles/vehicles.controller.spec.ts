import { ConnectorType, UserRole } from '@prisma/client';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

const mockCurrentUser = {
  sub: 'user-1',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
};

const mockVehicle = {
  id: 'vehicle-1',
  userId: 'user-1',
  brand: 'Tesla',
  model: 'Model 3',
  batteryCapacityKWh: 75,
  connectorType: ConnectorType.CCS,
  maxSupportedPowerKW: 50,
  plateNumber: '35 EV 2024',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('VehiclesController', () => {
  let vehiclesController: VehiclesController;
  let vehiclesService: {
    createForUser: jest.Mock;
    findAllForUser: jest.Mock;
    findByIdForUser: jest.Mock;
  };

  beforeEach(() => {
    vehiclesService = {
      createForUser: jest.fn().mockResolvedValue(mockVehicle),
      findAllForUser: jest.fn().mockResolvedValue([mockVehicle]),
      findByIdForUser: jest.fn().mockResolvedValue(mockVehicle),
    };

    vehiclesController = new VehiclesController(
      vehiclesService as unknown as VehiclesService,
    );
  });

  describe('createVehicle', () => {
    it('delegates to service with the current user id', async () => {
      const dto = {
        brand: 'Tesla',
        model: 'Model 3',
        batteryCapacityKWh: 75,
        connectorType: ConnectorType.CCS,
        maxSupportedPowerKW: 50,
        plateNumber: '35 EV 2024',
      };

      const result = await vehiclesController.createVehicle(
        mockCurrentUser,
        dto,
      );

      expect(vehiclesService.createForUser).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(mockVehicle);
    });
  });

  describe('getMyVehicles', () => {
    it('returns vehicles for the current user', async () => {
      const result = await vehiclesController.getMyVehicles(mockCurrentUser);

      expect(vehiclesService.findAllForUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockVehicle]);
    });
  });

  describe('getVehicleById', () => {
    it('delegates to service with the current user id and vehicle id', async () => {
      const result = await vehiclesController.getVehicleById(
        mockCurrentUser,
        'vehicle-1',
      );

      expect(vehiclesService.findByIdForUser).toHaveBeenCalledWith(
        'user-1',
        'vehicle-1',
      );
      expect(result).toEqual(mockVehicle);
    });
  });
});
