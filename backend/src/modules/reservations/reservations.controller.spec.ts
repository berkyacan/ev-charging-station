import { ReservationStatus, UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';

const mockCurrentUser = {
  sub: 'user-1',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
};

const mockReservation = {
  id: 'reservation-1',
  status: ReservationStatus.CONFIRMED,
  startTime: '2026-06-01T10:00:00.000Z',
  endTime: '2026-06-01T12:00:00.000Z',
  createdAt: '2026-05-01T10:00:00.000Z',
  vehicle: {} as any,
  charger: {} as any,
  station: {} as any,
};

const mockRequestDto = {
  vehicleId: 'vehicle-1',
  chargerId: 'charger-1',
  startTime: new Date('2026-06-01T10:00:00.000Z'),
  endTime: new Date('2026-06-01T12:00:00.000Z'),
};

describe('ReservationsController', () => {
  let reservationsController: ReservationsController;
  let reservationsService: {
    validateReservationForUser: jest.Mock;
    createReservationForUser: jest.Mock;
    findReservationsForUser: jest.Mock;
    cancelReservationForUser: jest.Mock;
  };

  beforeEach(() => {
    reservationsService = {
      validateReservationForUser: jest.fn(),
      createReservationForUser: jest.fn().mockResolvedValue(mockReservation),
      findReservationsForUser: jest.fn().mockResolvedValue([mockReservation]),
      cancelReservationForUser: jest.fn().mockResolvedValue({
        ...mockReservation,
        status: ReservationStatus.CANCELLED,
      }),
    };

    reservationsController = new ReservationsController(
      reservationsService as unknown as ReservationsService,
    );
  });

  describe('validateReservation', () => {
    it('delegates to service with the current user id', async () => {
      const validationResult = {
        isValid: true,
        errors: [],
        charger: {} as any,
        vehicle: {} as any,
      };
      reservationsService.validateReservationForUser.mockResolvedValue(
        validationResult,
      );

      const result = await reservationsController.validateReservation(
        mockCurrentUser,
        mockRequestDto,
      );

      expect(
        reservationsService.validateReservationForUser,
      ).toHaveBeenCalledWith('user-1', mockRequestDto);
      expect(result).toEqual(validationResult);
    });
  });

  describe('createReservation', () => {
    it('delegates to service with the current user id and returns the reservation', async () => {
      const result = await reservationsController.createReservation(
        mockCurrentUser,
        mockRequestDto,
      );

      expect(reservationsService.createReservationForUser).toHaveBeenCalledWith(
        'user-1',
        mockRequestDto,
      );
      expect(result).toEqual(mockReservation);
    });
  });

  describe('getMyReservations', () => {
    it('returns all reservations for the current user', async () => {
      const result =
        await reservationsController.getMyReservations(mockCurrentUser);

      expect(reservationsService.findReservationsForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual([mockReservation]);
    });
  });

  describe('cancelReservation', () => {
    it('delegates to service with the current user id and reservation id', async () => {
      const result = await reservationsController.cancelReservation(
        mockCurrentUser,
        'reservation-1',
      );

      expect(reservationsService.cancelReservationForUser).toHaveBeenCalledWith(
        'user-1',
        'reservation-1',
      );
      expect(result.status).toBe(ReservationStatus.CANCELLED);
    });
  });
});
