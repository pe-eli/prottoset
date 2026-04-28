import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAuth } from '../middleware/auth.middleware';
import { setTenant } from '../middleware/tenant.middleware';

process.env.NODE_ENV = 'production';
process.env.SUPPORT_ADMIN_EMAILS = 'support@closr.test';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  consumeRateLimit: vi.fn(),
  feedbackService: {
    createFeedback: vi.fn(),
    listTenantThreads: vi.fn(),
    getTenantThread: vi.fn(),
    addTenantMessage: vi.fn(),
    listAdminThreads: vi.fn(),
    getAdminThread: vi.fn(),
    updateAdminStatus: vi.fn(),
    updateAdminPriority: vi.fn(),
    replyAsAdmin: vi.fn(),
    getAttachmentDownload: vi.fn(),
  },
}));

vi.mock('../auth/tokens', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

vi.mock('../security/rate-limit.store', () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));

vi.mock('../security/fraud.service', () => ({
  fraudService: {
    recordEvent: vi.fn(async () => undefined),
    detectRequestBurstAndBlock: vi.fn(async () => undefined),
  },
}));

vi.mock('../modules/feedback/feedback.service', () => ({
  feedbackService: mocks.feedbackService,
}));

import { feedbackRouter, adminFeedbackRouter } from './feedback.routes';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/api', requireAuth, setTenant);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/admin/feedback', adminFeedbackRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

const baseThread = {
  id: 'thread-1',
  tenantId: 'tenant-1',
  userId: 'tenant-1',
  type: 'BUG',
  subject: 'Bug ao salvar lead',
  status: 'OPEN',
  priority: 'HIGH',
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastMessagePreview: 'Não consigo salvar',
  lastSenderType: 'USER',
  messages: [
    {
      id: 'message-1',
      threadId: 'thread-1',
      senderType: 'USER',
      message: 'Não consigo salvar',
      attachments: [],
      metadata: { route: '/leads/prospeccao' },
      createdAt: new Date().toISOString(),
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 10, retryAfterMs: 1000 });
  mocks.verifyAccessToken.mockImplementation(async (token: string) => {
    if (token === 'user-token') {
      return {
        sub: 'tenant-1',
        email: 'user@closr.test',
        role: 'member',
        tenantId: 'tenant-1',
        emailVerified: true,
      };
    }

    if (token === 'admin-token') {
      return {
        sub: 'admin-user',
        email: 'support@closr.test',
        role: 'member',
        tenantId: 'admin-user',
        emailVerified: true,
      };
    }

    return null;
  });

  mocks.feedbackService.createFeedback.mockResolvedValue(baseThread);
  mocks.feedbackService.listTenantThreads.mockResolvedValue([baseThread]);
  mocks.feedbackService.getTenantThread.mockResolvedValue(baseThread);
  mocks.feedbackService.addTenantMessage.mockResolvedValue({
    ...baseThread,
    lastSenderType: 'USER',
    messages: [...baseThread.messages, {
      id: 'message-2',
      threadId: 'thread-1',
      senderType: 'USER',
      message: 'Segue mais contexto',
      attachments: [],
      metadata: {},
      createdAt: new Date().toISOString(),
    }],
  });
  mocks.feedbackService.listAdminThreads.mockResolvedValue([{ ...baseThread, userName: 'Maria', userEmail: 'user@closr.test', planName: 'Starter' }]);
  mocks.feedbackService.getAdminThread.mockResolvedValue({ ...baseThread, userName: 'Maria', userEmail: 'user@closr.test', planName: 'Starter' });
  mocks.feedbackService.updateAdminStatus.mockResolvedValue({ ...baseThread, status: 'IN_PROGRESS' });
  mocks.feedbackService.updateAdminPriority.mockResolvedValue({ ...baseThread, priority: 'CRITICAL' });
  mocks.feedbackService.replyAsAdmin.mockResolvedValue({
    ...baseThread,
    status: 'IN_PROGRESS',
    lastSenderType: 'ADMIN',
    messages: [...baseThread.messages, {
      id: 'message-admin',
      threadId: 'thread-1',
      senderType: 'ADMIN',
      message: 'Vamos corrigir isso.',
      attachments: [],
      metadata: {},
      createdAt: new Date().toISOString(),
    }],
  });
  mocks.feedbackService.getAttachmentDownload.mockResolvedValue({ mimeType: 'image/png', buffer: Buffer.from('png') });
});

describe('feedback routes', () => {
  it('requires authentication for user endpoints', async () => {
    const app = createApp();
    const response = await request(app).get('/api/feedback');
    expect(response.status).toBe(401);
  });

  it('creates feedback using the authenticated tenant context', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer user-token')
      .send({
        type: 'BUG',
        message: 'Erro ao salvar um lead após preencher o formulário.',
        context: {
          route: '/leads/prospeccao',
          plan: 'Starter',
          tenantId: 'forged-tenant',
        },
      });

    expect(response.status).toBe(201);
    expect(mocks.feedbackService.createFeedback).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'tenant-1',
      userEmail: 'user@closr.test',
    }));
    expect(response.body.message).toContain('Recebemos sua mensagem');
  });

  it('rejects unsupported screenshot mime types', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer user-token')
      .send({
        type: 'BUG',
        message: 'Erro com anexo inválido',
        attachment: {
          fileName: 'script.gif',
          mimeType: 'image/gif',
          size: 120,
          base64: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
        },
      });

    expect(response.status).toBe(400);
    expect(mocks.feedbackService.createFeedback).not.toHaveBeenCalled();
  });

  it('allows authenticated users to add messages to their own thread', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/feedback/thread-1/messages')
      .set('Authorization', 'Bearer user-token')
      .send({ message: 'Consegui reproduzir em outra tela também.' });

    expect(response.status).toBe(201);
    expect(mocks.feedbackService.addTenantMessage).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      threadId: 'thread-1',
      userId: 'tenant-1',
    }));
  });

  it('blocks non-admin users from the internal inbox', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(403);
  });

  it('allows support admins to update status and reply', async () => {
    const app = createApp();

    const statusResponse = await request(app)
      .patch('/api/admin/feedback/thread-1/status')
      .set('Authorization', 'Bearer admin-token')
      .send({ status: 'IN_PROGRESS' });

    expect(statusResponse.status).toBe(200);
    expect(mocks.feedbackService.updateAdminStatus).toHaveBeenCalledWith('thread-1', 'IN_PROGRESS');

    const replyResponse = await request(app)
      .post('/api/admin/feedback/thread-1/reply')
      .set('Authorization', 'Bearer admin-token')
      .send({ message: 'Já identificamos a causa e vamos corrigir.' });

    expect(replyResponse.status).toBe(201);
    expect(mocks.feedbackService.replyAsAdmin).toHaveBeenCalledWith(expect.objectContaining({
      threadId: 'thread-1',
      adminUserId: 'admin-user',
      adminEmail: 'support@closr.test',
    }));
  });

  it('returns 429 when feedback rate limit is exceeded', async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 30000 });
    const app = createApp();

    const response = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer user-token')
      .send({ type: 'BUG', message: 'Não consigo concluir a ação.' });

    expect(response.status).toBe(429);
    expect(response.body.code).toBe('rate_limit_exceeded');
  });
});
