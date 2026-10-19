import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationResponse } from './types/notification-response.type';

interface NotificationRecord {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createNotification(
    userId: string,
    type: string,
    message: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prismaService.notification.create({
      data: {
        userId,
        type,
        message,
      },
    });

    return this.toNotificationResponse(notification);
  }

  async findNotificationsForUser(
    userId: string,
  ): Promise<NotificationResponse[]> {
    const notifications = await this.prismaService.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return notifications.map((notification) =>
      this.toNotificationResponse(notification),
    );
  }

  async markAsReadForUser(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prismaService.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.read) {
      return this.toNotificationResponse(notification);
    }

    const updatedNotification = await this.prismaService.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        read: true,
      },
    });

    return this.toNotificationResponse(updatedNotification);
  }

  private toNotificationResponse(
    notification: NotificationRecord,
  ): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      read: notification.read,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
