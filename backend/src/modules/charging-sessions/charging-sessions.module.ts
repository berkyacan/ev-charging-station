import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChargingHistoryController } from './charging-history.controller';
import { ChargingSessionsController } from './charging-sessions.controller';
import { ChargingSessionsService } from './charging-sessions.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ChargingSessionsController, ChargingHistoryController],
  providers: [ChargingSessionsService],
})
export class ChargingSessionsModule {}
