/**
 * Express application assembly.
 *
 * This file wires middleware and routes together — nothing else. Keeping it
 * separate from server.js means the app can later be imported without
 * starting a listener (useful for testing and for keeping boot logic clean).
 *
 * MIDDLEWARE ORDER MATTERS and is deliberate:
 *   1. helmet     — set security headers before anything else runs
 *   2. cors       — reject foreign origins early, allow credentials for the
 *                   refresh-token cookie (M2)
 *   3. parsers    — JSON body with a size cap (large bodies are a DoS vector)
 *   4. rate limit — applied to /api as a whole
 *   5. routes     — feature modules mount here as milestones add them
 *   6. 404        — anything that fell through every route
 *   7. errors     — LAST, so it catches failures from all of the above
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import env from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import ApiResponse from './utils/ApiResponse.js';
import authRoutes from './modules/auth/auth.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import employeeRoutes from './modules/employees/employee.routes.js';
import clientRoutes from './modules/clients/client.routes.js';
import deploymentRoutes from './modules/deployments/deployment.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import documentRoutes from './modules/documents/document.routes.js';
import quotationRoutes from './modules/quotations/quotation.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import timesheetProcessorRoutes from './modules/timesheetProcessor/timesheet.routes.js';
import nfcRoutes from './modules/nfc/nfc.routes.js';
import nfcPublicRoutes from './modules/nfc/nfc.public.routes.js';
import { serveNfcMedia } from './modules/nfc/nfc.upload.js';
import userRoutes from './modules/users/user.routes.js';
import leaveRoutes from './modules/leave/leave.routes.js';
import meRoutes from './modules/me/me.routes.js';
import staffAttendanceRoutes from './modules/staffAttendance/staffAttendance.routes.js';

const app = express();

// Behind a reverse proxy (production), trust it so req.ip is the real client
// IP — otherwise rate limiting and audit logs would see the proxy's IP.
if (env.isProduction) app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl, // exact origin, not '*' — required for cookies
    credentials: true, // allow the httpOnly refresh-token cookie (M2)
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser()); // parses the httpOnly refresh-token cookie
app.use('/api', apiLimiter);

/**
 * GET /api/health — liveness check.
 * Response: 200 { success, message, data: { uptime, environment, database } }
 * Used by humans during setup and later by any uptime monitor. Reports the
 * Mongoose connection state so a dead DB is visible without reading logs.
 */
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json(
    new ApiResponse('OK', {
      uptime: `${Math.floor(process.uptime())}s`,
      environment: env.nodeEnv,
      database: dbStates[mongoose.connection.readyState] ?? 'unknown',
    })
  );
});

// Feature modules — each module mounts its own router.
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/timesheet-processor', timesheetProcessorRoutes);
app.use('/api/nfc', nfcRoutes);
// P2-M2: staff-account management, leave (types + requests), and the
// self-service "me" surface a Worker's ESS portal runs on.
app.use('/api/users', userRoutes);
app.use('/api', leaveRoutes); // owns /api/leave-types and /api/leave
app.use('/api/me', meRoutes);
app.use('/api/staff-attendance', staffAttendanceRoutes);

// Public NFC tap pages — server-rendered HTML, NOT under /api (no auth, own
// rate limiter). Must be mounted before the 404 handler.
app.use('/c', nfcPublicRoutes);

// Public NFC media (logos/photos) — random-named files, cached, no auth.
app.get('/nfc-media/:filename', serveNfcMedia);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
