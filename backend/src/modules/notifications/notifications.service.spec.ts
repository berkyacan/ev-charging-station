import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let notificationsService: NotificationsService;
  let prismaService: {
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    notificationsService = new NotificationsService(
      prismaService as unknown as PrismaService,
    );
  });

  it('creates a notification', async () => {
    prismaService.notification.create.mockResolvedValue(
      buildNotificationRecord(),
    );

    const result = await notificationsService.createNotification(
      'user-1',
      'RESERVATION_CONFIRMED',
      'Randevunuz onaylandı.',
    );

    expect(prismaService.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'RESERVATION_CONFIRMED',
        message: 'Randevunuz onaylandı.',
      },
    });
    expect(result).toMatchObject({
      id: 'notification-1',
      type: 'RESERVATION_CONFIRMED',
      message: 'Randevunuz onaylandı.',
      read: false,
    });
  });

  it('lists notifications for the authenticated user', async () => {
    prismaService.notification.findMany.mockResolvedValue([
      buildNotificationRecord(),
    ]);

    const result = await notificationsService.findNotificationsForUser(
      'user-1',
    );

    expect(prismaService.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(result).toHaveLength(1);
  });

  it('marks an owned notification as read', async () => {
    prismaService.notification.findFirst.mockResolvedValue(
      buildNotificationRecord({ read: false }),
    );
    prismaService.notification.update.mockResolvedValue(
      buildNotificationRecord({ read: true }),
    );

    const result = await notificationsService.markAsReadForUser(
      'user-1',
      'notification-1',
    );

    expect(prismaService.notification.update).toHaveBeenCalledWith({
      where: {
        id: 'notification-1',
      },
      data: {
        read: true,
      },
    });
    expect(result.read).toBe(true);
  });

  it("rejects marking another user's notification as read", async () => {
    prismaService.notification.findFirst.mockResolvedValue(null);

    await expect(
      notificationsService.markAsReadForUser('user-1', 'notification-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function buildNotificationRecord(overrides?: {
  read?: boolean;
  type?: string;
  message?: string;
}): {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
} {
  return {
    id: 'notification-1',
    type: overrides?.type ?? 'RESERVATION_CONFIRMED',
    message: overrides?.message ?? 'Randevunuz onaylandı.',
    read: overrides?.read ?? false,
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
  };
}
