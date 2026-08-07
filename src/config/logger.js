/**
 * Application-wide Winston logger.
 *
 * Why not console.log: real logs need severity levels (so noise can be
 * filtered), timestamps (so incidents can be reconstructed), and a stable
 * format (so they can be shipped to a file or log service later without
 * touching call sites).
 *
 * Development: colorized, human-readable console output.
 * Production:  JSON to the console plus files under logs/
 *              (error.log for errors only, combined.log for everything).
 *
 * SECURITY: never log passwords, tokens, cookies, or secrets. Log identifiers
 * (user id, employee id) instead of full documents.
 */
import winston from 'winston';
import env from './env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/** Human-friendly single-line format for the dev console. */
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }), // include stack traces when an Error object is logged
  printf(({ level, message, timestamp: ts, stack }) =>
    stack ? `${ts} ${level}: ${message}\n${stack}` : `${ts} ${level}: ${message}`
  )
);

/** Machine-parsable format for production files/console. */
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  // 'debug' in dev so everything shows; 'info' in prod to keep files lean.
  level: env.isProduction ? 'info' : 'debug',
  format: env.isProduction ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    // File transports only in production — in dev the console is enough and
    // stray log files would just clutter the repo.
    ...(env.isProduction
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});

export default logger;
