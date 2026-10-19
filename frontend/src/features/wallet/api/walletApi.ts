import { apiClient } from '../../shared/api';

export interface WalletSummaryResponse {
  walletBalance: number;
  currencyCode: 'TRY';
  updatedAt: string;
}

export interface WalletTopUpPayload {
  amount: number;
}

export interface WalletTopUpResponse {
  topUpAmount: number;
  walletBalanceBeforeTopUp: number;
  walletBalanceAfterTopUp: number;
  transactionId: string;
  receiptNumber: string;
  toppedUpAt: string;
}

export function getWalletSummary(): Promise<WalletSummaryResponse> {
  return apiClient.get<WalletSummaryResponse>('/wallet/me');
}

export function simulateWalletTopUp(
  payload: WalletTopUpPayload,
): Promise<WalletTopUpResponse> {
  return apiClient.post<WalletTopUpResponse>('/wallet/top-up', payload);
}
