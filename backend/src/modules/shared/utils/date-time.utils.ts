const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;

export function calculateDurationInHours(
  startTime: Date,
  endTime: Date,
): number {
  return (endTime.getTime() - startTime.getTime()) / HOUR_IN_MILLISECONDS;
}

export function intervalsOverlap(
  firstStartTime: Date,
  firstEndTime: Date,
  secondStartTime: Date,
  secondEndTime: Date,
): boolean {
  return (
    firstStartTime.getTime() < secondEndTime.getTime() &&
    secondStartTime.getTime() < firstEndTime.getTime()
  );
}

export function isMoreThan24HoursInAdvance(
  targetDate: Date,
  currentDate: Date = new Date(),
): boolean {
  return (
    targetDate.getTime() - currentDate.getTime() >
    TWENTY_FOUR_HOURS_IN_MILLISECONDS
  );
}
