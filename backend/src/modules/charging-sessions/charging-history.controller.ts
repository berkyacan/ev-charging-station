import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { ChargingSessionsService } from './charging-sessions.service';
import { ChargingSessionSummaryResponse } from './types/charging-session-response.type';

@UseGuards(JwtAuthGuard)
@Controller('charging-history')
export class ChargingHistoryController {
  constructor(
    private readonly chargingSessionsService: ChargingSessionsService,
  ) {}

  @Get('me')
  async getMyChargingHistory(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<ChargingSessionSummaryResponse[]> {
    return this.chargingSessionsService.getCompletedHistoryForUser(
      currentUser.sub,
    );
  }
}
