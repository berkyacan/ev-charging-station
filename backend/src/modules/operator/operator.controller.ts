import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { UpdateChargerPricingDto } from './dto/update-charger-pricing.dto';
import { UpdateChargerStatusDto } from './dto/update-charger-status.dto';
import { OperatorService } from './operator.service';
import {
  OperatorChargerPricingUpdateResponse,
  OperatorChargerStatusUpdateResponse,
} from './types/operator-charger-response.type';

@UseGuards(JwtAuthGuard)
@Controller('operator')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @Patch('chargers/:id/status')
  async updateChargerStatus(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') chargerId: string,
    @Body() dto: UpdateChargerStatusDto,
  ): Promise<OperatorChargerStatusUpdateResponse> {
    return this.operatorService.updateChargerStatus(
      currentUser,
      chargerId,
      dto,
    );
  }

  @Patch('chargers/:id/pricing')
  async updateChargerPricing(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') chargerId: string,
    @Body() dto: UpdateChargerPricingDto,
  ): Promise<OperatorChargerPricingUpdateResponse> {
    return this.operatorService.updateChargerPricing(
      currentUser,
      chargerId,
      dto,
    );
  }
}
