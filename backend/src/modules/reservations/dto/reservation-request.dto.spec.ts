import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReservationRequestDto } from './reservation-request.dto';

describe('ReservationRequestDto', () => {
  it('accepts a valid reservation request', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: 'vehicle-1',
      chargerId: 'charger-1',
      startTime: '2026-06-01T10:00:00.000Z',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('converts ISO date strings to Date instances', () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: 'vehicle-1',
      chargerId: 'charger-1',
      startTime: '2026-06-01T10:00:00.000Z',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    expect(dto.startTime).toBeInstanceOf(Date);
    expect(dto.endTime).toBeInstanceOf(Date);
  });

  it('rejects a missing vehicleId', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      chargerId: 'charger-1',
      startTime: '2026-06-01T10:00:00.000Z',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'vehicleId')).toBe(true);
  });

  it('rejects an empty vehicleId', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: '',
      chargerId: 'charger-1',
      startTime: '2026-06-01T10:00:00.000Z',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'vehicleId')).toBe(true);
  });

  it('rejects a missing chargerId', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: 'vehicle-1',
      startTime: '2026-06-01T10:00:00.000Z',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'chargerId')).toBe(true);
  });

  it('rejects a missing startTime', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: 'vehicle-1',
      chargerId: 'charger-1',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('rejects a missing endTime', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: 'vehicle-1',
      chargerId: 'charger-1',
      startTime: '2026-06-01T10:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'endTime')).toBe(true);
  });

  it('rejects an invalid date string for startTime', async () => {
    const dto = plainToInstance(ReservationRequestDto, {
      vehicleId: 'vehicle-1',
      chargerId: 'charger-1',
      startTime: 'not-a-date',
      endTime: '2026-06-01T12:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });
});
