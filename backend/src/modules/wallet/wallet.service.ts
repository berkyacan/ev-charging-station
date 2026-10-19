import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { WalletTopUpDto } from './dto/wallet-top-up.dto';
import {
  WalletSummaryResponse,
  WalletTopUpResponse,
} from './types/wallet-response.type';

@Injectable()
export class WalletService {
  constructor(private readonly prismaService: PrismaService) {}

  async getWalletSummaryForUser(userId: string): Promise<WalletSummaryResponse> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      walletBalance: Number(user.demoWalletBalance.toString()),
      currencyCode: 'TRY',
      updatedAt: new Date().toISOString(),
    };
  }

  async topUpWalletForUser(
    userId: string,
    dto: WalletTopUpDto,
  ): Promise<WalletTopUpResponse> {
    const normalizedAmount = this.roundToTwoDecimals(dto.amount);

    if (normalizedAmount <= 0) {
      throw new DomainValidationException(
        'Top-up amount must be greater than zero.',
        'INVALID_TOP_UP_AMOUNT',
      );
    }

    return this.prismaService.$transaction(async (transactionClient) => {
      const user = await transactionClient.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const walletBalanceBeforeTopUp = Number(user.demoWalletBalance.toString());
      const walletBalanceAfterTopUp = this.roundToTwoDecimals(
        walletBalanceBeforeTopUp + normalizedAmount,
      );
      const toppedUpAt = new Date(Date.now());
      const { transactionId, receiptNumber } =
        this.createSimulatedWalletIdentifiers(toppedUpAt, userId);

      await transactionClient.user.update({
        where: {
          id: userId,
        },
        data: {
          demoWalletBalance: walletBalanceAfterTopUp,
        },
      });

      return {
        topUpAmount: normalizedAmount,
        walletBalanceBeforeTopUp,
        walletBalanceAfterTopUp,
        transactionId,
        receiptNumber,
        toppedUpAt: toppedUpAt.toISOString(),
      };
    });
  }

  private createSimulatedWalletIdentifiers(
    eventTime: Date,
    userId: string,
  ): {
    transactionId: string;
    receiptNumber: string;
  } {
    const year = eventTime.getUTCFullYear();
    const sequence = `${(eventTime.getTime() + userId.length) % 1_000_000}`.padStart(6, '0');

    return {
      transactionId: `TOPUP-${year}-${sequence}`,
      receiptNumber: `WT-${year}-${sequence}`,
    };
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
