/**
 * UC-02: Station Operator Manages Charger Availability
 * ─────────────────────────────────────────────────────────────────────────────
 * Actors : Station Operator
 *
 * Main flow:
 *   1. Operator logs in to management panel.
 *   2. Operator views chargers belonging to their station.
 *   3. Operator sets charger status: AVAILABLE | OCCUPIED | OFFLINE.
 *   4. If set to OFFLINE → system cancels affected reservations.
 *   5. Cancelled users receive a notification.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST CASE TABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * | ID       | Requirement Tested                          | Expected Outcome           |
 * |----------|---------------------------------------------|----------------------------|
 * | TC-02-01 | Operator sets charger to AVAILABLE          | status updated, 0 cancelled|
 * | TC-02-02 | Operator sets charger to OFFLINE (no resv.) | status updated, 0 cancelled|
 * | TC-02-03 | OFFLINE with pending reservations           | reservations cancelled     |
 * | TC-02-04 | Cancelled users receive notification        | createNotification called  |
 * | TC-02-05 | Non-operator role is rejected               | ForbiddenException         |
 * | TC-02-06 | Charger ID not found                        | NotFoundException          |
 * | TC-02-07 | OFFLINE with active charging session        | session not cancelled      |
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ChargerStatus,
  ChargerType,
  ChargingSessionStatus,
  ConnectorType,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OperatorService } from './operator.service';

// ─── Shared test data ─────────────────────────────────────────────────────────

const OPERATOR_USER = { sub: 'op-1', email: 'op@station.com', role: UserRole.OPERATOR };
const DRIVER_USER   = { sub: 'drv-1', email: 'driver@mail.com', role: UserRole.EV_DRIVER };

function buildCharger(overrides?: Partial<{ status: ChargerStatus }>) {
  return {
    id:            'charger-1',
    stationId:     'station-1',
    label:         'DC 50kW #01',
    chargerType:   ChargerType.DC,
    connectorType: ConnectorType.CCS,
    powerOutputKW: new Prisma.Decimal(50),
    pricePerKWh:   new Prisma.Decimal(4),
    status:        overrides?.status ?? ChargerStatus.AVAILABLE,
    createdAt:     new Date('2026-01-01'),
  };
}

function buildReservation(overrides?: {
  id?: string;
  userId?: string;
  chargingSession?: { id: string; status: ChargingSessionStatus } | null;
}) {
  return {
    id:             overrides?.id     ?? 'res-1',
    userId:         overrides?.userId ?? 'user-1',
    endTime:        new Date('2026-06-01T14:00:00.000Z'),
    startTime:      new Date('2026-06-01T12:00:00.000Z'),
    chargingSession: overrides?.chargingSession ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UC-02 — Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-02 | OperatorService — charger availability management', () => {
  let operatorService: OperatorService;
  let prismaService: {
    charger:     { findUnique: jest.Mock; update: jest.Mock };
    reservation: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let notificationsService: { createNotification: jest.Mock };

  beforeEach(() => {
    prismaService = {
      charger:     { findUnique: jest.fn(), update: jest.fn() },
      reservation: { findMany: jest.fn(), updateMany: jest.fn() },
    };
    notificationsService = { createNotification: jest.fn().mockResolvedValue(undefined) };

    // Default: no affected reservations
    prismaService.reservation.findMany.mockResolvedValue([]);
    prismaService.reservation.updateMany.mockResolvedValue({ count: 0 });

    operatorService = new OperatorService(
      prismaService as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );

    // Pin "now" so reservation query cutoff is stable
    jest.spyOn(
      operatorService as unknown as { getCurrentDate(): Date },
      'getCurrentDate',
    ).mockReturnValue(new Date('2026-06-01T10:00:00.000Z'));
  });

  // TC-02-01 ──────────────────────────────────────────────────────────────────
  it('TC-02-01 | Operator sets AVAILABLE → status updated, no reservations cancelled', async () => {
    prismaService.charger.findUnique.mockResolvedValue(buildCharger({ status: ChargerStatus.OFFLINE }));
    prismaService.charger.update.mockResolvedValue(buildCharger({ status: ChargerStatus.AVAILABLE }));

    const result = await operatorService.updateChargerStatus(
      OPERATOR_USER, 'charger-1', { status: ChargerStatus.AVAILABLE },
    );

    expect(result.updatedCharger.status).toBe(ChargerStatus.AVAILABLE);
    expect(result.cancelledReservationsCount).toBe(0);
    expect(prismaService.reservation.updateMany).not.toHaveBeenCalled();
  });

  // TC-02-02 ──────────────────────────────────────────────────────────────────
  it('TC-02-02 | Operator sets OFFLINE with no pending reservations → 0 cancellations', async () => {
    prismaService.charger.findUnique.mockResolvedValue(buildCharger({ status: ChargerStatus.AVAILABLE }));
    prismaService.charger.update.mockResolvedValue(buildCharger({ status: ChargerStatus.OFFLINE }));
    prismaService.reservation.findMany.mockResolvedValue([]); // no affected reservations

    const result = await operatorService.updateChargerStatus(
      OPERATOR_USER, 'charger-1', { status: ChargerStatus.OFFLINE },
    );

    expect(result.updatedCharger.status).toBe(ChargerStatus.OFFLINE);
    expect(result.cancelledReservationsCount).toBe(0);
  });

  // TC-02-03 ──────────────────────────────────────────────────────────────────
  it('TC-02-03 | OFFLINE with pending reservations → reservations are cancelled', async () => {
    prismaService.charger.findUnique.mockResolvedValue(buildCharger({ status: ChargerStatus.AVAILABLE }));
    prismaService.charger.update.mockResolvedValue(buildCharger({ status: ChargerStatus.OFFLINE }));
    prismaService.reservation.findMany.mockResolvedValue([
      buildReservation({ id: 'res-1', userId: 'user-1' }),
      buildReservation({ id: 'res-2', userId: 'user-2' }),
    ]);
    prismaService.reservation.updateMany.mockResolvedValue({ count: 2 });

    const result = await operatorService.updateChargerStatus(
      OPERATOR_USER, 'charger-1', { status: ChargerStatus.OFFLINE },
    );

    expect(prismaService.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['res-1', 'res-2'] } },
      data:  { status: ReservationStatus.CANCELLED },
    });
    expect(result.cancelledReservationsCount).toBe(2);
  });

  // TC-02-04 ──────────────────────────────────────────────────────────────────
  it('TC-02-04 | Each affected user receives a cancellation notification', async () => {
    prismaService.charger.findUnique.mockResolvedValue(buildCharger({ status: ChargerStatus.AVAILABLE }));
    prismaService.charger.update.mockResolvedValue(buildCharger({ status: ChargerStatus.OFFLINE }));
    prismaService.reservation.findMany.mockResolvedValue([
      buildReservation({ id: 'res-1', userId: 'user-1' }),
      buildReservation({ id: 'res-2', userId: 'user-2' }),
    ]);
    prismaService.reservation.updateMany.mockResolvedValue({ count: 2 });

    await operatorService.updateChargerStatus(
      OPERATOR_USER, 'charger-1', { status: ChargerStatus.OFFLINE },
    );

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1', 'RESERVATION_CANCELLED', expect.any(String),
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-2', 'RESERVATION_CANCELLED', expect.any(String),
    );
  });

  // TC-02-05 ──────────────────────────────────────────────────────────────────
  it('TC-02-05 | Non-operator role (EV_DRIVER) is rejected with ForbiddenException', async () => {
    await expect(
      operatorService.updateChargerStatus(
        DRIVER_USER, 'charger-1', { status: ChargerStatus.OFFLINE },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaService.charger.findUnique).not.toHaveBeenCalled();
  });

  // TC-02-06 ──────────────────────────────────────────────────────────────────
  it('TC-02-06 | Charger not found returns NotFoundException', async () => {
    prismaService.charger.findUnique.mockResolvedValue(null);

    await expect(
      operatorService.updateChargerStatus(
        OPERATOR_USER, 'nonexistent-charger', { status: ChargerStatus.AVAILABLE },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // TC-02-07 ──────────────────────────────────────────────────────────────────
  it('TC-02-07 | Active charging session is NOT cancelled when going OFFLINE', async () => {
    prismaService.charger.findUnique.mockResolvedValue(buildCharger({ status: ChargerStatus.OCCUPIED }));
    prismaService.charger.update.mockResolvedValue(buildCharger({ status: ChargerStatus.OFFLINE }));
    prismaService.reservation.findMany.mockResolvedValue([
      buildReservation({
        id: 'res-active',
        userId: 'user-1',
        chargingSession: { id: 'session-1', status: ChargingSessionStatus.ACTIVE },
      }),
    ]);

    const result = await operatorService.updateChargerStatus(
      OPERATOR_USER, 'charger-1', { status: ChargerStatus.OFFLINE },
    );

    // The reservation with an active charging session should NOT be cancelled
    expect(result.cancelledReservationsCount).toBe(0);
    expect(result.affectedActiveSessionCount).toBe(1);
    expect(prismaService.reservation.updateMany).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
