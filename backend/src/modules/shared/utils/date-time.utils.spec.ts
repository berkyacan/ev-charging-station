import {
  calculateDurationInHours,
  intervalsOverlap,
  isMoreThan24HoursInAdvance,
} from './date-time.utils';

describe('dateTimeUtils', () => {
  describe('calculateDurationInHours', () => {
    it('calculates the duration for a two-hour interval', () => {
      const startTime = new Date('2026-05-03T10:00:00.000Z');
      const endTime = new Date('2026-05-03T12:00:00.000Z');

      expect(calculateDurationInHours(startTime, endTime)).toBe(2);
    });

    it('calculates fractional hour durations', () => {
      const startTime = new Date('2026-05-03T10:15:00.000Z');
      const endTime = new Date('2026-05-03T11:45:00.000Z');

      expect(calculateDurationInHours(startTime, endTime)).toBe(1.5);
    });
  });

  describe('intervalsOverlap', () => {
    it('returns true when two intervals overlap', () => {
      const firstStartTime = new Date('2026-05-03T10:00:00.000Z');
      const firstEndTime = new Date('2026-05-03T12:00:00.000Z');
      const secondStartTime = new Date('2026-05-03T11:00:00.000Z');
      const secondEndTime = new Date('2026-05-03T13:00:00.000Z');

      expect(
        intervalsOverlap(
          firstStartTime,
          firstEndTime,
          secondStartTime,
          secondEndTime,
        ),
      ).toBe(true);
    });

    it('returns false when two intervals only touch at the boundary', () => {
      const firstStartTime = new Date('2026-05-03T10:00:00.000Z');
      const firstEndTime = new Date('2026-05-03T12:00:00.000Z');
      const secondStartTime = new Date('2026-05-03T12:00:00.000Z');
      const secondEndTime = new Date('2026-05-03T14:00:00.000Z');

      expect(
        intervalsOverlap(
          firstStartTime,
          firstEndTime,
          secondStartTime,
          secondEndTime,
        ),
      ).toBe(false);
    });

    it('returns false when intervals are fully separate', () => {
      const firstStartTime = new Date('2026-05-03T10:00:00.000Z');
      const firstEndTime = new Date('2026-05-03T11:00:00.000Z');
      const secondStartTime = new Date('2026-05-03T12:00:00.000Z');
      const secondEndTime = new Date('2026-05-03T13:00:00.000Z');

      expect(
        intervalsOverlap(
          firstStartTime,
          firstEndTime,
          secondStartTime,
          secondEndTime,
        ),
      ).toBe(false);
    });
  });

  describe('isMoreThan24HoursInAdvance', () => {
    it('returns true when the target date is more than 24 hours ahead', () => {
      const currentDate = new Date('2026-05-03T10:00:00.000Z');
      const targetDate = new Date('2026-05-04T10:00:00.001Z');

      expect(isMoreThan24HoursInAdvance(targetDate, currentDate)).toBe(true);
    });

    it('returns false when the target date is exactly 24 hours ahead', () => {
      const currentDate = new Date('2026-05-03T10:00:00.000Z');
      const targetDate = new Date('2026-05-04T10:00:00.000Z');

      expect(isMoreThan24HoursInAdvance(targetDate, currentDate)).toBe(false);
    });

    it('returns false when the target date is less than 24 hours ahead', () => {
      const currentDate = new Date('2026-05-03T10:00:00.000Z');
      const targetDate = new Date('2026-05-03T20:00:00.000Z');

      expect(isMoreThan24HoursInAdvance(targetDate, currentDate)).toBe(false);
    });
  });
});
