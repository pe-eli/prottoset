import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { usersRepository } from '../../auth/users.repository';
import { auditLogService } from '../../observability/audit-log.service';
import { structuredLogger } from '../../observability/structured-logger';
import { feedbackNotifications } from './feedback.notifications';
import { feedbackRepository } from './feedback.repository';
import { feedbackStorage } from './feedback.storage';
import type {
  FeedbackAttachment,
  FeedbackAttachmentDraft,
  FeedbackContextInput,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
  FeedbackType,
} from './feedback.types';

function buildSubject(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  const firstSentence = normalized.split(/[.!?]/)[0]?.trim() || normalized;
  return firstSentence.slice(0, 96).trim() || 'Novo feedback';
}

function defaultPriorityForType(type: FeedbackType): FeedbackPriority {
  if (type === 'BUG' || type === 'PROBLEM') return 'HIGH';
  if (type === 'QUESTION') return 'MEDIUM';
  return 'LOW';
}

function sanitizeContext(context: FeedbackContextInput | undefined): FeedbackContextInput | undefined {
  if (!context) return undefined;
  return {
    route: context.route?.trim() || undefined,
    url: context.url?.trim() || undefined,
    browser: context.browser?.trim() || undefined,
    device: context.device?.trim() || undefined,
    viewport: context.viewport,
    timestamp: context.timestamp?.trim() || undefined,
    appVersion: context.appVersion?.trim() || undefined,
    plan: context.plan?.trim() || undefined,
  };
}

