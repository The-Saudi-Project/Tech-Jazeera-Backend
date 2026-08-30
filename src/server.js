/**
 * Server boot — the process entry point.
 *
 * Boot order is a guarantee, not an accident:
 *   1. import env.js   → validates ALL env vars, exits if broken
 *   2. connect MongoDB → exits if unreachable
 *   3. listen          → only now can the app receive traffic
 *
 * The server therefore never runs in a half-configured state.
 */
import env from './config/env.js'; // side effect: validates env, may exit
import logger from './config/logger.js';
import { connectDb } from './config/db.js';
import app from './app.js';
import { runExpiryAlertCheck } from './modules/notifications/expiryAlert.job.js';

try {
  await connectDb();
} catch (err) {
  logger.error(`Failed to connect to MongoDB: ${err.message}`);
  logger.error(
    'Check MONGODB_URI in server/.env, and that your IP is allowed in Atlas → Network Access.'
  );
  process.exit(1);
}

const server = app.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

// P3-F: the expiry-alert notification job — once shortly after boot (so a
// server that's been down doesn't wait a full day for the first check),
// then every 24 hours. A plain setInterval, not a job-queue dependency —
// see expiryAlert.job.js's doc comment for why that's the right call here.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(() => runExpiryAlertCheck().catch((err) => logger.error(`[expiryAlertJob] failed: ${err.message}`)), 10_000);
const expiryAlertInterval = setInterval(
  () => runExpiryAlertCheck().catch((err) => logger.error(`[expiryAlertJob] failed: ${err.message}`)),
  ONE_DAY_MS
);

/**
 * Graceful shutdown: stop accepting new connections, let in-flight requests
 * finish, then close the DB connection. Without this, a deploy/restart can
 * cut off requests mid-write.
 */
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  clearInterval(expiryAlertInterval);
  server.close(async () => {
    const { default: mongoose } = await import('mongoose');
    await mongoose.connection.close();
    logger.info('Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
