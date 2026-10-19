import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { NotificationsService } from './notifications.service';
import { NotificationResponse } from './types/notification-response.type';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('me')
  async getMyNotifications(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<NotificationResponse[]> {
    return this.notificationsService.findNotificationsForUser(currentUser.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') notificationId: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsReadForUser(
      currentUser.sub,
      notificationId,
    );
  }
}