function buildMessageMetadata(input: {
  request: Request;
  userId: string;
  tenantId: string;
  userName: string;
  userEmail: string;
  context?: FeedbackContextInput;
  sender: 'USER' | 'ADMIN';
}): Record<string, unknown> {
  const context = sanitizeContext(input.context);
  const userAgent = input.request.header('user-agent') || undefined;
  const metadata: Record<string, unknown> = {
    userId: input.userId,
    tenantId: input.tenantId,
    userName: input.userName,
    userEmail: input.userEmail,
    browser: context?.browser ?? userAgent,
    device: context?.device,
    viewport: context?.viewport,
    route: context?.route,
    url: context?.url,
    timestamp: context?.timestamp ?? new Date().toISOString(),
    appVersion: context?.appVersion,
    plan: context?.plan,
    sender: input.sender,
    userAgent,
  };

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

async function persistAttachments(attachmentDraft: FeedbackAttachmentDraft | undefined): Promise<FeedbackAttachment[]> {
  if (!attachmentDraft) return [];

  const attachmentId = randomUUID();
  const stored = await feedbackStorage.saveAttachment(attachmentId, attachmentDraft);
  return [{
    id: attachmentId,
    fileUrl: `/api/feedback/attachments/${attachmentId}`,
    mimeType: attachmentDraft.mimeType,
    size: stored.size,
    createdAt: new Date().toISOString(),
  }];
}

async function cleanupAttachments(attachments: FeedbackAttachment[]): Promise<void> {
  await Promise.all(attachments.map((attachment) => feedbackStorage.removeAttachment(attachment.id, attachment.mimeType)));
}

async function addSimilarCount(detail: FeedbackThreadDetail): Promise<FeedbackThreadDetail> {
  if (detail.type !== 'FEATURE_REQUEST' && detail.type !== 'SUGGESTION') {
    return detail;
  }

  return {
    ...detail,
    similarCount: await feedbackRepository.countSimilarThreads(detail.type, detail.subject),
  };
}

export const feedbackService = {
  async createFeedback(input: {
    request: Request;
    tenantId: string;
    userId: string;
    userEmail: string;
    type: FeedbackType;
    message: string;
    context?: FeedbackContextInput;
    attachment?: FeedbackAttachmentDraft;
  }): Promise<FeedbackThreadDetail> {
    const user = await usersRepository.getById(input.userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const attachments = await persistAttachments(input.attachment);
    const messageId = randomUUID();

    try {
      const detail = await feedbackRepository.createThreadWithMessage({
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        subject: buildSubject(input.message),
        status: 'OPEN',
        priority: defaultPriorityForType(input.type),
        messageId,
        message: input.message,
        attachments,
        metadata: buildMessageMetadata({
          request: input.request,
          userId: input.userId,
          tenantId: input.tenantId,
          userName: user.displayName,
          userEmail: input.userEmail,
          context: input.context,
          sender: 'USER',
        }),
      });

      await auditLogService.record({
        tenantId: input.tenantId,
        actorId: input.userId,
        action: 'feedback.thread.created',
        targetType: 'feedback_thread',
        targetId: detail.id,
        status: 'success',
        details: { type: input.type },
      });
      structuredLogger.event('feedback_thread_created', {
        tenantId: input.tenantId,
        userId: input.userId,
        feedbackThreadId: detail.id,
        feedbackType: input.type,
      });

      return addSimilarCount(detail);
    } catch (error) {
      await cleanupAttachments(attachments);
      throw error;
    }
  },

  async listTenantThreads(tenantId: string): Promise<FeedbackThreadSummary[]> {
    return feedbackRepository.listTenantThreads(tenantId);
  },

  async getTenantThread(tenantId: string, threadId: string): Promise<FeedbackThreadDetail | null> {
    const detail = await feedbackRepository.getTenantThreadDetail(tenantId, threadId);
    return detail ? addSimilarCount(detail) : null;
  },

  async addTenantMessage(input: {
    request: Request;
    tenantId: string;
    userId: string;
    userEmail: string;
    threadId: string;
    message: string;
    context?: FeedbackContextInput;
    attachment?: FeedbackAttachmentDraft;
  }): Promise<FeedbackThreadDetail> {
    const user = await usersRepository.getById(input.userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const attachments = await persistAttachments(input.attachment);
    const messageId = randomUUID();

    try {
      const existing = await feedbackRepository.getTenantThreadDetail(input.tenantId, input.threadId);
      if (!existing) {
        throw new Error('Feedback não encontrado');
      }

      const nextStatus: FeedbackStatus | undefined = existing.status === 'RESOLVED' || existing.status === 'CLOSED'
        ? 'OPEN'
        : undefined;

      const detail = await feedbackRepository.appendTenantMessage({
        tenantId: input.tenantId,
        threadId: input.threadId,
        senderType: 'USER',
        messageId,
        message: input.message,
        attachments,
        metadata: buildMessageMetadata({
          request: input.request,
          userId: input.userId,
          tenantId: input.tenantId,
          userName: user.displayName,
          userEmail: input.userEmail,
          context: input.context,
          sender: 'USER',
        }),
        nextStatus,
      });

      await auditLogService.record({
        tenantId: input.tenantId,
        actorId: input.userId,
        action: 'feedback.message.created',
        targetType: 'feedback_thread',
        targetId: input.threadId,
        status: 'success',
      });
      structuredLogger.event('feedback_message_created', {
        tenantId: input.tenantId,
        userId: input.userId,
        feedbackThreadId: input.threadId,
      });

      return addSimilarCount(detail);
    } catch (error) {
      await cleanupAttachments(attachments);
      throw error;
    }
  },

  async listAdminThreads(filters: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    type?: FeedbackType;
    search?: string;
    limit: number;
  }): Promise<FeedbackThreadSummary[]> {
    const threads = await feedbackRepository.listAdminThreads(filters);
    return Promise.all(threads.map(async (thread) => {
      if (thread.type !== 'FEATURE_REQUEST' && thread.type !== 'SUGGESTION') {
        return thread;
      }
      return {
        ...thread,
        similarCount: await feedbackRepository.countSimilarThreads(thread.type, thread.subject),
      };
    }));
  },

  async getAdminThread(threadId: string): Promise<FeedbackThreadDetail | null> {
    const detail = await feedbackRepository.getAdminThreadDetail(threadId);
    return detail ? addSimilarCount(detail) : null;
  },

  async updateAdminStatus(threadId: string, status: FeedbackStatus): Promise<FeedbackThreadDetail | null> {
    const detail = await feedbackRepository.updateThreadStatus(threadId, status);
    if (!detail) return null;

    await auditLogService.record({
      tenantId: detail.tenantId,
      actorId: detail.userId,
      action: 'feedback.thread.status_updated',
      targetType: 'feedback_thread',
      targetId: threadId,
      status: 'success',
      details: { feedbackStatus: status },
    });

    return addSimilarCount(detail);
  },

  async updateAdminPriority(threadId: string, priority: FeedbackPriority): Promise<FeedbackThreadDetail | null> {
    const detail = await feedbackRepository.updateThreadPriority(threadId, priority);
    if (!detail) return null;

    await auditLogService.record({
      tenantId: detail.tenantId,
      actorId: detail.userId,
      action: 'feedback.thread.priority_updated',
      targetType: 'feedback_thread',
      targetId: threadId,
      status: 'success',
      details: { feedbackPriority: priority },
    });

    return addSimilarCount(detail);
  },

  async replyAsAdmin(input: {
    request: Request;
    threadId: string;
    adminUserId: string;
    adminEmail: string;
    message: string;
    context?: FeedbackContextInput;
    attachment?: FeedbackAttachmentDraft;
    notifyByEmail?: boolean;
  }): Promise<FeedbackThreadDetail> {
    const adminUser = await usersRepository.getById(input.adminUserId);
    if (!adminUser) {
      throw new Error('Administrador não encontrado');
    }

    const currentThread = await feedbackRepository.getAdminThreadDetail(input.threadId);
    if (!currentThread) {
      throw new Error('Feedback não encontrado');
    }

    const customer = await usersRepository.getById(currentThread.userId);
    if (!customer) {
      throw new Error('Usuário do feedback não encontrado');
    }

    const attachments = await persistAttachments(input.attachment);
    const messageId = randomUUID();

    try {
      const detail = await feedbackRepository.appendAdminMessage({
        threadId: input.threadId,
        messageId,
        message: input.message,
        attachments,
        metadata: buildMessageMetadata({
          request: input.request,
          userId: input.adminUserId,
          tenantId: currentThread.tenantId,
          userName: adminUser.displayName,
          userEmail: input.adminEmail,
          context: input.context,
          sender: 'ADMIN',
        }),
      });

      await auditLogService.record({
        tenantId: detail.tenantId,
        actorId: input.adminUserId,
        action: 'feedback.admin.reply',
        targetType: 'feedback_thread',
        targetId: input.threadId,
        status: 'success',
      });
      structuredLogger.event('feedback_admin_reply_created', {
        tenantId: detail.tenantId,
        userId: input.adminUserId,
        feedbackThreadId: input.threadId,
      });

      if (input.notifyByEmail !== false) {
        await feedbackNotifications.sendAdminReplyEmail({
          to: customer.email,
          threadSubject: detail.subject,
          userName: customer.displayName,
          message: input.message,
        });
      }

      return addSimilarCount(detail);
    } catch (error) {
      await cleanupAttachments(attachments);
      throw error;
    }
  },

  async getAttachmentDownload(input: {
    attachmentId: string;
    tenantId: string;
    canBypassTenant: boolean;
  }): Promise<{ mimeType: string; buffer: Buffer } | null> {
    const item = await feedbackRepository.getAttachmentById(input.attachmentId);
    if (!item) return null;
    if (!input.canBypassTenant && item.thread.tenantId !== input.tenantId) {
      return null;
    }

    const buffer = await feedbackStorage.readAttachment(item.attachment.id, item.attachment.mimeType);
    if (!buffer) {
      return null;
    }

    return {
      mimeType: item.attachment.mimeType,
      buffer,
    };
  },
};
