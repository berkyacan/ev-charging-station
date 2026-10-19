import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StartChargingSessionDto } from './start-charging-session.dto';

describe('StartChargingSessionDto', () => {
  it('accepts a valid reservationId', async () => {
    const dto = plainToInstance(StartChargingSessionDto, {
      reservationId: 'reservation-1',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty reservationId', async () => {
    const dto = plainToInstance(StartChargingSessionDto, {
      reservationId: '',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'reservationId')).toBe(true);
  });

  it('rejects a missing reservationId', async () => {
    const dto = plainToInstance(StartChargingSessionDto, {});

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'reservationId')).toBe(true);
  });
});
