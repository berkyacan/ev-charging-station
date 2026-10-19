import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { getRoleLabel } from '../../shared/auth/roleAccess';
import { PageHero } from '../../shared/components/PageHero';

interface DashboardCard {
  actionLabel?: string;
  code: string;
  description: string;
  path?: string;
  title: string;
}

const dashboardCards: DashboardCard[] = [
  {
    actionLabel: 'Open Vehicles',
    code: 'VR',
    path: '/vehicles',
    title: 'Vehicle Registration',
    description: 'Review EV profiles and charging compatibility records.',
  },
  {
    actionLabel: 'Open Stations',
    code: 'SN',
    path: '/stations',
    title: 'Station Network',
    description: 'Monitor station availability and charger readiness.',
  },
  {
    actionLabel: 'Open Reservations',
    code: 'RO',
    path: '/reservations',
    title: 'Reservation Operations',
    description: 'Track reservations, status changes, and reservation movements.',
  },
  {
    actionLabel: 'Open Sessions',
    code: 'CS',
    path: '/charging-sessions',
    title: 'Charging Sessions',
    description: 'Start and complete charging flows from confirmed reservations.',
  },
  {
    actionLabel: 'Open History',
    code: 'SH',
    path: '/history',
    title: 'Session History',
    description: 'Review completed sessions, energy usage, and payment records.',
  },
];

interface GuidedFlowStep {
  actionLabel: string;
  code: string;
  description: string;
  path: string;
  title: string;
}

const guidedFlowSteps: GuidedFlowStep[] = [
  {
    actionLabel: 'Open Vehicles',
    code: '01',
    description: 'Register your vehicle profile before proceeding to station discovery.',
    path: '/vehicles',
    title: 'Vehicle Registration',
  },
  {
    actionLabel: 'Open Stations',
    code: '02',
    description: 'Review available chargers, select a station, and proceed to reservation.',
    path: '/stations',
    title: 'Station Discovery',
  },
  {
    actionLabel: 'Open Charging',
    code: '03',
    description: 'Confirm reservation, manage session, and complete with payment confirmation.',
    path: '/charging-sessions',
    title: 'Reservation and Charging Session',
  },
];

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { currentUser, isLoadingUser, role } = useAuth();
  const roleLabel = getRoleLabel(role);
  const systemReadiness = isLoadingUser ? 'Checking' : 'Ready';
  const workflowStatus = isLoadingUser ? 'Loading' : 'Ready';
  const isAdminWorkspace = role === 'ADMIN';
  const availableModuleCount = isAdminWorkspace ? 1 : dashboardCards.length;

  return (
    <section className="page-shell">
      <PageHero
        badge="Operations panel"
        description={
          isAdminWorkspace
            ? 'Review report access, workspace readiness, and management controls.'
            : 'Monitor charging operations, station availability, reservations, and driver movements from a single workspace.'
        }
        eyebrow="Control Center"
        metrics={[
          {
            label: 'Active Account',
            value: isLoadingUser ? 'Loading' : currentUser?.name ?? 'User',
            hint: roleLabel,
          },
          {
            label: 'Charging Operations',
            value: String(availableModuleCount),
            hint: isAdminWorkspace ? 'Management reports and access controls' : 'Driver workspace modules',
          },
          {
            label: 'Station Availability',
            value: isAdminWorkspace ? 'Limited' : workflowStatus,
            hint: isAdminWorkspace ? 'Reporting is not enabled in this workspace' : 'Vehicle → Station → Reservation',
          },
          {
            label: 'System Readiness',
            value: systemReadiness,
            hint: 'Identity profile and workspace access verified.',
          },
        ]}
        title={isAdminWorkspace ? 'Admin Reports' : 'Network Overview'}
      />

      {isAdminWorkspace ? (
        <>
          <div className="card">
            <div className="helper-card helper-card--split">
              <div>
                <span className="helper-card__eyebrow">Admin Reports</span>
                <h2>Advanced reporting is not enabled in this workspace.</h2>
                <p>This module is currently unavailable. Contact your administrator for access.</p>
              </div>
              <div className="reservation-actions">
                <button className="secondary-button" onClick={() => navigate('/dashboard')} type="button">
                  Refresh Overview
                </button>
              </div>
            </div>
          </div>

          <section className="card">
            <div className="session-empty-state">
              <span className="session-empty-state__eyebrow">Module Unavailable</span>
              <strong>This module is currently unavailable.</strong>
              <p>Advanced reporting is not enabled in this workspace. Erişim için yöneticinizle iletişime geçin.</p>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="card">
            <div className="helper-card helper-card--split">
              <div>
                <span className="helper-card__eyebrow">Driver Workspace</span>
                <h2>Start with vehicle registration</h2>
                <p>Progress from vehicle setup to station discovery, reservation, route guidance, charging, and payment confirmation.</p>
              </div>
              <div className="reservation-actions">
                <Link className="primary-button primary-button--auto" to="/vehicles">
                  Open Vehicle Registration
                </Link>
                <Link className="secondary-button secondary-button--link" to="/stations">
                  Open Station Finder
                </Link>
              </div>
            </div>
          </div>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Charging Operations</h2>
                <p>Progress through three connected stages in the main flow.</p>
              </div>
            </div>

            <div className="dashboard-card-grid">
              {guidedFlowSteps.map((step) => (
                <article className="feature-card" key={step.code}>
                  <span className="feature-card__note">Stage {step.code}</span>
                  <h2>{step.title}</h2>
                  <p>{step.description}</p>
                  <Link className="secondary-button secondary-button--link" to={step.path}>
                    {step.actionLabel}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Workspace Modules</h2>
                <p>Open the module you need for the next operation step.</p>
              </div>
            </div>

            <div className="dashboard-card-grid">
              {dashboardCards.map((card) => (
                <article className="feature-card" key={card.title}>
                  <span className="feature-card__note">{card.code}</span>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                  {card.path ? (
                    <Link className="secondary-button secondary-button--link" to={card.path}>
                      {card.actionLabel ?? 'Open'}
                    </Link>
                  ) : (
                    <span className="muted-label">This module is currently unavailable.</span>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
