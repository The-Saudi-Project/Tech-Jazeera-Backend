/**
 * One-time seed for the HR PRD's statutory leave categories and fixed-date
 * national holidays that have exact numbers/dates stated in the PRD itself
 * (not invented) — see chat for the reasoning on what's included vs held
 * back for user confirmation (Sick/Bereavement/Hajj leave day-counts, and
 * Eid al-Fitr/Eid al-Adha dates, which are Hijri/moon-sighting-dependent).
 *
 * Idempotent-ish: uses upsert on `name` for LeaveType (unique) and skips a
 * Holiday if one with the same name+startDate already exists, so re-running
 * this safely does nothing on a second run.
 */
import env from './src/config/env.js';
import mongoose from 'mongoose';
import LeaveType from './src/modules/leave/leaveType.model.js';
import Holiday from './src/modules/holidays/holiday.model.js';

await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10_000 });

// PRD Module 3: "Emergency Leave (5 days paid), Paternity Leave (3 days
// paid), Marriage Leave (5 days paid)" — exact numbers straight from the
// document, not invented.
const leaveTypes = [
  { name: 'Emergency Leave', recurrence: 'Manual', maxDaysPerRequest: 5, isPaid: true },
  { name: 'Paternity Leave', recurrence: 'Manual', maxDaysPerRequest: 3, isPaid: true },
  { name: 'Marriage Leave', recurrence: 'Manual', maxDaysPerRequest: 5, isPaid: true },
];

for (const lt of leaveTypes) {
  const result = await LeaveType.findOneAndUpdate(
    { name: lt.name },
    { $setOnInsert: lt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`LeaveType "${lt.name}":`, result.createdAt.getTime() === result.updatedAt.getTime() ? 'created' : 'already existed');
}

// PRD Module 3: "Saudi National Day (Sept 23)" and "Founding Day (Feb 22)"
// — fixed Gregorian dates, government-set, not Hijri/moon-sighting-based.
// Seeding the next upcoming occurrence of each (today: 2026-08-30).
const holidays = [
  { name: 'Saudi National Day', startDate: new Date('2026-09-23'), endDate: new Date('2026-09-23'), isPaid: true },
  { name: 'Founding Day', startDate: new Date('2027-02-22'), endDate: new Date('2027-02-22'), isPaid: true },
];

for (const h of holidays) {
  const existing = await Holiday.findOne({ name: h.name, startDate: h.startDate });
  if (existing) {
    console.log(`Holiday "${h.name}" (${h.startDate.toISOString().slice(0, 10)}): already existed`);
    continue;
  }
  await Holiday.create(h);
  console.log(`Holiday "${h.name}" (${h.startDate.toISOString().slice(0, 10)}): created`);
}

await mongoose.connection.close();
