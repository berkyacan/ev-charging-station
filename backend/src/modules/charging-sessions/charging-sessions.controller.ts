import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { ChargingSessionsService } from './charging-sessions.service';
import { CompleteChargingSessionDto } from './dto/complete-charging-session.dto';
import { PayChargingSessionDto } from './dto/pay-charging-session.dto';
import { StartChargingSessionDto } from './dto/start-charging-session.dto';
import {
  ChargingSessionPaymentResponse,
  ChargingSessionSummaryResponse,
} from './types/charging-session-response.type';

@UseGuards(JwtAuthGuard)
@Controller('charging-sessions')
export class ChargingSessionsController {
  constructor(
    private readonly chargingSessionsService: ChargingSessionsService,
  ) {}

  @Post('start')
  async startSession(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() dto: StartChargingSessionDto,
  ): Promise<ChargingSessionSummaryResponse> {
    return this.chargingSessionsService.startSessionForUser(
      currentUser.sub,
      dto,
    );
  }

  @Post(':id/complete')
  async completeSession(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') sessionId: string,
    @Body() dto: CompleteChargingSessionDto,
  ): Promise<ChargingSessionSummaryResponse> {
    return this.chargingSessionsService.completeSessionForUser(
      currentUser.sub,
      sessionId,
      dto,
    );
  }

  @Post(':id/pay')
  async confirmPayment(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') sessionId: string,
    @Body() dto: PayChargingSessionDto,
  ): Promise<ChargingSessionPaymentResponse> {
    return this.chargingSessionsService.confirmPaymentForUser(
      currentUser.sub,
      sessionId,
      dto,
    );
  }

  @Get('active')
  async getActiveSession(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<ChargingSessionSummaryResponse | null> {
    return this.chargingSessionsService.getActiveSessionForUser(
      currentUser.sub,
    );
  }

  @Get(':id/summary')
  async getSessionSummary(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') sessionId: string,
  ): Promise<ChargingSessionSummaryResponse> {
    return this.chargingSessionsService.getSessionSummaryForUser(
      currentUser.sub,
      sessionId,
    );
  }
}
