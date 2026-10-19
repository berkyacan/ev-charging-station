import { apiClient } from '../../shared/api';
import type { IssueReport, IssueType } from '../../shared/types';

export interface CreateIssueReportPayload {
  stationId: string;
  chargerId: string;
  issueType: IssueType;
  description: string;
}

export function createIssueReport(
  payload: CreateIssueReportPayload,
): Promise<IssueReport> {
  return apiClient.post<IssueReport>('/issues', payload);
}
