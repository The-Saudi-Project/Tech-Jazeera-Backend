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

/**
 * Graceful shutdown: stop accepting new connections, let in-flight requests
 * finish, then close the DB connection. Without this, a deploy/restart can
 * cut off requests mid-write.
 */
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(async () => {
    const { default: mongoose } = await import('mongoose');
    await mongoose.connection.close();
    logger.info('Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
