import { NotFoundException } from '@nestjs/common';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let walletService: WalletService;
  let prismaService: {
    $transaction: jest.Mock;
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    prismaService.$transaction.mockImplementation(
      async (callback: (client: typeof prismaService) => unknown) =>
        callback(prismaService),
    );

    walletService = new WalletService(prismaService as unknown as PrismaService);
  });

  it('increases wallet balance for a valid top-up amount', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      demoWalletBalance: {
        toString: () => '650',
      },
    });
    prismaService.user.update.mockResolvedValue({
      id: 'user-1',
    });

    const result = await walletService.topUpWalletForUser('user-1', {
      amount: 250,
    });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        demoWalletBalance: 900,
      },
    });
    expect(result.topUpAmount).toBe(250);
    expect(result.walletBalanceBeforeTopUp).toBe(650);
    expect(result.walletBalanceAfterTopUp).toBe(900);
  });

  it('rejects invalid top-up amounts', async () => {
    await expect(
      walletService.topUpWalletForUser('user-1', {
        amount: 0,
      }),
    ).rejects.toBeInstanceOf(DomainValidationException);
    expect(prismaService.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws NotFoundException from getWalletSummaryForUser when user does not exist', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    await expect(
      walletService.getWalletSummaryForUser('nonexistent'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns wallet summary with balance and currency for an existing user', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      demoWalletBalance: { toString: () => '250.75' },
    });

    const result = await walletService.getWalletSummaryForUser('user-1');

    expect(result.walletBalance).toBe(250.75);
    expect(result.currencyCode).toBe('TRY');
    expect(result.updatedAt).toBeDefined();
  });

  it('throws NotFoundException inside the transaction when user does not exist during top-up', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    await expect(
      walletService.topUpWalletForUser('user-1', { amount: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rounds top-up amount to two decimal places', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      demoWalletBalance: { toString: () => '0' },
    });
    prismaService.user.update.mockResolvedValue({ id: 'user-1' });

    const result = await walletService.topUpWalletForUser('user-1', {
      amount: 9.999,
    });

    expect(result.topUpAmount).toBe(10);
    expect(result.walletBalanceAfterTopUp).toBe(10);
  });

  it('generates a transactionId and receiptNumber for each top-up', async () => {
    prismaService.user.findUnique.mockResolvedValue({
      id: 'user-1',
      demoWalletBalance: { toString: () => '0' },
    });
    prismaService.user.update.mockResolvedValue({ id: 'user-1' });

    const result = await walletService.topUpWalletForUser('user-1', {
      amount: 100,
    });

    expect(result.transactionId).toMatch(/^TOPUP-\d{4}-\d{6}$/);
    expect(result.receiptNumber).toMatch(/^WT-\d{4}-\d{6}$/);
  });
});
