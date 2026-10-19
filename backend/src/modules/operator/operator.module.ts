import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
