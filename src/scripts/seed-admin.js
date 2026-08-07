/**
 * Seed / reset the Admin account. A brand-new database has no users, and
 * there is no self-registration — this script bootstraps (or re-keys) the
 * first Admin so someone can log in and run the company.
 *
 * Usage:  node src/scripts/seed-admin.js <email> <password> [name]
 *    or:  npm run seed:admin -- <email> <password> [name]
 *
 * Running it again with the same email UPDATES that admin's password/name —
 * which doubles as the password-reset procedure for Phase 1.
 */
import env from '../config/env.js'; // validates env before we touch the DB
import mongoose from 'mongoose';
import User from '../modules/auth/user.model.js';
import { hashPassword } from '../modules/auth/auth.service.js';

const [email, password, name = 'Administrator'] = process.argv.slice(2);

// Basic guards — this is an operator tool, so errors must be self-explanatory.
if (!email || !password) {
  console.error('Usage: npm run seed:admin -- <email> <password> [name]');
  process.exit(1);
}
if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error(`"${email}" does not look like an email address.`);
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10_000 });

const passwordHash = await hashPassword(password);
const admin = await User.findOneAndUpdate(
  { email: email.toLowerCase() },
  { name, email: email.toLowerCase(), passwordHash, role: 'Admin', isActive: true },
  { new: true, upsert: true } // create if missing, update if present
);

console.log(`✓ Admin ready: ${admin.email} (${admin.name})`);
console.log('  You can now log in via POST /api/auth/login.');
await mongoose.connection.close();
