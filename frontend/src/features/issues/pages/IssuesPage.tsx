import { Link } from 'react-router-dom';
import { PageHero } from '../../shared/components/PageHero';

export function IssuesPage(): JSX.Element {
  return (
    <section className="page-shell">
      <PageHero
        actions={
          <>
            <Link className="secondary-button secondary-button--link" to="/dashboard">
              Back to Overview
            </Link>
            <Link className="secondary-button secondary-button--link" to="/stations">
              Station Finder
            </Link>
          </>
        }
        badge="Module Status"
        description="This module is currently unavailable."
        eyebrow="Issue Log"
        metrics={[
          {
            label: 'Status',
            value: 'Unavailable',
            hint: 'This feature is not enabled in this workspace',
          },
          {
            label: 'Access',
            value: 'Limited',
            hint: 'Controlled status message shown instead of a blank screen',
          },
          {
            label: 'Workspace',
            value: 'Core Operations',
            hint: 'Vehicle, station, reservation, and charging flow available',
          },
        ]}
        title="Issue Log"
      />

      <div className="card">
        <div className="helper-card helper-card--split">
          <div>
            <span className="helper-card__eyebrow">Module Availability</span>
            <h2>This module is currently unavailable.</h2>
            <p>
              This feature is not enabled in this workspace. Access için yöneticinizle iletişime geçin.
            </p>
            <div className="helper-card__specs">
              <span className="helper-chip">Issue log disabled</span>
              <span className="helper-chip">Core charging flow active</span>
              <span className="helper-chip">Workspace access monitored</span>
            </div>
          </div>

          <div className="reservation-actions">
            <Link className="primary-button primary-button--auto" to="/vehicles">
              Back to Vehicle Registration
            </Link>
            <Link className="secondary-button secondary-button--link" to="/dashboard">
              Overview
            </Link>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Workspace Accessi</h2>
            <p>Issue log is not enabled in this workspace.</p>
          </div>
        </div>

        <div className="session-empty-state">
          <span className="session-empty-state__eyebrow">Unavailable</span>
          <strong>This module is currently unavailable.</strong>
          <p>
            This feature is not enabled in this workspace. Access için yöneticinizle iletişime geçin.
          </p>
        </div>
      </section>
    </section>
  );
}
