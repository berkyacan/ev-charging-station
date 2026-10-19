export interface WalletSummaryResponse {
  walletBalance: number;
  currencyCode: 'TRY';
  updatedAt: string;
}

export interface WalletTopUpResponse {
  topUpAmount: number;
  walletBalanceBeforeTopUp: number;
  walletBalanceAfterTopUp: number;
  transactionId: string;
  receiptNumber: string;
  toppedUpAt: string;
}
