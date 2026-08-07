/**
 * Time helpers for the timesheet processor — pure minute math and HH:MM
 * formatting. Kept isolated so the processing and export layers share one
 * definition of "how a duration is written".
 */

/** Minutes → "HH:MM". Negatives clamp to 00:00 (callers pass >= 0). */
export function minutesToHHMM(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Number of days in a given month. `month` is 1-based (1 = January). */
export function daysInMonth(year, month) {
  // Day 0 of the next month is the last day of this month (UTC to avoid DST drift).
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Short weekday label ("Mon") for a Y/M/D, computed in UTC to avoid off-by-one. */
export function weekdayShort(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
}
