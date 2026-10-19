import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteChargingSessionDto } from './complete-charging-session.dto';

describe('CompleteChargingSessionDto', () => {
  it('accepts valid integer energy readings', async () => {
    const dto = plainToInstance(CompleteChargingSessionDto, {
      startEnergyKWh: 100,
      endEnergyKWh: 175,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts decimal energy readings with up to 2 decimal places', async () => {
    const dto = plainToInstance(CompleteChargingSessionDto, {
      startEnergyKWh: 99.5,
      endEnergyKWh: 174.75,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('converts numeric string inputs via @Type(() => Number)', () => {
    const dto = plainToInstance(CompleteChargingSessionDto, {
      startEnergyKWh: '100',
      endEnergyKWh: '175',
    });

    expect(typeof dto.startEnergyKWh).toBe('number');
    expect(typeof dto.endEnergyKWh).toBe('number');
  });

  it('rejects a non-numeric string for startEnergyKWh', async () => {
    const dto = plainToInstance(CompleteChargingSessionDto, {
      startEnergyKWh: 'start',
      endEnergyKWh: 175,
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'startEnergyKWh')).toBe(true);
  });

  it('rejects a missing endEnergyKWh', async () => {
    const dto = plainToInstance(CompleteChargingSessionDto, {
      startEnergyKWh: 100,
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'endEnergyKWh')).toBe(true);
  });

  it('rejects a missing startEnergyKWh', async () => {
    const dto = plainToInstance(CompleteChargingSessionDto, {
      endEnergyKWh: 175,
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'startEnergyKWh')).toBe(true);
  });
});
