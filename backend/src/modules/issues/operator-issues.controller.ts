import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { IssuesService } from './issues.service';
import { OperatorIssueReportResponse } from './types/issue-response.type';

@UseGuards(JwtAuthGuard)
@Controller('operator/issues')
export class OperatorIssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  async getIssueReports(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<OperatorIssueReportResponse[]> {
    return this.issuesService.findAllForOperator(currentUser);
  }
}
