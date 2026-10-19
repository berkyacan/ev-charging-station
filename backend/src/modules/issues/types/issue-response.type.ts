import { ChargerStatus, IssueReportStatus } from '@prisma/client';
import { IssueType } from './issue-type';

export interface IssueReportResponse {
  id: string;
  issueType: IssueType;
  description: string;
  status: IssueReportStatus;
  createdAt: string;
  station: {
    id: string;
    name: string;
    address: string;
  };
  charger: {
    id: string;
    label: string;
    status: ChargerStatus;
  };
}

export interface OperatorIssueReportResponse extends IssueReportResponse {
  reporter: {
    id: string;
    name: string;
    email: string;
  };
}
