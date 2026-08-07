/**
 * Timesheet service — orchestrates a single processing run. Controllers stay
 * thin; all the "load employee → parse → compute" wiring lives here so the
 * preview and export endpoints always produce identical results.
 */
import Employee from '../employees/employee.model.js';
import ApiError from '../../utils/ApiError.js';
import { DEFAULT_REQUIRED_MINUTES } from './timesheet.constants.js';
import { parseAttendanceWorkbook } from './timesheet.parser.js';
import { buildTimesheet } from './timesheet.processor.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Process one employee's attendance file for one month.
 * @param {{buffer:Buffer, employeeId:string, month:number, year:number, requiredMinutes?:number}} input
 * @returns the full computed timesheet (employee, rows, summary, warnings).
 */
export async function processTimesheet({ buffer, employeeId, month, year, requiredMinutes, holidays = [] }) {
  const employee = await Employee.findById(employeeId).select('fullName employeeId').lean();
  if (!employee) throw new ApiError(404, 'Employee not found.');

  const required = requiredMinutes ?? DEFAULT_REQUIRED_MINUTES;
  const { punches, warnings, detectedEmployee } = await parseAttendanceWorkbook(buffer, { month, year });

  if (punches.length === 0) {
    throw new ApiError(
      400,
      `No attendance punches for ${MONTH_NAMES[month - 1]} ${year} were found in this file. Check the file and the selected month.`
    );
  }

  // Soft employee-match check — a mismatch warns, it never blocks (device
  // exports label people inconsistently).
  const allWarnings = [...warnings];
  if (detectedEmployee) {
    const wanted = [employee.employeeId, employee.fullName].filter(Boolean).map((s) => s.toLowerCase());
    const seen = [detectedEmployee.id, detectedEmployee.name].filter(Boolean).map((s) => s.toLowerCase());
    const matches = seen.some((s) => wanted.some((w) => w.includes(s) || s.includes(w)));
    if (seen.length && !matches) {
      allWarnings.unshift(
        `This file looks like it belongs to "${detectedEmployee.name || detectedEmployee.id}", not the selected employee. Double-check you picked the right person.`
      );
    }
  }

  const { rows, summary } = buildTimesheet(punches, { year, month, requiredMinutes: required, holidays });

  return {
    employee: {
      id: employee._id.toString(),
      fullName: employee.fullName,
      employeeId: employee.employeeId,
    },
    month,
    year,
    monthName: MONTH_NAMES[month - 1],
    requiredMinutes: required,
    generatedAt: new Date().toISOString(),
    rows,
    summary,
    warnings: allWarnings,
  };
}
