import { NotFoundException } from '@nestjs/common';
import {
  ChargerStatus,
  ChargerType,
  ChargingSessionStatus,
  ConnectorType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { ChargingSessionsService } from './charging-sessions.service';
import { CompleteChargingSessionDto } from './dto/complete-charging-session.dto';
import { PayChargingSessionDto } from './dto/pay-charging-session.dto';
import { StartChargingSessionDto } from './dto/start-charging-session.dto';

describe('ChargingSessionsService', () => {
  let chargingSessionsService: ChargingSessionsService;
  let prismaService: {
    $transaction: jest.Mock;
    charger: {
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    reservation: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    chargingSession: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let notificationsService: {
    createNotification: jest.Mock;
  };

  beforeEach(() => {
    prismaService = {
      $transaction: jest.fn(),
      charger: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      reservation: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      chargingSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    notificationsService = {
      createNotification: jest.fn(),
    };
    prismaService.$transaction.mockImplementation(
      async (callback: (client: typeof prismaService) => unknown) =>
        callback(prismaService),
    );

    chargingSessionsService = new ChargingSessionsService(
      prismaService as unknown as PrismaService,
      notificationsService as unknown as NotificationsService,
    );
    jest
      .spyOn(
        chargingSessionsService as unknown as { getCurrentDate(): Date },
        'getCurrentDate',
      )
      .mockReturnValue(new Date('2026-05-03T10:00:00.000Z'));
  });

  it('starts a charging session successfully', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord(),
    );
    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildChargingSessionRecord({
          status: ChargingSessionStatus.ACTIVE,
          charger: buildChargerRecord({
            status: ChargerStatus.OCCUPIED,
          }),
        }),
      );
    prismaService.chargingSession.create.mockResolvedValue({
      id: 'session-1',
    });
    prismaService.charger.update.mockResolvedValue({});

    const result = await chargingSessionsService.startSessionForUser(
      'user-1',
      buildStartDto(),
    );

    expect(prismaService.chargingSession.create).toHaveBeenCalledWith({
      data: {
        reservationId: 'reservation-1',
        startEnergyKWh: null,
        endEnergyKWh: null,
        consumedKWh: null,
        pricePerKWh: new Prisma.Decimal(4),
        totalCost: null,
        status: ChargingSessionStatus.ACTIVE,
      },
    });
    expect(prismaService.charger.update).toHaveBeenCalledWith({
      where: {
        id: 'charger-1',
      },
      data: {
        status: ChargerStatus.OCCUPIED,
      },
    });
    expect(result.status).toBe(ChargingSessionStatus.ACTIVE);
    expect(result.pricePerKWh).toBe(4);
    expect(result.charger.status).toBe(ChargerStatus.OCCUPIED);
  });

  it("cannot start another user's reservation", async () => {
    prismaService.reservation.findFirst.mockResolvedValue(null);

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects start before the reservation window begins', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        startTime: new Date('2026-05-03T11:00:00.000Z'),
        endTime: new Date('2026-05-03T13:00:00.000Z'),
      }),
    );

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({
          code: 'CHARGING_SESSION_BEFORE_RESERVATION_START',
        }),
      }),
    });
  });

  it('allows start at or after reservation start and before reservation end', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        startTime: new Date('2026-05-03T10:00:00.000Z'),
        endTime: new Date('2026-05-03T12:00:00.000Z'),
      }),
    );
    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        buildChargingSessionRecord({
          status: ChargingSessionStatus.ACTIVE,
          charger: buildChargerRecord({
            status: ChargerStatus.OCCUPIED,
          }),
        }),
      );
    prismaService.chargingSession.create.mockResolvedValue({
      id: 'session-1',
    });
    prismaService.charger.update.mockResolvedValue({});

    const result = await chargingSessionsService.startSessionForUser(
      'user-1',
      buildStartDto(),
    );

    expect(result.status).toBe(ChargingSessionStatus.ACTIVE);
  });

  it('rejects start after the reservation window ends', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        startTime: new Date('2026-05-03T08:00:00.000Z'),
        endTime: new Date('2026-05-03T10:00:00.000Z'),
      }),
    );

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: expect.objectContaining({
          code: 'CHARGING_SESSION_AFTER_RESERVATION_END',
        }),
      }),
    });
  });

  it('rejects start for cancelled reservations', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.CANCELLED,
      }),
    );

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects start for completed reservations', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        status: ReservationStatus.COMPLETED,
      }),
    );

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects start when a session already exists for the reservation', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(
      buildReservationRecord({
        chargingSession: {
          id: 'session-existing',
          status: ChargingSessionStatus.ACTIVE,
        },
      }),
    );

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(prismaService.chargingSession.create).not.toHaveBeenCalled();
  });

  it('rejects start when another active session already exists for the user', async () => {
    prismaService.reservation.findFirst.mockResolvedValue(buildReservationRecord());
    prismaService.chargingSession.findFirst.mockResolvedValueOnce(
      buildChargingSessionRecord({
        id: 'session-active',
        reservationId: 'reservation-2',
      }),
    );

    await expect(
      chargingSessionsService.startSessionForUser('user-1', buildStartDto()),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(prismaService.chargingSession.create).not.toHaveBeenCalled();
  });

  it('completes a session with 15 to 60 at 4 TL and returns 45 kWh and 180 TL', async () => {
    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(
        buildChargingSessionRecord({
          status: ChargingSessionStatus.ACTIVE,
          charger: buildChargerRecord({
            status: ChargerStatus.OCCUPIED,
          }),
        }),
      )
      .mockResolvedValueOnce(
        buildChargingSessionRecord({
          status: ChargingSessionStatus.COMPLETED,
          startEnergyKWh: new Prisma.Decimal(15),
          endEnergyKWh: new Prisma.Decimal(60),
          consumedKWh: new Prisma.Decimal(45),
          totalCost: new Prisma.Decimal(180),
          charger: buildChargerRecord({
            status: ChargerStatus.AVAILABLE,
          }),
        }),
      );
    prismaService.chargingSession.update.mockResolvedValue({});
    prismaService.reservation.update.mockResolvedValue({});
    prismaService.charger.updateMany.mockResolvedValue({ count: 1 });

    const result = await chargingSessionsService.completeSessionForUser(
      'user-1',
      'session-1',
      buildCompleteDto(),
    );

    expect(prismaService.chargingSession.update).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
      },
      data: {
        startEnergyKWh: 15,
        endEnergyKWh: 60,
        consumedKWh: 45,
        totalCost: 180,
        status: ChargingSessionStatus.COMPLETED,
      },
    });
    expect(prismaService.reservation.update).toHaveBeenCalledWith({
      where: {
        id: 'reservation-1',
      },
      data: {
        status: ReservationStatus.COMPLETED,
      },
    });
    expect(prismaService.charger.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'charger-1',
        status: ChargerStatus.OCCUPIED,
      },
      data: {
        status: ChargerStatus.AVAILABLE,
      },
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'CHARGING_SESSION_COMPLETED',
      'Şarj oturumu tamamlandı. Toplam tutar: 180 TL.',
    );
    expect(result.consumedKWh).toBe(45);
    expect(result.totalCost).toBe(180);
    expect(result.charger.status).toBe(ChargerStatus.AVAILABLE);
  });

  it('rejects invalid energy values', async () => {
    prismaService.chargingSession.findFirst.mockResolvedValue(
      buildChargingSessionRecord({
        status: ChargingSessionStatus.ACTIVE,
      }),
    );

    await expect(
      chargingSessionsService.completeSessionForUser(
        'user-1',
        'session-1',
        buildCompleteDto({
          startEnergyKWh: 60,
          endEnergyKWh: 15,
        }),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('returns completed sessions in user history', async () => {
    prismaService.chargingSession.findMany.mockResolvedValue([
      buildChargingSessionRecord({
        status: ChargingSessionStatus.COMPLETED,
        startEnergyKWh: new Prisma.Decimal(15),
        endEnergyKWh: new Prisma.Decimal(60),
        consumedKWh: new Prisma.Decimal(45),
        totalCost: new Prisma.Decimal(180),
      }),
    ]);

    const result = await chargingSessionsService.getCompletedHistoryForUser(
      'user-1',
    );

    expect(prismaService.chargingSession.findMany).toHaveBeenCalledWith({
      where: {
        status: ChargingSessionStatus.COMPLETED,
        reservation: {
          is: {
            userId: 'user-1',
          },
        },
      },
      include: {
        reservation: {
          include: {
            charger: true,
            station: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'session-1',
      consumedKWh: 45,
      totalCost: 180,
      status: ChargingSessionStatus.COMPLETED,
    });
  });

  it('returns the current active session when one exists', async () => {
    prismaService.chargingSession.findFirst.mockResolvedValue(
      buildChargingSessionRecord({
        status: ChargingSessionStatus.ACTIVE,
        charger: buildChargerRecord({
          status: ChargerStatus.OCCUPIED,
        }),
      }),
    );

    const result = await chargingSessionsService.getActiveSessionForUser('user-1');

    expect(prismaService.chargingSession.findFirst).toHaveBeenCalledWith({
      where: {
        status: ChargingSessionStatus.ACTIVE,
        reservation: {
          is: {
            userId: 'user-1',
          },
        },
      },
      include: {
        reservation: {
          include: {
            charger: true,
            station: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(result?.status).toBe(ChargingSessionStatus.ACTIVE);
  });

  it('confirms a simulated payment for a completed charging session', async () => {
    const paidSession = buildChargingSessionRecord({
      status: ChargingSessionStatus.COMPLETED,
      consumedKWh: new Prisma.Decimal(45),
      totalCost: new Prisma.Decimal(180),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.DEMO_CARD,
      transactionId: 'TXN-2026-123456',
      receiptNumber: 'RCPT-2026-123456',
      paidAt: new Date('2026-05-10T10:30:00.000Z'),
      walletBalanceBeforePayment: new Prisma.Decimal(650),
      walletBalanceAfterPayment: new Prisma.Decimal(650),
    });

    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(
        buildChargingSessionRecord({
          status: ChargingSessionStatus.COMPLETED,
          consumedKWh: new Prisma.Decimal(45),
          totalCost: new Prisma.Decimal(180),
        }),
      )
      .mockResolvedValueOnce(paidSession);
    prismaService.user.findUnique.mockResolvedValue(buildUserRecord());
    prismaService.chargingSession.update.mockResolvedValue({});

    const result = await chargingSessionsService.confirmPaymentForUser(
      'user-1',
      'session-1',
      buildPayDto({
        paymentMethod: PaymentMethod.DEMO_CARD,
      }),
    );

    expect(prismaService.chargingSession.update).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
      },
      data: expect.objectContaining({
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.DEMO_CARD,
        walletBalanceBeforePayment: 650,
        walletBalanceAfterPayment: 650,
      }),
    });
    expect(prismaService.user.update).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'PAYMENT_CONFIRMED',
      'Payment confirmed. Receipt number: RCPT-2026-123456.',
    );
    expect(result).toEqual({
      paymentStatus: PaymentStatus.PAID,
      transactionId: 'TXN-2026-123456',
      receiptNumber: 'RCPT-2026-123456',
      paidAmount: 180,
      paidAt: '2026-05-10T10:30:00.000Z',
      paymentMethod: PaymentMethod.DEMO_CARD,
      walletBalanceBeforePayment: 650,
      walletBalanceAfterPayment: 650,
    });
  });

  it('deducts wallet balance for a successful demo wallet payment', async () => {
    const paidSession = buildChargingSessionRecord({
      status: ChargingSessionStatus.COMPLETED,
      consumedKWh: new Prisma.Decimal(45),
      totalCost: new Prisma.Decimal(180),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.DEMO_WALLET,
      transactionId: 'TXN-2026-222222',
      receiptNumber: 'RCPT-2026-222222',
      paidAt: new Date('2026-05-10T11:00:00.000Z'),
      walletBalanceBeforePayment: new Prisma.Decimal(650),
      walletBalanceAfterPayment: new Prisma.Decimal(470),
    });

    prismaService.chargingSession.findFirst
      .mockResolvedValueOnce(
        buildChargingSessionRecord({
          status: ChargingSessionStatus.COMPLETED,
          consumedKWh: new Prisma.Decimal(45),
          totalCost: new Prisma.Decimal(180),
        }),
      )
      .mockResolvedValueOnce(paidSession);
    prismaService.user.findUnique.mockResolvedValue(buildUserRecord());
    prismaService.user.update.mockResolvedValue({});
    prismaService.chargingSession.update.mockResolvedValue({});

    const result = await chargingSessionsService.confirmPaymentForUser(
      'user-1',
      'session-1',
      buildPayDto(),
    );

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        demoWalletBalance: 470,
      },
    });
    expect(result.walletBalanceAfterPayment).toBe(470);
  });

  it('returns the existing payment confirmation when the session is already paid', async () => {
    prismaService.chargingSession.findFirst.mockResolvedValue(
      buildChargingSessionRecord({
        status: ChargingSessionStatus.COMPLETED,
        consumedKWh: new Prisma.Decimal(45),
        totalCost: new Prisma.Decimal(180),
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.DEMO_WALLET,
        transactionId: 'TXN-2026-654321',
        receiptNumber: 'RCPT-2026-654321',
        paidAt: new Date('2026-05-10T10:45:00.000Z'),
        walletBalanceBeforePayment: new Prisma.Decimal(650),
        walletBalanceAfterPayment: new Prisma.Decimal(470),
      }),
    );

    const result = await chargingSessionsService.confirmPaymentForUser(
      'user-1',
      'session-1',
      buildPayDto(),
    );

    expect(prismaService.chargingSession.update).not.toHaveBeenCalled();
    expect(notificationsService.createNotification).not.toHaveBeenCalled();
    expect(result.transactionId).toBe('TXN-2026-654321');
    expect(result.paymentMethod).toBe(PaymentMethod.DEMO_WALLET);
    expect(result.walletBalanceAfterPayment).toBe(470);
  });

  it('rejects payment confirmation for sessions that are not completed', async () => {
    prismaService.chargingSession.findFirst.mockResolvedValue(
      buildChargingSessionRecord({
        status: ChargingSessionStatus.ACTIVE,
      }),
    );

    await expect(
      chargingSessionsService.confirmPaymentForUser(
        'user-1',
        'session-1',
        buildPayDto(),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);
  });

  it('rejects wallet payment when the balance is insufficient', async () => {
    prismaService.chargingSession.findFirst.mockResolvedValue(
      buildChargingSessionRecord({
        status: ChargingSessionStatus.COMPLETED,
        consumedKWh: new Prisma.Decimal(45),
        totalCost: new Prisma.Decimal(180),
      }),
    );
    prismaService.user.findUnique.mockResolvedValue(
      buildUserRecord({
        demoWalletBalance: new Prisma.Decimal(120),
      }),
    );

    await expect(
      chargingSessionsService.confirmPaymentForUser(
        'user-1',
        'session-1',
        buildPayDto(),
      ),
    ).rejects.toBeInstanceOf(DomainValidationException);

    expect(prismaService.user.update).not.toHaveBeenCalled();
    expect(prismaService.chargingSession.update).not.toHaveBeenCalled();
  });
});

function buildStartDto(overrides?: Partial<StartChargingSessionDto>): StartChargingSessionDto {
  return {
    reservationId: overrides?.reservationId ?? 'reservation-1',
  };
}

function buildCompleteDto(
  overrides?: Partial<CompleteChargingSessionDto>,
): CompleteChargingSessionDto {
  return {
    startEnergyKWh: overrides?.startEnergyKWh ?? 15,
    endEnergyKWh: overrides?.endEnergyKWh ?? 60,
  };
}

function buildPayDto(
  overrides?: Partial<PayChargingSessionDto>,
): PayChargingSessionDto {
  return {
    paymentMethod: overrides?.paymentMethod ?? PaymentMethod.DEMO_WALLET,
  };
}

function buildReservationRecord(overrides?: {
  userId?: string;
  status?: ReservationStatus;
  startTime?: Date;
  endTime?: Date;
  chargingSession?: { id: string; status: ChargingSessionStatus } | null;
}): {
  id: string;
  userId: string;
  status: ReservationStatus;
  startTime: Date;
  endTime: Date;
  charger: {
    id: string;
    stationId: string;
    label: string;
    chargerType: ChargerType;
    connectorType: ConnectorType;
    powerOutputKW: Prisma.Decimal;
    pricePerKWh: Prisma.Decimal;
    status: ChargerStatus;
  };
  station: {
    id: string;
    name: string;
    address: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    operatingHours: string;
  };
  chargingSession: { id: string; status: ChargingSessionStatus } | null;
} {
  return {
    id: 'reservation-1',
    userId: overrides?.userId ?? 'user-1',
    status: overrides?.status ?? ReservationStatus.CONFIRMED,
    startTime:
      overrides?.startTime ?? new Date('2026-05-03T09:30:00.000Z'),
    endTime:
      overrides?.endTime ?? new Date('2026-05-03T12:30:00.000Z'),
    charger: {
      id: 'charger-1',
      stationId: 'station-1',
      label: 'DC 50kW #03',
      chargerType: ChargerType.DC,
      connectorType: ConnectorType.CCS,
      powerOutputKW: new Prisma.Decimal(50),
      pricePerKWh: new Prisma.Decimal(4),
      status: ChargerStatus.AVAILABLE,
    },
    station: {
      id: 'station-1',
      name: 'Karsiyaka Hub',
      address: 'Izmir',
      latitude: new Prisma.Decimal('38.457491'),
      longitude: new Prisma.Decimal('27.112394'),
      operatingHours: '08:00-23:00',
    },
    chargingSession: overrides?.chargingSession ?? null,
  };
}

function buildChargingSessionRecord(overrides?: {
  id?: string;
  reservationId?: string;
  charger?: ReturnType<typeof buildChargerRecord>;
  status?: ChargingSessionStatus;
  startEnergyKWh?: Prisma.Decimal | null;
  endEnergyKWh?: Prisma.Decimal | null;
  consumedKWh?: Prisma.Decimal | null;
  totalCost?: Prisma.Decimal | null;
  reservationUserId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  transactionId?: string | null;
  receiptNumber?: string | null;
  paidAt?: Date | null;
  walletBalanceBeforePayment?: Prisma.Decimal | null;
  walletBalanceAfterPayment?: Prisma.Decimal | null;
}): {
  id: string;
  reservationId: string;
  startEnergyKWh: Prisma.Decimal | null;
  endEnergyKWh: Prisma.Decimal | null;
  consumedKWh: Prisma.Decimal | null;
  pricePerKWh: Prisma.Decimal;
  totalCost: Prisma.Decimal | null;
  status: ChargingSessionStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  transactionId: string | null;
  receiptNumber: string | null;
  paidAt: Date | null;
  walletBalanceBeforePayment: Prisma.Decimal | null;
  walletBalanceAfterPayment: Prisma.Decimal | null;
  createdAt: Date;
  reservation: {
    id: string;
    userId: string;
    status: ReservationStatus;
    charger: {
      id: string;
      stationId: string;
      label: string;
      chargerType: ChargerType;
      connectorType: ConnectorType;
      powerOutputKW: Prisma.Decimal;
      pricePerKWh: Prisma.Decimal;
      status: ChargerStatus;
    };
    station: {
      id: string;
      name: string;
      address: string;
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      operatingHours: string;
    };
  };
} {
  return {
    id: overrides?.id ?? 'session-1',
    reservationId: overrides?.reservationId ?? 'reservation-1',
    startEnergyKWh: overrides?.startEnergyKWh ?? null,
    endEnergyKWh: overrides?.endEnergyKWh ?? null,
    consumedKWh: overrides?.consumedKWh ?? null,
    pricePerKWh: new Prisma.Decimal(4),
    totalCost: overrides?.totalCost ?? null,
    status: overrides?.status ?? ChargingSessionStatus.ACTIVE,
    paymentStatus: overrides?.paymentStatus ?? PaymentStatus.PENDING,
    paymentMethod: overrides?.paymentMethod ?? null,
    transactionId: overrides?.transactionId ?? null,
    receiptNumber: overrides?.receiptNumber ?? null,
    paidAt: overrides?.paidAt ?? null,
    walletBalanceBeforePayment: overrides?.walletBalanceBeforePayment ?? null,
    walletBalanceAfterPayment: overrides?.walletBalanceAfterPayment ?? null,
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
    reservation: {
      id: 'reservation-1',
      userId: overrides?.reservationUserId ?? 'user-1',
      status: ReservationStatus.CONFIRMED,
      charger: overrides?.charger ?? buildChargerRecord(),
      station: {
        id: 'station-1',
        name: 'Karsiyaka Hub',
        address: 'Izmir',
        latitude: new Prisma.Decimal('38.457491'),
        longitude: new Prisma.Decimal('27.112394'),
        operatingHours: '08:00-23:00',
      },
    },
  };
}

function buildUserRecord(overrides?: {
  demoWalletBalance?: Prisma.Decimal;
}): {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'EV_DRIVER';
  demoWalletBalance: Prisma.Decimal;
  createdAt: Date;
} {
  return {
    id: 'user-1',
    name: 'Demo EV Driver',
    email: 'driver.demo@evcharging.local',
    passwordHash: 'hash',
    role: 'EV_DRIVER',
    demoWalletBalance: overrides?.demoWalletBalance ?? new Prisma.Decimal(650),
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
  };
}

function buildChargerRecord(overrides?: {
  status?: ChargerStatus;
}): {
  id: string;
  stationId: string;
  label: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  powerOutputKW: Prisma.Decimal;
  pricePerKWh: Prisma.Decimal;
  status: ChargerStatus;
} {
  return {
    id: 'charger-1',
    stationId: 'station-1',
    label: 'DC 50kW #03',
    chargerType: ChargerType.DC,
    connectorType: ConnectorType.CCS,
    powerOutputKW: new Prisma.Decimal(50),
    pricePerKWh: new Prisma.Decimal(4),
    status: overrides?.status ?? ChargerStatus.AVAILABLE,
  };
}
