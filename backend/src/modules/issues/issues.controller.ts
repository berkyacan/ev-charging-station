import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { IssuesService } from './issues.service';
import { IssueReportResponse } from './types/issue-response.type';

@UseGuards(JwtAuthGuard)
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  async createIssueReport(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() dto: CreateIssueReportDto,
  ): Promise<IssueReportResponse> {
    return this.issuesService.createIssueForUser(currentUser, dto);
  }
}
