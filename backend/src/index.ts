import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import quoteRoutes from './routes/quote.routes';
import packagesRoutes from './routes/packages.routes';
import leadsRoutes from './routes/leads.routes';
import contactsRoutes from './routes/contacts.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import queuesRoutes from './routes/queues.routes';
import leadFoldersRoutes from './routes/lead-folders.routes';
import productivityRoutes from './routes/productivity.routes';
import scheduleRoutes from './routes/schedule.routes';
import { requireAuth } from './middleware/auth.middleware';
import { setTenant } from './middleware/tenant.middleware';
import { getAllowedOrigins, requireTrustedOrigin, sanitizeErrorMessage } from './middleware/security.middleware';
import { asyncHandler } from './utils/asyncHandler';
import { refreshTokensRepository } from './auth/refresh-tokens.repository';
import { startBackgroundWorkers } from './jobs/workers';

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = getAllowedOrigins();
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: false,
  hsts: isProduction,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...allowedOrigins],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin não permitida'));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));

app.use('/api/auth', requireTrustedOrigin(allowedOrigins));
app.use('/api/auth', authRoutes);
app.use('/api', requireTrustedOrigin(allowedOrigins));
app.use('/api', asyncHandler(requireAuth));
app.use('/api', setTenant);

app.use('/api/quotes', quoteRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/queues', queuesRoutes);
app.use('/api/lead-folders', leadFoldersRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/schedule', scheduleRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler — catches unhandled errors from async handlers
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', sanitizeErrorMessage(err, isProduction));
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

refreshTokensRepository.deleteExpired().catch((err) => {
  console.error('[Auth] Failed to cleanup expired refresh tokens:', sanitizeErrorMessage(err, isProduction));
});

setInterval(() => {
  refreshTokensRepository.deleteExpired().catch((err) => {
    console.error('[Auth] Failed to cleanup expired refresh tokens:', sanitizeErrorMessage(err, isProduction));
  });
}, 6 * 60 * 60 * 1000);

if (process.env.RUN_JOB_WORKERS_INLINE !== 'false') {
  startBackgroundWorkers();
}

app.listen(PORT, () => {
  console.log(`ProttoSet backend running on port ${PORT}`);
});
