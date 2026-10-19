import { ConnectorType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const VEHICLE_BATTERY_CAPACITY_MIN_KWH = 5;
export const VEHICLE_BATTERY_CAPACITY_MAX_KWH = 250;
export const VEHICLE_MAX_SUPPORTED_POWER_MIN_KW = 3;
export const VEHICLE_MAX_SUPPORTED_POWER_MAX_KW = 350;

export class CreateVehicleDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'Marka alanı boş bırakılamaz.' })
  @MaxLength(60, { message: 'Marka en fazla 60 karakter olabilir.' })
  brand!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'Model alanı boş bırakılamaz.' })
  @MaxLength(80, { message: 'Model en fazla 80 karakter olabilir.' })
  model!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Batarya kapasitesi sayısal bir değer olmalıdır.' },
  )
  @Min(VEHICLE_BATTERY_CAPACITY_MIN_KWH, {
    message: 'Batarya kapasitesi 5 ile 250 kWh arasında olmalıdır.',
  })
  @Max(VEHICLE_BATTERY_CAPACITY_MAX_KWH, {
    message: 'Batarya kapasitesi 5 ile 250 kWh arasında olmalıdır.',
  })
  batteryCapacityKWh!: number;

  @IsEnum(ConnectorType, {
    message: 'Desteklenmeyen konnektör tipi seçildi.',
  })
  connectorType!: ConnectorType;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Maksimum şarj gücü sayısal bir değer olmalıdır.' },
  )
  @Min(VEHICLE_MAX_SUPPORTED_POWER_MIN_KW, {
    message: 'Maksimum şarj gücü 3 ile 350 kW arasında olmalıdır.',
  })
  @Max(VEHICLE_MAX_SUPPORTED_POWER_MAX_KW, {
    message: 'Maksimum şarj gücü 3 ile 350 kW arasında olmalıdır.',
  })
  maxSupportedPowerKW!: number;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'Plaka alanı boş bırakılamaz.' })
  @MaxLength(20, { message: 'Plaka en fazla 20 karakter olabilir.' })
  plateNumber!: string;
}
