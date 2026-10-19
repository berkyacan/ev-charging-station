ALTER TABLE "User"
ADD COLUMN "demoWalletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "ChargingSession"
ADD COLUMN "walletBalanceBeforePayment" DECIMAL(10,2),
ADD COLUMN "walletBalanceAfterPayment" DECIMAL(10,2);
