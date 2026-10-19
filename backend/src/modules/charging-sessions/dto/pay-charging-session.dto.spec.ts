import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { PayChargingSessionDto } from './pay-charging-session.dto';

describe('PayChargingSessionDto', () => {
  it.each(Object.values(PaymentMethod))(
    'accepts valid payment method "%s"',
    async (paymentMethod) => {
      const dto = plainToInstance(PayChargingSessionDto, { paymentMethod });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects an invalid payment method', async () => {
    const dto = plainToInstance(PayChargingSessionDto, {
      paymentMethod: 'INVALID_METHOD',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects a missing payment method', async () => {
    const dto = plainToInstance(PayChargingSessionDto, {});

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });
});
