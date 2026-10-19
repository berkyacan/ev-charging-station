import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';
import { getDefaultPathForRole } from '../../shared/auth/roleAccess';
import { translateUiMessage } from '../../shared/utils/messages';
import { login } from '../api/authApi';

interface LoginFormState {
  email: string;
  password: string;
}

const initialFormState: LoginFormState = {
  email: '',
  password: '',
};

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const [formState, setFormState] = useState<LoginFormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accessMetrics = [
    { label: 'Network', value: 'Managed' },
    { label: 'Overview', value: 'Ready' },
    { label: 'Access', value: 'Secure' },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(formState);
      await setAuthenticatedSession(response.accessToken, response.user);
      navigate(getDefaultPathForRole(response.user?.role), { replace: true });
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const { name, value } = event.target;

    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  }

  return (
    <section className="auth-shell">
      <div className="auth-showcase">
        <div className="auth-showcase__header">
          <span className="auth-showcase__eyebrow">Access Portal</span>
          <h2>EV Charging Network Management</h2>
          <p>Secure access for station discovery, reservations, charging sessions, and network operations.</p>
        </div>

        <div className="auth-showcase__grid">
          <article className="auth-showcase__item">
            <strong>Station Network</strong>
            <span>Live charger availability and network visibility.</span>
          </article>
          <article className="auth-showcase__item">
            <strong>Reservations</strong>
            <span>Reservation flows validated by charger context.</span>
          </article>
          <article className="auth-showcase__item">
            <strong>Operations</strong>
            <span>Session tracking, service status, and operator tools.</span>
          </article>
        </div>

        <div className="auth-showcase__panel">
          <span className="auth-showcase__panel-label">Workspace Scope</span>
          <strong>Driver, operator, and admin access in a single secure environment.</strong>
          <p>Switch from reservations to operation monitoring via the same portal.</p>
        </div>

        <div className="auth-metrics">
          {accessMetrics.map((metric) => (
            <article className="auth-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-card__header">
          <span className="eyebrow">Secure Access</span>
          <h1>Sign in to ChargeNet Console</h1>
          <p>Access your workspace to proceed to operations, reservations, and charging transactions.</p>
        </div>

        <div className="auth-portal-note">
          <span className="auth-portal-note__label">Account Access</span>
          <p>Use your assigned workspace credentials and keep your access information secure.</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field-group" htmlFor="email">
            <span className="field-label">Email</span>
            <input
              autoComplete="email"
              className="text-input"
              id="email"
              name="email"
              onChange={handleInputChange}
              placeholder="example@company.com"
              required
              type="email"
              value={formState.email}
            />
            <span className="field-hint">Use the email address defined for your workspace access.</span>
          </label>

          <label className="field-group" htmlFor="password">
            <span className="field-label">Password</span>
            <input
              autoComplete="current-password"
              className="text-input"
              id="password"
              name="password"
              onChange={handleInputChange}
              placeholder="Passwordnizi girin"
              required
              type="password"
              value={formState.password}
            />
            <span className="field-hint">Passwordler büyük ve küçük harfe duyarlıdır.</span>
          </label>

          {errorMessage ? (
            <div className="message-banner message-banner--error" role="alert">
              <strong className="message-banner__title">Sign in failed</strong>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create a workspace account</Link>
        </p>
      </div>
    </section>
  );
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Sign in is currently unavailable. Please try again.';
}
