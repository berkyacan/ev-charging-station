import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConnectorType } from '@prisma/client';
import { StationFiltersDto } from './station-filters.dto';

describe('StationFiltersDto', () => {
  it('accepts an empty filter object (all fields optional)', async () => {
    const dto = plainToInstance(StationFiltersDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid connector type', async () => {
    const dto = plainToInstance(StationFiltersDto, {
      connectorType: ConnectorType.CCS,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid connector type', async () => {
    const dto = plainToInstance(StationFiltersDto, {
      connectorType: 'INVALID_TYPE',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'connectorType')).toBe(true);
  });

  it('accepts a valid minPowerKW', async () => {
    const dto = plainToInstance(StationFiltersDto, { minPowerKW: '50' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.minPowerKW).toBe(50);
  });

  it('rejects a non-positive minPowerKW', async () => {
    const dto = plainToInstance(StationFiltersDto, { minPowerKW: '-5' });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'minPowerKW')).toBe(true);
  });

  it('accepts a valid maxPricePerKWh', async () => {
    const dto = plainToInstance(StationFiltersDto, { maxPricePerKWh: '6.5' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.maxPricePerKWh).toBe(6.5);
  });

  it('rejects a non-positive maxPricePerKWh', async () => {
    const dto = plainToInstance(StationFiltersDto, { maxPricePerKWh: '0' });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'maxPricePerKWh')).toBe(true);
  });

  it('accepts valid ISO date strings for startTime and endTime', async () => {
    const dto = plainToInstance(StationFiltersDto, {
      startTime: '2026-06-01T10:00:00.000Z',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.startTime).toBeInstanceOf(Date);
    expect(dto.endTime).toBeInstanceOf(Date);
  });

  it('rejects an invalid date string for startTime', async () => {
    const dto = plainToInstance(StationFiltersDto, {
      startTime: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });
});
