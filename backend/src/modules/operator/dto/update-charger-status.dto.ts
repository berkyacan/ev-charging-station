import { ChargerStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateChargerStatusDto {
  @IsEnum(ChargerStatus)
  status!: ChargerStatus;
}
