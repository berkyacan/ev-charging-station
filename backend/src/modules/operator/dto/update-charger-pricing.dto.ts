import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateChargerPricingDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'kWh başına fiyat 0 ile 100 TL arasında olmalıdır.' },
  )
  @Min(0.01, {
    message: 'kWh başına fiyat 0 ile 100 TL arasında olmalıdır.',
  })
  @Max(100, {
    message: 'kWh başına fiyat 0 ile 100 TL arasında olmalıdır.',
  })
  pricePerKWh!: number;
}
