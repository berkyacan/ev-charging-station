import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';
import { getDefaultPathForRole } from '../../shared/auth/roleAccess';
import { translateUiMessage } from '../../shared/utils/messages';
import { register } from '../api/authApi';

interface RegisterFormState {
  name: string;
  email: string;
  password: string;
}

const initialFormState: RegisterFormState = {
  name: '',
  email: '',
  password: '',
};

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const [formState, setFormState] = useState<RegisterFormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const onboardingMetrics = [
    { label: 'Access', value: 'Ready' },
    { label: 'Security', value: 'Managed' },
    { label: 'Workspace', value: 'Ready' },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await register(formState);
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
          <p>Create a secure workspace account for station discovery, reservations, and charging operations.</p>
        </div>

        <div className="auth-showcase__grid">
          <article className="auth-showcase__item">
            <strong>Network Access</strong>
            <span>Single account for reservations, activities, and charging records.</span>
          </article>
          <article className="auth-showcase__item">
            <strong>Reservation Flow</strong>
            <span>Progress from station discovery to verified reservation flow.</span>
          </article>
          <article className="auth-showcase__item">
            <strong>Session Tracking</strong>
            <span>Review charging usage, payment records, and network events.</span>
          </article>
        </div>

        <div className="auth-showcase__panel">
          <span className="auth-showcase__panel-label">Workspace Scope</span>
          <strong>Designed for drivers and operations teams managing the same charging network.</strong>
          <p>Create your access once, then proceed to vehicles, reservations, and charging operations.</p>
        </div>

        <div className="auth-metrics">
          {onboardingMetrics.map((metric) => (
            <article className="auth-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-card__header">
          <span className="eyebrow">Create Account</span>
          <h1>Create your workspace account</h1>
          <p>Create secure access to the charging network management portal.</p>
        </div>

        <div className="auth-portal-note">
          <span className="auth-portal-note__label">Security Note</span>
          <p>Use a unique password and keep your workspace credentials confidential.</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field-group" htmlFor="name">
            <span className="field-label">Full Name</span>
            <input
              autoComplete="name"
              className="text-input"
              id="name"
              name="name"
              onChange={handleInputChange}
              placeholder="Enter your first and last name"
              required
              type="text"
              value={formState.name}
            />
            <span className="field-hint">Use the full name associated with your workspace access.</span>
          </label>

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
            <span className="field-hint">This email will be used for login and workspace access.</span>
          </label>

          <label className="field-group" htmlFor="password">
            <span className="field-label">Password</span>
            <input
              autoComplete="new-password"
              className="text-input"
              id="password"
              minLength={6}
              name="password"
              onChange={handleInputChange}
              placeholder="Create a password"
              required
              type="password"
              value={formState.password}
            />
            <span className="field-hint">Use at least 6 characters.</span>
          </label>

          {errorMessage ? (
            <div className="message-banner message-banner--error" role="alert">
              <strong className="message-banner__title">Account creation failed</strong>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Registration is currently unavailable. Please try again.';
}
