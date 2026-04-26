import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import leadsRoutes from './routes/leads.routes';
import contactsRoutes from './routes/contacts.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import queuesRoutes from './routes/queues.routes';
import leadFoldersRoutes from './routes/lead-folders.routes';
import subscriptionRoutes from './routes/subscriptions.routes';
import quoteRoutes from './routes/quote.routes';
import packagesRoutes from './routes/packages.routes';
import { subscriptionsController } from './controllers/subscriptions.controller';
import { evolutionWebhookController } from './controllers/evolution-webhook.controller';
import { requireAuth } from './middleware/auth.middleware';
import { requireVerifiedEmail } from './middleware/verified-email.middleware';
import { setTenant } from './middleware/tenant.middleware';
import { getAllowedOrigins, requireTrustedOrigin, sanitizeErrorMessage } from './middleware/security.middleware';
import { asyncHandler } from './utils/asyncHandler';
import { refreshTokensRepository } from './auth/refresh-tokens.repository';
import { startBackgroundWorkers } from './jobs/workers';
import { createSecurityRateLimit } from './middleware/rate-limit.middleware';
import { requireTenantNotBlocked } from './middleware/tenant-block.middleware';
import { webhookEventsRepository } from './modules/webhooks/webhook-events.repository';
import { assertProductionSecurityConfig } from './config/runtime-security';

assertProductionSecurityConfig();

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = getAllowedOrigins();
const isProduction = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY?.trim();

const webhookLimiter = createSecurityRateLimit({
  name: 'webhooks-global',
  message: 'Muitas requisições de webhook. Aguarde alguns instantes.',
  ip: { limit: 120, windowMs: 60 * 1000 },
});

function setNoStoreHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

if (trustProxy === 'true' || trustProxy === '1') {
  app.set('trust proxy', 1);
} else if (trustProxy === 'false' || trustProxy === '0') {
  app.set('trust proxy', false);
} else {
  app.set('trust proxy', 1);
}
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

// MercadoPago webhook — public endpoint (no auth, validated by signature)
app.post('/api/webhooks/mercadopago', webhookLimiter, express.raw({ type: '*/*', limit: '200kb' }), subscriptionsController.webhook);

// Evolution API webhook — public endpoint (identified by instanceName)
app.post('/api/webhooks/evolution', webhookLimiter, express.raw({ type: '*/*', limit: '200kb' }), evolutionWebhookController.handle);
app.post('/api/webhooks/evolution/:event', webhookLimiter, express.raw({ type: '*/*', limit: '200kb' }), evolutionWebhookController.handle);

app.use(express.json({ limit: '200kb' }));

app.use('/api/auth', setNoStoreHeaders, requireTrustedOrigin(allowedOrigins));
app.use('/api/auth', authRoutes);
app.use('/api/auth', (_req, res) => {
  res.status(404).json({ error: 'Rota de autenticação não encontrada' });
});

// Public pricing endpoint used before authentication (e.g. mobile plan screen).
app.get('/api/subscriptions/plans', setNoStoreHeaders, subscriptionsController.getPlans);

app.use('/api', setNoStoreHeaders, requireTrustedOrigin(allowedOrigins));
app.use('/api', asyncHandler(requireAuth));
app.use('/api', asyncHandler(requireVerifiedEmail));
app.use('/api', setTenant);
app.use('/api', asyncHandler(requireTenantNotBlocked));

app.use('/api/leads', leadsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/queues', queuesRoutes);
app.use('/api/lead-folders', leadFoldersRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/packages', packagesRoutes);

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

setInterval(() => {
  webhookEventsRepository.cleanupExpiredNonces().catch((err) => {
    console.error('[Webhook] Failed to cleanup expired nonces:', sanitizeErrorMessage(err, isProduction));
  });
}, 10 * 60 * 1000);

if (process.env.RUN_JOB_WORKERS_INLINE !== 'false') {
  startBackgroundWorkers();
}

app.listen(PORT, () => {
  console.log(`ProttoSet backend running on port ${PORT}`);
});
