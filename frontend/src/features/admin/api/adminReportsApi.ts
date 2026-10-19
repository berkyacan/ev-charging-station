import { apiClient } from '../../shared/api';

export interface AdminRevenueReport {
  totalPaidRevenue: number;
  grossCompletedValue: number;
  pendingReceivables: number;
  completedSessionCount: number;
  paidSessionCount: number;
  averageRevenuePerPaidSession: number;
}

export interface AdminStationUtilizationReport {
  totalStations: number;
  totalChargers: number;
  availableChargers: number;
  occupiedChargers: number;
  offlineChargers: number;
  utilizationRate: number;
}

export interface AdminUserActivityReport {
  totalUsers: number;
  driverCount: number;
  operatorCount: number;
  adminCount: number;
  vehicleCount: number;
  reservationCount: number;
  completedReservationCount: number;
  cancelledReservationCount: number;
  completedSessionCount: number;
  paidSessionCount: number;
}

export interface AdminPeakHourReportItem {
  hour: string;
  reservationCount: number;
  sessionCount: number;
}

export interface AdminStationBreakdownItem {
  stationId: string;
  stationName: string;
  totalChargers: number;
  availableChargers: number;
  occupiedChargers: number;
  offlineChargers: number;
  reservationCount: number;
  completedSessionCount: number;
  revenue: number;
  reservedHours: number;
}

export type AdminRecentActivityType =
  | 'PAYMENT'
  | 'SESSION'
  | 'RESERVATION'
  | 'CANCELLATION';

export interface AdminRecentActivityItem {
  type: AdminRecentActivityType;
  title: string;
  description: string;
  amount: number | null;
  createdAt: string;
}

export interface AdminReportsOverviewResponse {
  revenue: AdminRevenueReport;
  stationUtilization: AdminStationUtilizationReport;
  userActivity: AdminUserActivityReport;
  peakHours: AdminPeakHourReportItem[];
  stationBreakdown: AdminStationBreakdownItem[];
  recentActivity: AdminRecentActivityItem[];
  generatedAt: string;
}

export function getAdminReportsOverview(): Promise<AdminReportsOverviewResponse> {
  return apiClient.get<AdminReportsOverviewResponse>('/admin/reports/overview');
}
