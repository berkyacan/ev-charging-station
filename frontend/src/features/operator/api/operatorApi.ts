import { apiClient } from '../../shared/api';
import type {
  Charger,
  ChargerStatus,
  IssueReport,
  User,
} from '../../shared/types';

export interface UpdateChargerStatusPayload {
  status: ChargerStatus;
}

export interface UpdateChargerPricingPayload {
  pricePerKWh: number;
}

export interface OperatorChargerStatusUpdateResponse {
  updatedCharger: Charger;
  affectedActiveSessionCount: number;
  cancelledReservationsCount: number;
}

export interface OperatorChargerPricingUpdateResponse {
  updatedCharger: Charger;
}

export interface OperatorIssueReportResponse extends IssueReport {
  reporter: Pick<User, 'id' | 'name' | 'email'>;
}

export function updateOperatorChargerStatus(
  chargerId: string,
  payload: UpdateChargerStatusPayload,
): Promise<OperatorChargerStatusUpdateResponse> {
  return apiClient.patch<OperatorChargerStatusUpdateResponse>(
    `/operator/chargers/${chargerId}/status`,
    payload,
  );
}

export function updateOperatorChargerPricing(
  chargerId: string,
  payload: UpdateChargerPricingPayload,
): Promise<OperatorChargerPricingUpdateResponse> {
  return apiClient.patch<OperatorChargerPricingUpdateResponse>(
    `/operator/chargers/${chargerId}/pricing`,
    payload,
  );
}

export function getOperatorIssueReports(): Promise<OperatorIssueReportResponse[]> {
  return apiClient.get<OperatorIssueReportResponse[]>('/operator/issues');
}
