/**
 * Timezone-safe date utilities for exam schedules
 */

/**
 * Safely parses any exam schedule date value into a local Date object.
 * Handles MySQL DATETIME ("YYYY-MM-DD HH:mm:ss"), ISO ("YYYY-MM-DDTHH:mm:ss.sssZ"),
 * HTML datetime-local ("YYYY-MM-DDTHH:mm"), or existing Date objects without
 * timezone offset shifting.
 */
export function parseExamScheduleDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Match YYYY-MM-DD with optional time components (HH:mm or HH:mm:ss)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hours = match[4] !== undefined ? parseInt(match[4], 10) : 0;
    const minutes = match[5] !== undefined ? parseInt(match[5], 10) : 0;
    const seconds = match[6] !== undefined ? parseInt(match[6], 10) : 0;

    const date = new Date(year, month, day, hours, minutes, seconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallbackDate = new Date(str);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

/**
 * Formats an exam schedule date as "DD/MM/YYYY, hh:mm:ss A" (e.g. "23/09/2026, 11:35:00 AM").
 * Returns "Not scheduled" if invalid or not set.
 */
export function formatExamScheduleDateTime(value?: string | Date | null): string {
  const date = parseExamScheduleDate(value);
  if (!date) return 'Not scheduled';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `${day}/${month}/${year}, ${time}`;
}

/**
 * Extracts `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` from any schedule value
 * for two-way binding with HTML date and time input elements.
 */
export function getExamScheduleDateParts(value?: string | Date | null): { date: string; time: string } | null {
  if (!value) return null;

  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (match) {
    return {
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: match[4] !== undefined && match[5] !== undefined ? `${match[4]}:${match[5]}` : '00:00'
    };
  }

  const date = parseExamScheduleDate(value);
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`
  };
}
