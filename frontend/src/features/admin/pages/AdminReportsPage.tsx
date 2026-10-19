import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import { clearToken } from '../../shared/utils/authToken';
import {
  getAdminReportsOverview,
  type AdminPeakHourReportItem,
  type AdminRecentActivityItem,
  type AdminReportsOverviewResponse,
  type AdminStationBreakdownItem,
} from '../api/adminReportsApi';

export function AdminReportsPage(): JSX.Element {
  const navigate = useNavigate();
  const [report, setReport] = useState<AdminReportsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadReports(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getAdminReportsOverview();

        if (!isActive) {
          return;
        }

        setReport(response);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          clearToken();
          navigate('/login', { replace: true });
          return;
        }

        if (error instanceof ApiClientError && error.status === 403) {
          setErrorMessage('Admin permission is required to view this page.');
        } else {
          setErrorMessage('Report data cannot be retrieved at this time.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  const topPeakHours = useMemo(() => {
    if (!report) {
      return [];
    }

    return [...report.peakHours]
      .sort((left, right) => {
        const leftTotal = left.reservationCount + left.sessionCount;
        const rightTotal = right.reservationCount + right.sessionCount;
        return rightTotal - leftTotal;
      })
      .slice(0, 6);
  }, [report]);

  return (
    <section className="page-shell">
      <PageHero
        badge="Admin Access"
        description="Revenue, station utilization, peak hours, and user activity are aggregated from current transaction data."
        eyebrow="Management"
        metrics={[
          {
            label: 'Total Revenue Collected',
            value:
              isLoading || !report
                ? 'Loading'
                : formatCurrency(report.revenue.totalPaidRevenue),
            hint: 'Sessions with confirmed payment',
          },
          {
            label: 'Total Stations',
            value:
              isLoading || !report
                ? 'Loading'
                : String(report.stationUtilization.totalStations),
            hint: 'Registered stations in the network',
          },
          {
            label: 'Utilization Rate',
            value:
              isLoading || !report
                ? 'Loading'
                : formatPercent(report.stationUtilization.utilizationRate),
            hint: 'Current occupied charger ratio',
          },
        ]}
        title="Admin Reports"
      />

      {errorMessage ? (
        <div className="message-banner message-banner--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="card">
          <div className="session-empty-state session-empty-state--loading" role="status">
            <span className="session-empty-state__eyebrow">Loading</span>
            <strong>Loading report data.</strong>
            <p>Revenue, utilization, and activity summaries are being prepared.</p>
          </div>
        </div>
      ) : report ? (
        <>
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Revenue Summary</h2>
                <p>Financial summary generated from charging sessions.</p>
              </div>
              <span className="status-pill status-pill--completed">
                Generated: {formatDateTime(report.generatedAt)}
              </span>
            </div>

            <div className="dashboard-card-grid">
              <ReportMetricCard label="Total Revenue Collected" value={formatCurrency(report.revenue.totalPaidRevenue)} />
              <ReportMetricCard label="Gross Charging Value" value={formatCurrency(report.revenue.grossCompletedValue)} />
              <ReportMetricCard label="Pending Receivables" value={formatCurrency(report.revenue.pendingReceivables)} />
              <ReportMetricCard label="Completed Sessions" value={formatInteger(report.revenue.completedSessionCount)} />
              <ReportMetricCard label="Paid Sessions" value={formatInteger(report.revenue.paidSessionCount)} />
              <ReportMetricCard label="Avg Session Revenue" value={formatCurrency(report.revenue.averageRevenuePerPaidSession)} />
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Station Utilization</h2>
                <p>Current operational view of the station and charger network.</p>
              </div>
            </div>

            <div className="dashboard-card-grid">
              <ReportMetricCard label="Total Stations" value={formatInteger(report.stationUtilization.totalStations)} />
              <ReportMetricCard label="Total Chargers" value={formatInteger(report.stationUtilization.totalChargers)} />
              <ReportMetricCard label="Available Chargers" value={formatInteger(report.stationUtilization.availableChargers)} />
              <ReportMetricCard label="Occupied Chargers" value={formatInteger(report.stationUtilization.occupiedChargers)} />
              <ReportMetricCard label="Offline Chargers" value={formatInteger(report.stationUtilization.offlineChargers)} />
              <ReportMetricCard label="Utilization Rate" value={formatPercent(report.stationUtilization.utilizationRate)} />
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>User Activity</h2>
                <p>User, vehicle, reservation, and session volume summary.</p>
              </div>
            </div>

            <div className="dashboard-card-grid">
              <ReportMetricCard label="Total Users" value={formatInteger(report.userActivity.totalUsers)} />
              <ReportMetricCard label="Drivers" value={formatInteger(report.userActivity.driverCount)} />
              <ReportMetricCard label="Operators" value={formatInteger(report.userActivity.operatorCount)} />
              <ReportMetricCard label="Admins" value={formatInteger(report.userActivity.adminCount)} />
              <ReportMetricCard label="Vehicles" value={formatInteger(report.userActivity.vehicleCount)} />
              <ReportMetricCard label="Reservations" value={formatInteger(report.userActivity.reservationCount)} />
              <ReportMetricCard label="Completed Reservations" value={formatInteger(report.userActivity.completedReservationCount)} />
              <ReportMetricCard label="Cancelled Reservations" value={formatInteger(report.userActivity.cancelledReservationCount)} />
              <ReportMetricCard label="Completed Sessions" value={formatInteger(report.userActivity.completedSessionCount)} />
              <ReportMetricCard label="Paid Sessions" value={formatInteger(report.userActivity.paidSessionCount)} />
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Peak Hour Analysis</h2>
                <p>Hourly distribution of reservation and session records.</p>
              </div>
            </div>

            <div className="report-bars">
              {topPeakHours.map((item) => (
                <PeakHourBar key={item.hour} item={item} maxValue={getPeakHourMax(topPeakHours)} />
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Station Breakdown</h2>
                <p>Revenue, reservation volume, and capacity breakdown listed by station.</p>
              </div>
            </div>

            <div className="stack-list">
              {report.stationBreakdown.map((station) => (
                <StationBreakdownCard key={station.stationId} station={station} />
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>Latest records of payment, session, and reservation events.</p>
              </div>
            </div>

            {report.recentActivity.length === 0 ? (
              <div className="session-empty-state">
                <span className="session-empty-state__eyebrow">No Records</span>
                <strong>No activity to report yet.</strong>
                <p>New payment, session, or reservation records will appear here.</p>
              </div>
            ) : (
              <div className="stack-list">
                {report.recentActivity.map((activity) => (
                  <RecentActivityCard
                    activity={activity}
                    key={`${activity.type}-${activity.createdAt}-${activity.title}`}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function ReportMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <article className="summary-card report-card">
      <span className="insight-card__label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PeakHourBar({
  item,
  maxValue,
}: {
  item: AdminPeakHourReportItem;
  maxValue: number;
}): JSX.Element {
  const total = item.reservationCount + item.sessionCount;
  const width = maxValue > 0 ? (total / maxValue) * 100 : 0;

  return (
    <article className="report-bar">
      <div className="report-bar__meta">
        <strong>{item.hour}</strong>
        <span>{formatInteger(total)} records</span>
      </div>
      <div className="report-bar__track">
        <div className="report-bar__fill" style={{ width: `${width}%` }} />
      </div>
      <div className="report-bar__stats">
        <span>Reservations: {formatInteger(item.reservationCount)}</span>
        <span>Sessions: {formatInteger(item.sessionCount)}</span>
      </div>
    </article>
  );
}

function StationBreakdownCard({
  station,
}: {
  station: AdminStationBreakdownItem;
}): JSX.Element {
  return (
    <article className="reservation-item">
      <div className="reservation-item__header">
        <div>
          <h3>{station.stationName}</h3>
          <p>
            {formatInteger(station.totalChargers)} devices · {formatCurrency(station.revenue)} revenue
          </p>
        </div>
        <span className="status-pill status-pill--completed">
          {formatHours(station.reservedHours)} reserved
        </span>
      </div>

      <div className="ledger-card__grid">
        <article className="ledger-card__metric">
          <span>Available</span>
          <strong>{formatInteger(station.availableChargers)}</strong>
        </article>
        <article className="ledger-card__metric">
          <span>Occupied</span>
          <strong>{formatInteger(station.occupiedChargers)}</strong>
        </article>
        <article className="ledger-card__metric">
          <span>Offline</span>
          <strong>{formatInteger(station.offlineChargers)}</strong>
        </article>
        <article className="ledger-card__metric">
          <span>Reservations</span>
          <strong>{formatInteger(station.reservationCount)}</strong>
        </article>
        <article className="ledger-card__metric">
          <span>Completed Sessions</span>
          <strong>{formatInteger(station.completedSessionCount)}</strong>
        </article>
      </div>
    </article>
  );
}

function RecentActivityCard({
  activity,
}: {
  activity: AdminRecentActivityItem;
}): JSX.Element {
  return (
    <article className="reservation-item">
      <div className="reservation-item__header">
        <div>
          <h3>{activity.title}</h3>
          <p>{activity.description}</p>
        </div>
        <span className={`status-pill ${toActivityTone(activity.type)}`}>
          {toActivityLabel(activity.type)}
        </span>
      </div>

      <div className="detail-grid">
        <div>
          <dt>Time</dt>
          <dd>{formatDateTime(activity.createdAt)}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{activity.amount !== null ? formatCurrency(activity.amount) : '—'}</dd>
        </div>
      </div>
    </article>
  );
}

function getPeakHourMax(items: AdminPeakHourReportItem[]): number {
  return items.reduce((maxValue, item) => {
    const total = item.reservationCount + item.sessionCount;
    return total > maxValue ? total : maxValue;
  }, 0);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `%${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(value: number): string {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} h`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toActivityLabel(type: AdminRecentActivityItem['type']): string {
  switch (type) {
    case 'PAYMENT':
      return 'Payment';
    case 'SESSION':
      return 'Session';
    case 'RESERVATION':
      return 'Reservation';
    case 'CANCELLATION':
      return 'Cancellation';
    default:
      return 'Activity';
  }
}

function toActivityTone(type: AdminRecentActivityItem['type']): string {
  switch (type) {
    case 'PAYMENT':
      return 'status-pill--available';
    case 'SESSION':
      return 'status-pill--completed';
    case 'RESERVATION':
      return 'status-pill--occupied';
    case 'CANCELLATION':
      return 'status-pill--offline';
    default:
      return 'status-pill--completed';
  }
}
