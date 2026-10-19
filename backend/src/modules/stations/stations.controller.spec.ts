import { StationsService } from './stations.service';
import { StationsController } from './stations.controller';

const mockStationList = [
  {
    id: 'station-1',
    name: 'Karsiyaka Hub',
    address: 'Izmir',
    latitude: 38.46,
    longitude: 27.11,
    operatingHours: '08:00-23:00',
    chargerAvailabilitySummary: {
      totalChargers: 2,
      availableChargers: 1,
      occupiedChargers: 1,
      offlineChargers: 0,
    },
  },
];

const mockStationDetail = {
  ...mockStationList[0],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockChargersResponse = {
  stationId: 'station-1',
  stationName: 'Karsiyaka Hub',
  chargerAvailabilitySummary: { totalChargers: 2, availableChargers: 1, occupiedChargers: 1, offlineChargers: 0 },
  chargers: [],
};

describe('StationsController', () => {
  let stationsController: StationsController;
  let stationsService: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findChargersByStationId: jest.Mock;
  };

  beforeEach(() => {
    stationsService = {
      findAll: jest.fn().mockResolvedValue(mockStationList),
      findById: jest.fn().mockResolvedValue(mockStationDetail),
      findChargersByStationId: jest.fn().mockResolvedValue(mockChargersResponse),
    };

    stationsController = new StationsController(
      stationsService as unknown as StationsService,
    );
  });

  describe('getStations', () => {
    it('returns the list of stations from service', async () => {
      const result = await stationsController.getStations({});

      expect(stationsService.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockStationList);
    });

    it('passes filters to the service', async () => {
      await stationsController.getStations({ minPowerKW: 50 });

      expect(stationsService.findAll).toHaveBeenCalledWith({ minPowerKW: 50 });
    });
  });

  describe('getStationById', () => {
    it('returns station detail from service', async () => {
      const result = await stationsController.getStationById('station-1');

      expect(stationsService.findById).toHaveBeenCalledWith('station-1');
      expect(result).toEqual(mockStationDetail);
    });
  });

  describe('getStationChargers', () => {
    it('returns charger list from service', async () => {
      const result = await stationsController.getStationChargers(
        'station-1',
        {},
      );

      expect(stationsService.findChargersByStationId).toHaveBeenCalledWith(
        'station-1',
        {},
      );
      expect(result).toEqual(mockChargersResponse);
    });
  });
});
