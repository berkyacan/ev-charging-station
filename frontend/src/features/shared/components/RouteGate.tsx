import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  getDefaultPathForRole,
  isRoleAllowed,
} from '../auth/roleAccess';
import type { UserRole } from '../types';

interface RouteGateProps {
  children: ReactNode;
}

interface RequireRoleProps extends RouteGateProps {
  allowedRoles: UserRole[];
}

export function HomeRedirect(): JSX.Element {
  const { hasToken, isLoadingUser, role } = useAuth();

  if (!hasToken) {
    return <Navigate replace to="/login" />;
  }

  if (isLoadingUser && !role) {
    return <RouteGateFallback message="Erişim profili yükleniyor..." />;
  }

  if (!role) {
    return <Navigate replace to="/login" />;
  }

  const targetPath = getDefaultPathForRole(role);

  return <Navigate replace to={targetPath} />;
}

export function RequireAuth({ children }: RouteGateProps): JSX.Element {
  const { hasToken, isLoadingUser, role } = useAuth();

  if (!hasToken) {
    return <Navigate replace to="/login" />;
  }

  if (isLoadingUser && !role) {
    return <RouteGateFallback message="Çalışma alanı yetkileri doğrulanıyor..." />;
  }

  if (!role) {
    return <Navigate replace to="/login" />;
  }

  return <>{children}</>;
}

export function GuestOnlyRoute({ children }: RouteGateProps): JSX.Element {
  const { hasToken, isLoadingUser, role } = useAuth();

  if (!hasToken) {
    return <>{children}</>;
  }

  if (isLoadingUser && !role) {
    return <RouteGateFallback message="Erişim profili yükleniyor..." />;
  }

  if (role) {
    return <Navigate replace to={getDefaultPathForRole(role)} />;
  }

  return <>{children}</>;
}

export function RequireRole({
  allowedRoles,
  children,
}: RequireRoleProps): JSX.Element {
  const { hasToken, isLoadingUser, role } = useAuth();

  if (!hasToken) {
    return <Navigate replace to="/login" />;
  }

  if (isLoadingUser && !role) {
    return <RouteGateFallback message="Rol bazlı erişim doğrulanıyor..." />;
  }

  if (!role) {
    return <Navigate replace to="/login" />;
  }

  if (!isRoleAllowed(role, allowedRoles)) {
    return <Navigate replace to={getDefaultPathForRole(role)} />;
  }

  return <>{children}</>;
}

function RouteGateFallback({ message }: { message: string }): JSX.Element {
  return (
    <section className="page-shell">
      <div className="card">
        <div aria-live="polite" className="session-empty-state session-empty-state--loading" role="status">
          <span className="session-empty-state__eyebrow">Yükleniyor</span>
          <strong>Preparing access profile</strong>
          <p>{message}</p>
        </div>
      </div>
    </section>
  );
}
