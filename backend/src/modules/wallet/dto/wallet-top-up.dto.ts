import { IsNumber, Min } from 'class-validator';

export class WalletTopUpDto {
  @IsNumber()
  @Min(1)
  amount!: number;
}
