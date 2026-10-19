import {
  isReservationWithinOperatingHours,
  parseStationOperatingHours,
} from './operating-hours.utils';

describe('parseStationOperatingHours', () => {
  it('parses a 24/7 string as ALWAYS_OPEN', () => {
    expect(parseStationOperatingHours('24/7')).toEqual({ kind: 'ALWAYS_OPEN' });
  });

  it('parses a lowercase 24/7 as ALWAYS_OPEN', () => {
    expect(parseStationOperatingHours('24/7')).toEqual({ kind: 'ALWAYS_OPEN' });
  });

  it('parses a whitespace-padded 24/7 as ALWAYS_OPEN', () => {
    expect(parseStationOperatingHours('  24/7  ')).toEqual({
      kind: 'ALWAYS_OPEN',
    });
  });

  it('parses a valid time window into opensAtMinutes and closesAtMinutes', () => {
    const result = parseStationOperatingHours('08:00-22:00');

    expect(result).toEqual({
      kind: 'DAILY_WINDOW',
      opensAtMinutes: 480,
      closesAtMinutes: 1320,
    });
  });

  it('parses a window with non-zero minutes', () => {
    const result = parseStationOperatingHours('09:30-18:45');

    expect(result).toEqual({
      kind: 'DAILY_WINDOW',
      opensAtMinutes: 570,
      closesAtMinutes: 1125,
    });
  });

  it('returns null for an invalid format', () => {
    expect(parseStationOperatingHours('9:00-17:00')).toBeNull();
  });

  it('returns null for a completely random string', () => {
    expect(parseStationOperatingHours('always open')).toBeNull();
  });

  it('returns null when open time equals close time', () => {
    expect(parseStationOperatingHours('10:00-10:00')).toBeNull();
  });

  it('returns null when open time is after close time', () => {
    expect(parseStationOperatingHours('22:00-08:00')).toBeNull();
  });

  it('returns null for an invalid hour value', () => {
    expect(parseStationOperatingHours('25:00-26:00')).toBeNull();
  });

  it('returns null for an invalid minute value', () => {
    expect(parseStationOperatingHours('08:60-10:00')).toBeNull();
  });
});

describe('isReservationWithinOperatingHours', () => {
  it('returns true for a 24/7 station regardless of time', () => {
    const start = new Date('2026-05-10T00:00:00.000Z');
    const end = new Date('2026-05-10T23:59:00.000Z');

    expect(isReservationWithinOperatingHours('24/7', start, end)).toBe(true);
  });

  it('returns false for an invalid operating hours string', () => {
    const start = new Date('2026-05-10T08:00:00.000Z');
    const end = new Date('2026-05-10T09:00:00.000Z');

    expect(isReservationWithinOperatingHours('invalid', start, end)).toBe(
      false,
    );
  });

  it('returns true when reservation falls within the daily window (Istanbul time)', () => {
    // Istanbul is UTC+3. 08:00 Istanbul = 05:00 UTC, 22:00 Istanbul = 19:00 UTC.
    const start = new Date('2026-05-10T07:00:00.000Z'); // 10:00 Istanbul
    const end = new Date('2026-05-10T09:00:00.000Z');   // 12:00 Istanbul

    expect(
      isReservationWithinOperatingHours('08:00-22:00', start, end),
    ).toBe(true);
  });

  it('returns false when reservation starts before opening time', () => {
    // 04:00 Istanbul = 01:00 UTC
    const start = new Date('2026-05-10T01:00:00.000Z');
    const end = new Date('2026-05-10T07:00:00.000Z');

    expect(
      isReservationWithinOperatingHours('08:00-22:00', start, end),
    ).toBe(false);
  });

  it('returns false when reservation ends after closing time', () => {
    // 20:00 Istanbul = 17:00 UTC, 23:00 Istanbul = 20:00 UTC
    const start = new Date('2026-05-10T17:00:00.000Z');
    const end = new Date('2026-05-10T20:00:00.000Z');

    expect(
      isReservationWithinOperatingHours('08:00-22:00', start, end),
    ).toBe(false);
  });

  it('returns false when reservation spans midnight (different local dates)', () => {
    // 23:30 Istanbul May 10 = 20:30 UTC, 00:30 Istanbul May 11 = 21:30 UTC
    const start = new Date('2026-05-10T20:30:00.000Z');
    const end = new Date('2026-05-10T21:30:00.000Z');

    expect(
      isReservationWithinOperatingHours('08:00-22:00', start, end),
    ).toBe(false);
  });
});
