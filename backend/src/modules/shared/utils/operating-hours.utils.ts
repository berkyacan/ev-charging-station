const ALWAYS_OPEN_OPERATING_HOURS = '24/7';
const ISTANBUL_TIMEZONE = 'Europe/Istanbul';

interface AlwaysOpenOperatingHours {
  kind: 'ALWAYS_OPEN';
}

interface DailyWindowOperatingHours {
  kind: 'DAILY_WINDOW';
  closesAtMinutes: number;
  opensAtMinutes: number;
}

export type ParsedOperatingHours =
  | AlwaysOpenOperatingHours
  | DailyWindowOperatingHours;

interface LocalDateTimeParts {
  day: string;
  hour: number;
  minute: number;
  month: string;
  year: string;
}

export function parseStationOperatingHours(
  operatingHours: string,
): ParsedOperatingHours | null {
  const normalizedValue = operatingHours.trim();

  if (normalizedValue.toUpperCase() === ALWAYS_OPEN_OPERATING_HOURS) {
    return {
      kind: 'ALWAYS_OPEN',
    };
  }

  const match = normalizedValue.match(
    /^(?<openHour>\d{2}):(?<openMinute>\d{2})-(?<closeHour>\d{2}):(?<closeMinute>\d{2})$/,
  );

  if (!match?.groups) {
    return null;
  }

  const openHour = Number(match.groups.openHour);
  const openMinute = Number(match.groups.openMinute);
  const closeHour = Number(match.groups.closeHour);
  const closeMinute = Number(match.groups.closeMinute);

  if (
    !isValidHourMinute(openHour, openMinute) ||
    !isValidHourMinute(closeHour, closeMinute)
  ) {
    return null;
  }

  const opensAtMinutes = openHour * 60 + openMinute;
  const closesAtMinutes = closeHour * 60 + closeMinute;

  if (opensAtMinutes >= closesAtMinutes) {
    return null;
  }

  return {
    kind: 'DAILY_WINDOW',
    closesAtMinutes,
    opensAtMinutes,
  };
}

export function isReservationWithinOperatingHours(
  operatingHours: string,
  requestedStartTime: Date,
  requestedEndTime: Date,
): boolean {
  const parsedOperatingHours = parseStationOperatingHours(operatingHours);

  if (!parsedOperatingHours) {
    return false;
  }

  if (parsedOperatingHours.kind === 'ALWAYS_OPEN') {
    return true;
  }

  const startLocalParts = getLocalDateTimeParts(requestedStartTime);
  const endLocalParts = getLocalDateTimeParts(requestedEndTime);

  if (!isSameLocalDate(startLocalParts, endLocalParts)) {
    return false;
  }

  const requestedStartMinutes =
    startLocalParts.hour * 60 + startLocalParts.minute;
  const requestedEndMinutes = endLocalParts.hour * 60 + endLocalParts.minute;

  return (
    requestedStartMinutes >= parsedOperatingHours.opensAtMinutes &&
    requestedEndMinutes <= parsedOperatingHours.closesAtMinutes
  );
}

function getLocalDateTimeParts(date: Date): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: ISTANBUL_TIMEZONE,
    year: 'numeric',
  }).formatToParts(date);

  return {
    day: readPart(parts, 'day'),
    hour: Number(readPart(parts, 'hour')),
    minute: Number(readPart(parts, 'minute')),
    month: readPart(parts, 'month'),
    year: readPart(parts, 'year'),
  };
}

function isSameLocalDate(
  firstDate: LocalDateTimeParts,
  secondDate: LocalDateTimeParts,
): boolean {
  return (
    firstDate.year === secondDate.year &&
    firstDate.month === secondDate.month &&
    firstDate.day === secondDate.day
  );
}

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`Missing date-time part: ${type}`);
  }

  return value;
}

function isValidHourMinute(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
