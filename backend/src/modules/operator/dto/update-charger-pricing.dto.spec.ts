import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateChargerPricingDto } from './update-charger-pricing.dto';

describe('UpdateChargerPricingDto', () => {
  it('accepts a valid charger price', async () => {
    const dto = plainToInstance(UpdateChargerPricingDto, {
      pricePerKWh: 6.5,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a price above the supported range', async () => {
    const dto = plainToInstance(UpdateChargerPricingDto, {
      pricePerKWh: 101,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'pricePerKWh')).toBe(true);
  });
});
