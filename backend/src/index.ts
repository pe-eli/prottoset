import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
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

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
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

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);

app.use('/api/pdfs', express.static(path.join(__dirname, '../generated')));

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
  console.error('[Server] Unhandled error:', err.message, err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`ProttoSet backend running on port ${PORT}`);
});
