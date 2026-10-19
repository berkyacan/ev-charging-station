import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminReportsModule } from './modules/admin-reports/admin-reports.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ChargingSessionsModule } from './modules/charging-sessions/charging-sessions.module';
import { IssuesModule } from './modules/issues/issues.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OperatorModule } from './modules/operator/operator.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { StationsModule } from './modules/stations/stations.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AdminReportsModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    NotificationsModule,
    ChargingSessionsModule,
    IssuesModule,
    OperatorModule,
    ReservationsModule,
    StationsModule,
    VehiclesModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
