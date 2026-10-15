/**
 * Timezone & Calendar Date Utilities for Asia/Colombo (Sri Lanka Time).
 *
 * Rules:
 * 1. Office timezone is strictly Asia/Colombo (fixed UTC+05:30 offset, no DST).
 * 2. Datetime inputs from datetime-local controls (YYYY-MM-DDTHH:mm) are parsed as explicit
 *    wall-clock time in Colombo, converted to UTC Instants independently of server or client timezone.
 * 3. Actual calendar dates are validated; invalid calendar dates (e.g. Feb 30, April 31, non-leap Feb 29)
 *    are rejected with clear errors instead of allowing silent rollover.
 * 4. Display formatting consistently renders in Asia/Colombo time.
 */

export const OFFICE_TIMEZONE = "Asia/Colombo";
export const OFFICE_TIMEZONE_LABEL = "Sri Lanka Time (Asia/Colombo, UTC+5:30)";
export const OFFICE_UTC_OFFSET_MINUTES = 330; // 5 hours 30 minutes

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  const daysMap = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysMap[month - 1] ?? 0;
}

/**
 * Validates calendar date and time numbers without silent rollover.
 */
export function validateCalendarDate(parts: CalendarDateParts): { valid: boolean; error?: string } {
  const { year, month, day, hour, minute, second } = parts;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { valid: false, error: "Year must be between 2000 and 2100." };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { valid: false, error: "Month must be between 1 and 12." };
  }
  const maxDays = getDaysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDays) {
    return {
      valid: false,
      error: `Invalid calendar date: Day must be between 1 and ${maxDays} for month ${month}/${year}.`,
    };
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { valid: false, error: "Hour must be between 0 and 23." };
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { valid: false, error: "Minute must be between 0 and 59." };
  }
  if (!Number.isInteger(second) || second < 0 || second > 59) {
    return { valid: false, error: "Second must be between 0 and 59." };
  }

  return { valid: true };
}

/**
 * Parses a datetime-local input string or ISO string representing Colombo time
 * and converts it into a UTC Date instant.
 *
 * Supported formats:
 * - "YYYY-MM-DDTHH:mm"
 * - "YYYY-MM-DDTHH:mm:ss"
 * - "YYYY-MM-DD HH:mm"
 * - "YYYY-MM-DD HH:mm:ss"
 */
export function parseDateTimeInOfficeTz(raw: unknown): {
  date: Date | null;
  error?: string;
} {
  if (typeof raw !== "string") {
    return { date: null, error: "Invalid date format: value must be a string." };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { date: null, error: "Date and time are required." };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (!match) {
    return {
      date: null,
      error: "Date must be formatted as YYYY-MM-DDTHH:mm (e.g. 2026-11-01T10:00).",
    };
  }

  const parts: CalendarDateParts = {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    hour: parseInt(match[4], 10),
    minute: parseInt(match[5], 10),
    second: match[6] ? parseInt(match[6], 10) : 0,
  };

  const validation = validateCalendarDate(parts);
  if (!validation.valid) {
    return { date: null, error: validation.error };
  }

  // Convert Colombo time (+05:30) to UTC:
  // Date.UTC returns epoch milliseconds treating arguments as UTC.
  // Colombo is 330 minutes ahead of UTC, so UTC timestamp = Colombo - 330 minutes.
  const colomboUtcOffsetMs = OFFICE_UTC_OFFSET_MINUTES * 60 * 1000;
  const nominalUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const actualUtcMs = nominalUtcMs - colomboUtcOffsetMs;

  return { date: new Date(actualUtcMs) };
}

/**
 * Formats a Date object or UTC ISO string for display in Sri Lanka time.
 * Example output: "Nov 1, 2026, 10:00 AM"
 */
export function formatDateTimeInOfficeTz(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Formats a date only in Sri Lanka time.
 * Example output: "Nov 1, 2026"
 */
export function formatDateInOfficeTz(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Formats time only in Sri Lanka time.
 * Example output: "10:00 AM"
 */
export function formatTimeInOfficeTz(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Time";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Formats a Date for an HTML `<input type="datetime-local">` default value in Sri Lanka time.
 * Format: "YYYY-MM-DDTHH:mm"
 */
export function formatDateTimeLocalValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  // Extract parts in Asia/Colombo timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export type ReservationTemporalStatus = "UPCOMING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";

/**
 * Derives temporal status for a reservation from timestamps and status.
 * CONFIRMED reservations derive Upcoming / In Progress / Finished dynamically.
 */
export function deriveReservationTemporalStatus(
  status: "CONFIRMED" | "CANCELLED",
  startAt: Date | string,
  endAt: Date | string,
  now: Date = new Date()
): ReservationTemporalStatus {
  if (status === "CANCELLED") {
    return "CANCELLED";
  }

  const start = typeof startAt === "string" ? new Date(startAt) : startAt;
  const end = typeof endAt === "string" ? new Date(endAt) : endAt;

  if (now < start) {
    return "UPCOMING";
  }
  if (now >= start && now < end) {
    return "IN_PROGRESS";
  }
  return "FINISHED";
}
