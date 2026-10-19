import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { AdminReportsService } from './admin-reports.service';
import { AdminReportsOverviewResponse } from './types/admin-reports-response.type';

@UseGuards(JwtAuthGuard)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(
    private readonly adminReportsService: AdminReportsService,
  ) {}

  @Get('overview')
  async getOverview(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<AdminReportsOverviewResponse> {
    return this.adminReportsService.getOverview(currentUser);
  }
}
