import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminReportsPage } from '../features/admin/pages/AdminReportsPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ChargingSessionSummaryPage } from '../features/chargingSessions/pages/ChargingSessionSummaryPage';
import { ChargingSessionsPage } from '../features/chargingSessions/pages/ChargingSessionsPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { HistoryPage } from '../features/history/pages/HistoryPage';
import { IssuesPage } from '../features/issues/pages/IssuesPage';
import { NotificationsPage } from '../features/notifications/pages/NotificationsPage';
import { OperatorPage } from '../features/operator/pages/OperatorPage';
import { NewReservationPage } from '../features/reservations/pages/NewReservationPage';
import { ReservationsPage } from '../features/reservations/pages/ReservationsPage';
import { AppLayout } from '../features/shared/components/AppLayout';
import {
  GuestOnlyRoute,
  HomeRedirect,
  RequireAuth,
  RequireRole,
} from '../features/shared/components/RouteGate';
import { RoutePage } from '../features/stations/pages/RoutePage';
import { StationsPage } from '../features/stations/pages/StationsPage';
import { VehiclesPage } from '../features/vehicles/pages/VehiclesPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomeRedirect />,
      },
      {
        path: 'login',
        element: (
          <GuestOnlyRoute>
            <LoginPage />
          </GuestOnlyRoute>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestOnlyRoute>
            <RegisterPage />
          </GuestOnlyRoute>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <DashboardPage />
          </RequireRole>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireRole allowedRoles={['ADMIN']}>
            <Navigate replace to="/admin/reports" />
          </RequireRole>
        ),
      },
      {
        path: 'admin/reports',
        element: (
          <RequireRole allowedRoles={['ADMIN']}>
            <AdminReportsPage />
          </RequireRole>
        ),
      },
      {
        path: 'vehicles',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <VehiclesPage />
          </RequireRole>
        ),
      },
      {
        path: 'stations',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <StationsPage />
          </RequireRole>
        ),
      },
      {
        path: 'route/:stationId',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <RoutePage />
          </RequireRole>
        ),
      },
      {
        path: 'charging-sessions',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <ChargingSessionsPage />
          </RequireRole>
        ),
      },
      {
        path: 'charging-sessions/:id/summary',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <ChargingSessionSummaryPage />
          </RequireRole>
        ),
      },
      {
        path: 'history',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <HistoryPage />
          </RequireRole>
        ),
      },
      {
        path: 'notifications',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <NotificationsPage />
          </RequireRole>
        ),
      },
      {
        path: 'operator',
        element: (
          <RequireRole allowedRoles={['OPERATOR']}>
            <OperatorPage />
          </RequireRole>
        ),
      },
      {
        path: 'issues',
        element: (
          <RequireAuth>
            <Navigate replace to="/issues/report" />
          </RequireAuth>
        ),
      },
      {
        path: 'issues/report',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <IssuesPage />
          </RequireRole>
        ),
      },
      {
        path: 'reservations/new',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <NewReservationPage />
          </RequireRole>
        ),
      },
      {
        path: 'reservations',
        element: (
          <RequireRole allowedRoles={['EV_DRIVER']}>
            <ReservationsPage />
          </RequireRole>
        ),
      },
    ],
  },
]);
