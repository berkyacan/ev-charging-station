import { UserRole } from '@prisma/client';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

const mockCurrentUser = {
  sub: 'user-1',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
};

const mockWalletSummary = {
  walletBalance: 250,
  currencyCode: 'TRY',
  updatedAt: '2026-05-14T10:00:00.000Z',
};

const mockTopUpResponse = {
  topUpAmount: 100,
  walletBalanceBeforeTopUp: 250,
  walletBalanceAfterTopUp: 350,
  transactionId: 'TOPUP-2026-000001',
  receiptNumber: 'WT-2026-000001',
  toppedUpAt: '2026-05-14T10:00:00.000Z',
};

describe('WalletController', () => {
  let walletController: WalletController;
  let walletService: {
    getWalletSummaryForUser: jest.Mock;
    topUpWalletForUser: jest.Mock;
  };

  beforeEach(() => {
    walletService = {
      getWalletSummaryForUser: jest.fn().mockResolvedValue(mockWalletSummary),
      topUpWalletForUser: jest.fn().mockResolvedValue(mockTopUpResponse),
    };

    walletController = new WalletController(
      walletService as unknown as WalletService,
    );
  });

  describe('getWalletSummary', () => {
    it('returns wallet summary for the current user', async () => {
      const result = await walletController.getWalletSummary(mockCurrentUser);

      expect(walletService.getWalletSummaryForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(mockWalletSummary);
    });
  });

  describe('topUpWallet', () => {
    it('delegates top-up to service with the current user id', async () => {
      const dto = { amount: 100 };

      const result = await walletController.topUpWallet(mockCurrentUser, dto);

      expect(walletService.topUpWalletForUser).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockTopUpResponse);
    });
  });
});
