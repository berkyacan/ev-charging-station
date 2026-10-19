import { PaymentMethod } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PayChargingSessionDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
