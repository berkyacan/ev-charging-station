import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChargerStatus } from '@prisma/client';
import { UpdateChargerStatusDto } from './update-charger-status.dto';

describe('UpdateChargerStatusDto', () => {
  it.each(Object.values(ChargerStatus))(
    'accepts valid charger status "%s"',
    async (status) => {
      const dto = plainToInstance(UpdateChargerStatusDto, { status });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    },
  );

  it('rejects an invalid status value', async () => {
    const dto = plainToInstance(UpdateChargerStatusDto, {
      status: 'BROKEN',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a missing status', async () => {
    const dto = plainToInstance(UpdateChargerStatusDto, {});

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
