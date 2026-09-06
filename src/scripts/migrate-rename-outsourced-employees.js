/**
 * One-time migration: rename the Employee `type` value 'Client' → 'Outsourced'.
 *
 * 'Client' was always a confusing label for "this company's own workforce
 * supplied to a client" — easily mistaken for the unrelated Client
 * (customer-company) model. The code-level rename (schema enum, validation,
 * every service/UI reference) shipped alongside this script; this migration
 * is the one-time data fixup for existing production documents still
 * carrying the old value.
 *
 * Usage:  node src/scripts/migrate-rename-outsourced-employees.js
 *    or:  npm run migrate:rename-outsourced
 *
 * Idempotent: only touches documents still at type: 'Client' — safe to
 * re-run (a second run reports 0 modified).
 */
import env from '../config/env.js'; // validates env before we touch the DB
import mongoose from 'mongoose';
import Employee from '../modules/employees/employee.model.js';

await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10_000 });

const result = await Employee.updateMany({ type: 'Client' }, { $set: { type: 'Outsourced' } });
console.log(`✓ Renamed ${result.modifiedCount} employee(s) from type: 'Client' to type: 'Outsourced'.`);

await mongoose.connection.close();
