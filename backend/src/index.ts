import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import quoteRoutes from './routes/quote.routes';
import packagesRoutes from './routes/packages.routes';
import leadsRoutes from './routes/leads.routes';
import contactsRoutes from './routes/contacts.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import queuesRoutes from './routes/queues.routes';
import conversationsRoutes from './routes/conversations.routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '200kb' }));

app.use('/api/pdfs', express.static(path.join(__dirname, '../generated')));

app.use('/api/quotes', quoteRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/queues', queuesRoutes);
app.use('/api/conversations', conversationsRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`ProttoSet backend running on port ${PORT}`);
});
