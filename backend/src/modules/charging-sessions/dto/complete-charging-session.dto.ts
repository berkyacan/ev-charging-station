import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class CompleteChargingSessionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  startEnergyKWh!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  endEnergyKWh!: number;
}
