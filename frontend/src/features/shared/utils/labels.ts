import type {
  ChargerStatus,
  ChargingSessionStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  UserRole,
} from '../types';

export function formatRoleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case 'EV_DRIVER':
      return 'Driver';
    case 'OPERATOR':
      return 'Operator';
    case 'ADMIN':
      return 'Admin';
    default:
      return 'User';
  }
}

export function formatChargerStatusLabel(
  status: ChargerStatus | string | null | undefined,
): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Available';
    case 'OCCUPIED':
      return 'Occupied';
    case 'OFFLINE':
      return 'Offline';
    default:
      return formatTokenLabel(status);
  }
}

export function formatReservationStatusLabel(
  status: ReservationStatus | string | null | undefined,
): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'COMPLETED':
      return 'Completed';
    default:
      return formatTokenLabel(status);
  }
}

export function formatChargingSessionStatusLabel(
  status: ChargingSessionStatus | string | null | undefined,
): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'COMPLETED':
      return 'Completed';
    default:
      return formatTokenLabel(status);
  }
}

export function formatPaymentStatusLabel(
  status: PaymentStatus | string | null | undefined,
): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'PAID':
      return 'Paid';
    default:
      return formatTokenLabel(status);
  }
}

export function formatPaymentMethodLabel(
  method: PaymentMethod | string | null | undefined,
): string {
  switch (method) {
    case 'DEMO_WALLET':
      return 'Wallet';
    case 'DEMO_CARD':
      return 'Registered Card';
    default:
      return formatTokenLabel(method);
  }
}

export function formatWorkflowStateLabel(
  state: 'alert' | 'complete' | 'current' | 'pending',
): string {
  switch (state) {
    case 'complete':
      return 'Completed';
    case 'current':
      return 'Current';
    case 'alert':
      return 'Action Required';
    case 'pending':
    default:
      return 'Pending';
  }
}

export function formatAvailabilityReason(
  reason: string | null | undefined,
): string | null {
  if (!reason) {
    return null;
  }

  const mappedReason = availabilityReasonMap[reason];

  return mappedReason ?? reason;
}

function formatTokenLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

const availabilityReasonMap: Record<string, string> = {
  'Reservation time is outside station operating hours.':
    'Reservation time is outside station operating hours.',
  'Charger is occupied for the selected time slot.':
    'Charger is occupied for the selected time slot.',
  'Charger is unavailable for the selected time slot.':
    'Charger is unavailable for the selected time slot.',
  'Charger is offline.': 'Charger is offline.',
};
