/**
 * UC-03: EV Driver Performs Charging Session and Payment
 * ─────────────────────────────────────────────────────────────────────────────
 * Actors : EV Driver, External Payment System / Wallet
 *
 * Main flow:
 *   1. Driver starts charging using a valid reservation.
 *   2. System marks the session ACTIVE and charger OCCUPIED.
 *   3. Driver submits energy meter readings (start kWh, end kWh).
 *   4. System calculates consumed energy and total cost.
 *   5. Driver selects a payment method (wallet / demo card).
 *   6. System deducts payment and returns receipt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST CASE TABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * | ID       | Requirement Tested                        | Expected Outcome                |
 * |----------|-----------------------------------------  |---------------------------------|
 * | TC-03-01 | Start session with valid reservation      | status = ACTIVE                 |
 * | TC-03-02 | Start without valid reservation           | NotFoundException               |
 * | TC-03-03 | Start session that already has a session  | CHARGING_SESSION_ALREADY_EXISTS |
 * | TC-03-04 | Complete session – cost calculation       | consumedKWh & totalCost correct |
 * | TC-03-05 | Payment with sufficient wallet balance    | wallet deducted, receipt issued |
 * | TC-03-06 | Payment with insufficient wallet balance  | INSUFFICIENT_WALLET_BALANCE     |
 * | TC-03-07 | Energy calculation: 100 kWh × 4 TL/kWh   | totalCost = 400 TL              |
 * | TC-03-08 | Energy end < start is invalid             | INVALID_ENERGY_RANGE            |
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NotFoundException } from '@nestjs/common';
import {
  ChargerStatus,
  ChargerType,
  ChargingSessionStatus,
  ConnectorType,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import {
  calculateConsumedKWh,
  calculateTotalCost,
  createChargingSessionSummary,
} from './domain/charging-session-summary';
import { ChargingSessionsService } from './charging-sessions.service';

// ─────────────────────────────────────────────────────────────────────────────
// UC-03 Part A — Pure cost calculation (no database, no mocks)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-03 | Cost Calculation (pure functions)', () => {

  // TC-03-07 ──────────────────────────────────────────────────────────────────
  it('TC-03-07 | 100 kWh consumed at 4 TL/kWh → total cost = 400 TL', () => {
    const consumed = calculateConsumedKWh(100, 200); // start=100, end=200
    const cost     = calculateTotalCost(consumed, 4);

    expect(consumed).toBe(100);
    expect(cost).toBe(400);
  });

  it('TC-03-07b | Fractional energy: 12.5 kWh × 6.50 TL/kWh = 81.25 TL', () => {
    const consumed = calculateConsumedKWh(87.5, 100);
    const cost     = calculateTotalCost(consumed, 6.5);

    expect(consumed).toBe(12.5);
    expect(cost).toBe(81.25);
  });

  // TC-03-08 ──────────────────────────────────────────────────────────────────
  it('TC-03-08 | End energy lower than start energy is invalid', () => {
    const result = createChargingSessionSummary(200, 100, 4); // end < start

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_ENERGY_RANGE');
  });

  it('TC-03-08b | Negative start energy is invalid', () => {
    const result = createChargingSessionSummary(-10, 50, 4);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('NEGATIVE_START_ENERGY');
  });

  it('TC-03-07c | Valid input returns summary with all fields', () => {
    const result = createChargingSessionSummary(50, 75, 5);

    expect(result.isValid).toBe(true);
    expect(result.summary?.consumedKWh).toBe(25);
    expect(result.summary?.totalCost).toBe(125);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-03 Part B — Service Layer (with mocked database)
// ─────────────────────────────────────────────────────────────────────────────

describe('UC-03 | ChargingSessionsService — start, complete, pay', () => {
  let chargingSessionsService: ChargingSessionsService;
  let prismaService: {
    $transaction:    jest.Mock;
    charger:         { update: jest.Mock; updateMany: jest.Mock };
    reservation:     { findFirst: jest.Mock; update: jest.Mock };
    chargingSession: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    user:            { findUnique: jest.Mock; update: jest.Mock };
  };
  let notificationsService: { createNotification: jest.Mock };

  beforeEach(() => {
    prismaService = {
      $transaction:    jest.fn(),
      charger:         { update: jest.fn(), updateMany: jest.fn() },
      reservation:     { findFirst: jest.fn(), update: jest.fn() },
      chargingSession: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      user:            { findUnique: jest.fn(), update: jest.fn() },
    };
    notificationsService = { createNotification: jest.fn().mockResolvedValue(undefined) };

    prismaService.$transaction.mockImplementation(
      async (callback: (client: typeof prismaService) => unknown) =>
        callback(prismaService),
    );

    chargingSessionsService = new ChargingSessionsService(
      prismaService as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );

    jest.spyOn(
      chargingSessionsService as unknown as { getCurrentDate(): Date },
      'getCurrentDate',
    ).mockReturnValue(new Date('2026-06-01T12:30:00.000Z')); // during reservation window
  });

  // TC-03-01 ──────────────────────────────────────────────────────────────────
  it('TC-03-01 | Start session with valid reservation → session is ACTIVE', async () => {
    setupReservationForStart({ hasChargingSession: false });
    prismaService.chargingSession.create.mockResolvedValue({ id: 'session-1' });
    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(null) // no active session for this user
      .mockResolvedValueOnce(buildFullSession({ status: ChargingSessionStatus.ACTIVE }));

    const result = await chargingSessionsService.startSessionForUser('user-1', {
      reservationId: 'res-1',
    });

    expect(prismaService.chargingSession.create).toHaveBeenCalled();
    expect(prismaService.charger.update).toHaveBeenCalledWith({
      where: { id: 'charger-1' },
      data:  { status: ChargerStatus.OCCUPIED },
    });
    expect(result.status).toBe(ChargingSessionStatus.ACTIVE);
  });

  // TC-03-02 ──────────────────────────────────────────────────────────────────
  it('TC-03-02 | Start session without valid reservation → NotFoundException', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(null);

    await expect(
      chargingSessionsService.startSessionForUser('user-1', { reservationId: 'nonexistent' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaService.chargingSession.create).not.toHaveBeenCalled();
  });

  // TC-03-03 ──────────────────────────────────────────────────────────────────
  it('TC-03-03 | Start when reservation already has a session → CHARGING_SESSION_ALREADY_EXISTS', async () => {
    setupReservationForStart({ hasChargingSession: true });

    await expect(
      chargingSessionsService.startSessionForUser('user-1', { reservationId: 'res-1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({ code: 'CHARGING_SESSION_ALREADY_EXISTS' }),
      }),
    });
  });

  // TC-03-04 ──────────────────────────────────────────────────────────────────
  it('TC-03-04 | Complete session → consumed energy and cost are correct', async () => {
    const sessionBeforeComplete = buildFullSession({ status: ChargingSessionStatus.ACTIVE });
    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(sessionBeforeComplete)  // findFirst in transaction
      .mockResolvedValueOnce(buildFullSession({       // hydratedSession after update
        status: ChargingSessionStatus.COMPLETED,
        startEnergyKWh: 100,
        endEnergyKWh:   175,
        consumedKWh:    75,
        totalCost:      300,
      }));

    const result = await chargingSessionsService.completeSessionForUser(
      'user-1', 'session-1',
      { startEnergyKWh: 100, endEnergyKWh: 175 },
    );

    // Verify the update was called with correct computed values
    expect(prismaService.chargingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startEnergyKWh: 100,
          endEnergyKWh:   175,
          consumedKWh:    75,
          totalCost:      300, // 75 kWh × 4 TL/kWh
          status:         ChargingSessionStatus.COMPLETED,
        }),
      }),
    );
    expect(result.status).toBe(ChargingSessionStatus.COMPLETED);
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'CHARGING_SESSION_COMPLETED',
      expect.any(String),
    );
  });

  // TC-03-05 ──────────────────────────────────────────────────────────────────
  it('TC-03-05 | Payment with sufficient wallet balance → wallet deducted, receipt issued', async () => {
    const completedSession = buildFullSession({
      status:    ChargingSessionStatus.COMPLETED,
      totalCost: 300,
    });
    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(completedSession)
      .mockResolvedValueOnce({ ...completedSession, paymentStatus: PaymentStatus.PAID });
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      demoWalletBalance: { toString: () => '500' }, // 500 TL > 300 TL cost
    });
    prismaService.user.update.mockResolvedValue({});

    await chargingSessionsService.confirmPaymentForUser(
      'user-1', 'session-1',
      { paymentMethod: PaymentMethod.DEMO_WALLET },
    );

    // Wallet should be deducted by 300 TL → 500 - 300 = 200
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data:  { demoWalletBalance: 200 },
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1', 'PAYMENT_CONFIRMED', expect.any(String),
    );
  });

  // TC-03-06 ──────────────────────────────────────────────────────────────────
  it('TC-03-06 | Insufficient wallet balance → INSUFFICIENT_WALLET_BALANCE', async () => {
    const completedSession = buildFullSession({
      status:    ChargingSessionStatus.COMPLETED,
      totalCost: 300,
    });
    prismaService.chargingSession.findFirst.mockResolvedValue(completedSession);
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      demoWalletBalance: { toString: () => '50' }, // 50 TL < 300 TL cost
    });

    await expect(
      chargingSessionsService.confirmPaymentForUser(
        'user-1', 'session-1',
        { paymentMethod: PaymentMethod.DEMO_WALLET },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({
          code: 'INSUFFICIENT_WALLET_BALANCE',
          details: expect.objectContaining({ walletBalance: 50, totalCost: 300 }),
        }),
      }),
    });

    expect(prismaService.user.update).not.toHaveBeenCalled();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function setupReservationForStart(options: { hasChargingSession: boolean }) {
    prismaService.reservation.findFirst.mockResolvedValue({
      id:     'res-1',
      userId: 'user-1',
      status: ReservationStatus.CONFIRMED,
      startTime: new Date('2026-06-01T12:00:00.000Z'),
      endTime:   new Date('2026-06-01T13:00:00.000Z'),
      charger: buildChargerRecord(),
      station: buildStationRecord(),
      chargingSession: options.hasChargingSession
        ? { id: 'session-existing', status: ChargingSessionStatus.ACTIVE }
        : null,
    });
  }

  function buildChargerRecord() {
    return {
      id: 'charger-1', stationId: 'station-1', label: 'DC 50kW #01',
      chargerType: ChargerType.DC, connectorType: ConnectorType.CCS,
      powerOutputKW: { toString: () => '50' },
      pricePerKWh:   { toString: () => '4' },
      status: ChargerStatus.AVAILABLE,
    };
  }

  function buildStationRecord() {
    return {
      id: 'station-1', name: 'Karsiyaka Hub', address: 'Izmir',
      latitude:  { toString: () => '38.46' },
      longitude: { toString: () => '27.11' },
      operatingHours: '24/7',
    };
  }

  function buildFullSession(overrides?: {
    status?:         ChargingSessionStatus;
    startEnergyKWh?: number | null;
    endEnergyKWh?:   number | null;
    consumedKWh?:    number | null;
    totalCost?:      number | null;
  }) {
    return {
      id:            'session-1',
      reservationId: 'res-1',
      startEnergyKWh: overrides?.startEnergyKWh !== undefined
        ? (overrides.startEnergyKWh !== null ? { toString: () => String(overrides.startEnergyKWh) } : null)
        : null,
      endEnergyKWh:  overrides?.endEnergyKWh !== undefined
        ? (overrides.endEnergyKWh !== null ? { toString: () => String(overrides.endEnergyKWh) } : null)
        : null,
      consumedKWh:   overrides?.consumedKWh !== undefined
        ? (overrides.consumedKWh !== null ? { toString: () => String(overrides.consumedKWh) } : null)
        : null,
      pricePerKWh:   { toString: () => '4' },
      totalCost:     overrides?.totalCost !== undefined
        ? (overrides.totalCost !== null ? { toString: () => String(overrides.totalCost) } : null)
        : null,
      status:        overrides?.status ?? ChargingSessionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: null,
      transactionId: null,
      receiptNumber: null,
      paidAt:        null,
      walletBalanceBeforePayment: null,
      walletBalanceAfterPayment:  null,
      createdAt: new Date('2026-06-01T12:00:00.000Z'),
      reservation: {
        id:     'res-1',
        userId: 'user-1',
        status: ReservationStatus.CONFIRMED,
        charger: buildChargerRecord(),
        station: buildStationRecord(),
      },
    };
  }
});
