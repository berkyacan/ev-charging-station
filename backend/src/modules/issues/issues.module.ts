import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { OperatorIssuesController } from './operator-issues.controller';

@Module({
  imports: [AuthModule],
  controllers: [IssuesController, OperatorIssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
