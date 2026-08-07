/**
 * Timesheet processor — the deterministic attendance rules. Pure functions, no
 * I/O, so the logic is trivial to reason about, test, and extend.
 *
 * Business rules (confirmed with the administrator):
 *  - For each date: sort punches, FIRST = Login, LAST = Logout, ignore the rest.
 *    Worked = Logout − Login. Exactly one punch → Single Punch, worked 00:00.
 *  - A normal day requires the configured hours (08:00 default). Deficiency and
 *    overtime are computed on every normal day, so a No-Attendance or
 *    Single-Punch day shows a full-day deficiency ("literal" policy).
 *  - A HOLIDAY (admin-marked date) requires 0 hours: it never contributes a
 *    deficiency, whether or not the person shows up. If they DO work a holiday,
 *    the whole worked span counts as overtime.
 */
import { STATUS } from './timesheet.constants.js';
import { minutesToHHMM, daysInMonth, weekdayShort } from './timesheet.time.js';

/** Status for a normal (non-holiday) day from punch count and worked-vs-required. */
function normalStatus(punchCount, workedMinutes, requiredMinutes) {
  if (punchCount === 0) return STATUS.NO_ATTENDANCE;
  if (punchCount === 1) return STATUS.SINGLE_PUNCH;
  if (workedMinutes > requiredMinutes) return STATUS.OVERTIME;
  if (workedMinutes < requiredMinutes) return STATUS.DEFICIENT;
  return STATUS.PRESENT;
}

/**
 * Build the month's rows and summary.
 * @param {{day:number, minutes:number}[]} punches  parsed punches (this month)
 * @param {{year:number, month:number, requiredMinutes:number, holidays?:number[]}} opts
 */
export function buildTimesheet(punches, { year, month, requiredMinutes, holidays = [] }) {
  const holidaySet = new Set(holidays);

  // Group minute-of-day values by day-of-month.
  const byDay = new Map();
  for (const { day, minutes } of punches) {
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(minutes);
  }

  const totalDays = daysInMonth(year, month);
  const rows = [];
  const summary = {
    workingDays: 0, // days actually expected to work (all days minus holidays)
    holidayDays: 0,
    presentDays: 0, // non-holiday days with a complete login + logout pair
    singlePunchDays: 0,
    noAttendanceDays: 0,
    totalWorkedMinutes: 0,
    totalRequiredMinutes: 0,
    totalDeficiencyMinutes: 0,
    totalOvertimeMinutes: 0,
  };

  for (let day = 1; day <= totalDays; day++) {
    const dayPunches = (byDay.get(day) ?? []).slice().sort((a, b) => a - b);
    const count = dayPunches.length;
    const isHoliday = holidaySet.has(day);

    let login = null;
    let logout = null;
    let workedMinutes = 0;
    if (count >= 2) {
      login = dayPunches[0];
      logout = dayPunches[count - 1];
      workedMinutes = logout - login;
    } else if (count === 1) {
      login = dayPunches[0]; // single punch is treated as a login; logout blank
    }

    // Required is 0 on holidays; otherwise the configured amount.
    const requiredForDay = isHoliday ? 0 : requiredMinutes;
    let deficiencyMinutes;
    let overtimeMinutes;
    let status;

    if (isHoliday) {
      deficiencyMinutes = 0; // holidays never penalize
      overtimeMinutes = workedMinutes; // any holiday work is overtime
      status = count >= 2 ? STATUS.HOLIDAY_WORKED : STATUS.HOLIDAY;
      summary.holidayDays += 1;
    } else {
      deficiencyMinutes = Math.max(0, requiredForDay - workedMinutes);
      overtimeMinutes = Math.max(0, workedMinutes - requiredForDay);
      status = normalStatus(count, workedMinutes, requiredForDay);
      if (count >= 2) summary.presentDays += 1;
      else if (count === 1) summary.singlePunchDays += 1;
      else summary.noAttendanceDays += 1;
    }

    summary.totalWorkedMinutes += workedMinutes;
    summary.totalRequiredMinutes += requiredForDay;
    summary.totalDeficiencyMinutes += deficiencyMinutes;
    summary.totalOvertimeMinutes += overtimeMinutes;

    rows.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day: weekdayShort(year, month, day),
      login: login == null ? null : minutesToHHMM(login),
      logout: logout == null ? null : minutesToHHMM(logout),
      workedMinutes,
      requiredMinutes: requiredForDay,
      deficiencyMinutes,
      overtimeMinutes,
      status,
      isHoliday,
    });
  }

  summary.workingDays = totalDays - summary.holidayDays;
  return { rows, summary };
}
