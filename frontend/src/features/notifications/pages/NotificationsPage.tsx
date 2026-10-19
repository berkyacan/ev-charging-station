import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import type { Notification } from '../../shared/types';
import { clearToken } from '../../shared/utils/authToken';
import {
  getMyNotifications,
  markNotificationAsRead,
} from '../api/notificationsApi';

export function NotificationsPage(): JSX.Element {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function loadNotifications(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const list = await getMyNotifications();
      setNotifications(list);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }
      setError('Notifications cannot be retrieved at this time.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkAsRead(notificationId: string): Promise<void> {
    setMarkingId(notificationId);

    try {
      const updated = await markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((n) => (n.id === updated.id ? updated : n)),
      );
    } catch {
      // silent error — can be retried if remains unread
    } finally {
      setMarkingId(null);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <section className="page-shell">
      <PageHero
        actions={
          <>
            <Link className="secondary-button secondary-button--link" to="/dashboard">
              Back to Overview
            </Link>
            <Link className="secondary-button secondary-button--link" to="/reservations">
              Reservations
            </Link>
          </>
        }
        badge="System notifications"
        description="Review system notifications for charging sessions, reservations, and operator changes."
        eyebrow="Notification Center"
        metrics={[
          {
            label: 'Total',
            value: isLoading ? 'Loading' : String(notifications.length),
            hint: 'All notifications',
          },
          {
            label: 'Unread',
            value: isLoading ? '—' : String(unreadCount),
            hint: 'Notifications not yet read',
          },
        ]}
        title="Notification Center"
      />

      {error ? (
        <div className="message-banner message-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Notifications</h2>
            <p>Reservation cancellations, charging completions, and system messages appear here.</p>
          </div>
        </div>

        {isLoading ? (
          <div
            aria-live="polite"
            className="session-empty-state session-empty-state--loading"
            role="status"
          >
            <span className="session-empty-state__eyebrow">Loading</span>
            <strong>Preparing notifications</strong>
            <p>Retrieving system messages.</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="session-empty-state">
            <span className="session-empty-state__eyebrow">No Notifications</span>
            <strong>No notifications yet</strong>
            <p>
              You will see a notification here when you create a reservation, complete charging, or when a station change occurs.
            </p>
          </div>
        ) : (
          <div className="stack-list">
            {notifications.map((notification) => (
              <article
                className={
                  notification.read
                    ? 'reservation-item'
                    : 'reservation-item reservation-launch-card--selected'
                }
                key={notification.id}
              >
                <div className="reservation-item__header">
                  <div>
                    <h3>{formatNotificationType(notification.type)}</h3>
                    <p>{notification.message}</p>
                  </div>
                  <div className="reservation-card__status">
                    {!notification.read ? (
                      <span className="status-pill status-pill--live">New</span>
                    ) : (
                      <span className="status-pill status-pill--completed">Read</span>
                    )}
                  </div>
                </div>

                <div className="reservation-launch-card__grid">
                  <article className="reservation-launch-card__metric">
                    <span>Date</span>
                    <strong>{formatDateTime(notification.createdAt)}</strong>
                  </article>
                  <article className="reservation-launch-card__metric">
                    <span>Type</span>
                    <strong>{formatNotificationType(notification.type)}</strong>
                  </article>
                </div>

                {!notification.read ? (
                  <div className="reservation-item__actions">
                    <button
                      className="secondary-button"
                      disabled={markingId === notification.id}
                      onClick={() => void handleMarkAsRead(notification.id)}
                      type="button"
                    >
                      {markingId === notification.id ? 'Marking...' : 'Mark as Read'}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatNotificationType(type: string): string {
  switch (type) {
    case 'RESERVATION_CANCELLED':
      return 'Reservation Cancelled';
    case 'SESSION_COMPLETED':
      return 'Charging Completed';
    case 'PAYMENT_CONFIRMED':
      return 'Payment Confirmed';
    case 'CHARGER_OFFLINE':
      return 'Charger Offline';
    case 'CHARGER_ONLINE':
      return 'Charger Online';
    default:
      return 'System Notification';
  }
}
