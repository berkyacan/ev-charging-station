import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

const mockCurrentUser = {
  sub: 'user-1',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
};

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'RESERVATION_CONFIRMED',
  message: 'Randevunuz onaylandı.',
  read: false,
  createdAt: '2026-05-14T10:00:00.000Z',
};

describe('NotificationsController', () => {
  let notificationsController: NotificationsController;
  let notificationsService: {
    findNotificationsForUser: jest.Mock;
    markAsReadForUser: jest.Mock;
  };

  beforeEach(() => {
    notificationsService = {
      findNotificationsForUser: jest
        .fn()
        .mockResolvedValue([mockNotification]),
      markAsReadForUser: jest.fn().mockResolvedValue({
        ...mockNotification,
        read: true,
      }),
    };

    notificationsController = new NotificationsController(
      notificationsService as unknown as NotificationsService,
    );
  });

  describe('getMyNotifications', () => {
    it('returns notifications for the current user', async () => {
      const result =
        await notificationsController.getMyNotifications(mockCurrentUser);

      expect(notificationsService.findNotificationsForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual([mockNotification]);
    });
  });

  describe('markAsRead', () => {
    it('delegates to service with the current user id and notification id', async () => {
      const result = await notificationsController.markAsRead(
        mockCurrentUser,
        'notif-1',
      );

      expect(notificationsService.markAsReadForUser).toHaveBeenCalledWith(
        'user-1',
        'notif-1',
      );
      expect(result.read).toBe(true);
    });
  });
});
