import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { createFeedbackMessageSchema, createFeedbackSchema, adminFeedbackQuerySchema, updateFeedbackPrioritySchema, updateFeedbackStatusSchema } from '../modules/feedback/feedback.schemas';
import { feedbackService } from '../modules/feedback/feedback.service';
import { isSupportAdmin } from '../modules/feedback/feedback-admin';

const feedbackLimiter = createSecurityRateLimit({
  name: 'feedback-create',
  message: 'Muitas mensagens enviadas em sequência. Aguarde alguns instantes.',
  ip: { limit: 15, windowMs: 15 * 60 * 1000 },
  user: { limit: 20, windowMs: 15 * 60 * 1000 },
});

const adminFeedbackLimiter = createSecurityRateLimit({
  name: 'feedback-admin-reply',
  message: 'Muitas respostas enviadas em sequência. Aguarde alguns instantes.',
  ip: { limit: 30, windowMs: 15 * 60 * 1000 },
  user: { limit: 60, windowMs: 15 * 60 * 1000 },
});

function requireSupportAdminAccess(req: Parameters<typeof asyncHandler>[0] extends never ? never : any, res: any, next: any): void {
  if (!req.authUser || !isSupportAdmin(req.authUser)) {
    res.status(403).json({ error: 'Acesso restrito ao inbox interno.' });
    return;
  }
  next();
}

const feedbackRouter = Router();
const adminFeedbackRouter = Router();

feedbackRouter.post('/', feedbackLimiter, asyncHandler(async (req, res) => {
  const parsed = createFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const detail = await feedbackService.createFeedback({
    request: req,
    tenantId: req.tenantId!,
    userId: req.authUser!.userId,
    userEmail: req.authUser!.email,
    type: parsed.data.type,
    message: parsed.data.message,
    context: parsed.data.context,
    attachment: parsed.data.attachment,
  });

  res.status(201).json({
    message: 'Recebemos sua mensagem 🚀',
    thread: detail,
  });
}));

feedbackRouter.get('/', asyncHandler(async (req, res) => {
  const threads = await feedbackService.listTenantThreads(req.tenantId!);
  res.status(200).json({ threads });
}));

feedbackRouter.get('/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const download = await feedbackService.getAttachmentDownload({
    attachmentId: req.params.attachmentId,
    tenantId: req.tenantId!,
    canBypassTenant: Boolean(req.authUser && isSupportAdmin(req.authUser)),
  });

  if (!download) {
    res.status(404).json({ error: 'Anexo não encontrado' });
    return;
  }

  res.setHeader('Cache-Control', 'private, max-age=60');
  res.type(download.mimeType).send(download.buffer);
}));

feedbackRouter.post('/:id/messages', feedbackLimiter, asyncHandler(async (req, res) => {
  const parsed = createFeedbackMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const detail = await feedbackService.addTenantMessage({
    request: req,
    tenantId: req.tenantId!,
    userId: req.authUser!.userId,
    userEmail: req.authUser!.email,
    threadId: req.params.id,
    message: parsed.data.message,
    context: parsed.data.context,
    attachment: parsed.data.attachment,
  });

  res.status(201).json({ thread: detail });
}));

feedbackRouter.get('/:id', asyncHandler(async (req, res) => {
  const detail = await feedbackService.getTenantThread(req.tenantId!, req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Feedback não encontrado' });
    return;
  }

  res.status(200).json({ thread: detail });
}));

adminFeedbackRouter.use(requireSupportAdminAccess);

adminFeedbackRouter.get('/', asyncHandler(async (req, res) => {
  const parsed = adminFeedbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const threads = await feedbackService.listAdminThreads({
    status: parsed.data.status,
    priority: parsed.data.priority,
    type: parsed.data.type,
    search: parsed.data.search,
    limit: parsed.data.limit ?? 50,
  });

  res.status(200).json({ threads });
}));

adminFeedbackRouter.get('/:id', asyncHandler(async (req, res) => {
  const detail = await feedbackService.getAdminThread(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Feedback não encontrado' });
    return;
  }

  res.status(200).json({ thread: detail });
}));

adminFeedbackRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const parsed = updateFeedbackStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const detail = await feedbackService.updateAdminStatus(req.params.id, parsed.data.status);
  if (!detail) {
    res.status(404).json({ error: 'Feedback não encontrado' });
    return;
  }

  res.status(200).json({ thread: detail });
}));

adminFeedbackRouter.patch('/:id/priority', asyncHandler(async (req, res) => {
  const parsed = updateFeedbackPrioritySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const detail = await feedbackService.updateAdminPriority(req.params.id, parsed.data.priority);
  if (!detail) {
    res.status(404).json({ error: 'Feedback não encontrado' });
    return;
  }

  res.status(200).json({ thread: detail });
}));

adminFeedbackRouter.post('/:id/reply', adminFeedbackLimiter, asyncHandler(async (req, res) => {
  const parsed = createFeedbackMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const detail = await feedbackService.replyAsAdmin({
    request: req,
    threadId: req.params.id,
    adminUserId: req.authUser!.userId,
    adminEmail: req.authUser!.email,
    message: parsed.data.message,
    context: parsed.data.context,
    attachment: parsed.data.attachment,
    notifyByEmail: true,
  });

  res.status(201).json({
    message: 'Resposta enviada com sucesso.',
    thread: detail,
  });
}));

export { feedbackRouter, adminFeedbackRouter };
