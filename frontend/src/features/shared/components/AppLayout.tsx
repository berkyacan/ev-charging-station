import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  getDefaultPathForRole,
  getRoleLabel,
  getSidebarLinksForRole,
  guestLinks,
  resolveSectionForPath,
} from '../auth/roleAccess';

export function AppLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentUser, hasToken, role, signOut } = useAuth();
  const primaryLinks = hasToken ? getSidebarLinksForRole(role) : guestLinks;
  const activeSection = resolveSectionForPath(location.pathname, role);
  const currentSectionLabel = activeSection?.label ?? (hasToken ? 'Workspace' : 'Access');
  const currentSectionCaption =
    activeSection?.caption ??
    (hasToken
      ? 'Monitor network activity and switch between workspaces.'
      : 'Sign in to access the charging network workspace.');
  const currentRoleLabel = getRoleLabel(role);
  const isAdminWorkspace = role === 'ADMIN';
  const workspaceDateLabel = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  function handleLogout(): void {
    signOut();
    navigate('/login', { replace: true });
  }

  function isNavLinkActive(targetPath: string): boolean {
    return (
      location.pathname === targetPath ||
      location.pathname.startsWith(`${targetPath}/`)
    );
  }

  return (
    <div className={hasToken ? 'app-shell app-shell--authenticated' : 'app-shell app-shell--guest'}>
      {hasToken ? (
        <>
          <button
            aria-hidden={!isMenuOpen}
            className={isMenuOpen ? 'app-scrim app-scrim--visible' : 'app-scrim'}
            onClick={() => setIsMenuOpen(false)}
            tabIndex={isMenuOpen ? 0 : -1}
            type="button"
          />

          <aside className={isMenuOpen ? 'app-sidebar app-sidebar--open' : 'app-sidebar'}>
            <div className="brand-block">
              <span className="brand-kicker">EV Charging Network Management</span>
              <Link className="brand-title" to={getDefaultPathForRole(role)}>
                ChargeNet Console
              </Link>
              <p className="brand-description">
                {role === 'OPERATOR'
                  ? 'Manage charger availability, station assets, and field operations.'
                  : isAdminWorkspace
                    ? 'Monitor revenue, usage, and user activity reports in a single admin view.'
                    : 'Manage stations, reservations, charging sessions, and driver operations.'}
              </p>
              <div className="brand-meta">
                <span className="brand-pill">
                  {isAdminWorkspace ? 'Admin Center' : 'Network Operations'}
                </span>
                <span className="brand-caption">{currentRoleLabel}</span>
                <span className="brand-caption">{workspaceDateLabel}</span>
              </div>
            </div>

            <nav
              aria-label="Primary navigation"
              className="app-sidebar__nav"
              id="primary-navigation"
            >
              <div className="app-sidebar__label">
                {isAdminWorkspace ? 'Reports' : 'Operations'}
              </div>
              <div className="main-nav__list">
                {primaryLinks.map((link) => (
                  <Link
                    aria-current={isNavLinkActive(link.to) ? 'page' : undefined}
                    className={
                      isNavLinkActive(link.to) ? 'nav-link nav-link--active' : 'nav-link'
                    }
                    key={link.to}
                    to={link.to}
                  >
                    <span aria-hidden="true" className="nav-link__icon">
                      {link.shortLabel}
                    </span>
                    <span className="nav-link__copy">
                      <strong>{link.label}</strong>
                      <span>{link.caption}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className="app-sidebar__footer">
              <div className="header-status">
                <span>{isAdminWorkspace ? "Today's Workspace" : "Today's Workspace"}</span>
                <strong>{currentSectionLabel}</strong>
                <small>
                  {currentUser?.name ? `${currentUser.name} · ${currentSectionCaption}` : currentSectionCaption}
                </small>
              </div>

              <button
                className="nav-button nav-button--strong"
                onClick={handleLogout}
                type="button"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </>
      ) : (
        <header className="guest-header">
          <div className="guest-header__inner">
            <div className="brand-block">
              <span className="brand-kicker">EV Charging Network Management</span>
              <Link className="brand-title" to="/login">
                ChargeNet Console
              </Link>
              <p className="brand-description">
                Secure access for station management, reservations, charging sessions, and network operations.
              </p>
            </div>

            <nav aria-label="Guest navigation" className="guest-nav">
              {guestLinks.map((link) => (
                <Link
                  aria-current={isNavLinkActive(link.to) ? 'page' : undefined}
                  className={
                    isNavLinkActive(link.to) ? 'nav-link nav-link--active' : 'nav-link'
                  }
                  key={link.to}
                  to={link.to}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      )}

      <div className="app-content">
        {hasToken ? (
          <header className="app-topbar">
            <div className="app-topbar__inner">
              <div className="app-topbar__section">
                <button
                  aria-controls="primary-navigation"
                  aria-expanded={isMenuOpen}
                  className="nav-toggle"
                  onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
                  type="button"
                >
                  {isMenuOpen ? 'Close' : 'Menu'}
                </button>

                <div className="app-topbar__copy">
                  <span className="app-topbar__eyebrow">
                    {isAdminWorkspace ? 'Active Page' : 'Current Page'}
                  </span>
                  <strong>{currentSectionLabel}</strong>
                  <span className="app-topbar__caption">{currentSectionCaption}</span>
                </div>
              </div>

              <div className="app-topbar__meta">
                <span className="app-topbar__chip">{currentRoleLabel}</span>
                <span className="app-topbar__chip">
                  {isAdminWorkspace ? 'Today' : 'Today'}: {workspaceDateLabel}
                </span>
                <span className="app-topbar__chip app-topbar__chip--subtle">
                  {isAdminWorkspace ? 'Secure Session' : 'Secure Session'}
                </span>
              </div>
            </div>
          </header>
        ) : null}

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
