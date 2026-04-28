import { randomUUID } from 'crypto';
import { type PoolClient } from 'pg';
import { systemQuery, systemTransaction, tenantQuery, tenantTransaction } from '../../db/pool';
import type {
  FeedbackAttachment,
  FeedbackMessage,
  FeedbackPriority,
  FeedbackSenderType,
  FeedbackStatus,
  FeedbackThread,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
  FeedbackType,
} from './feedback.types';

interface FeedbackThreadRow {
  id: string;
  tenant_id: string;
  user_id: string;
  type: FeedbackType;
  subject: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  last_message_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface FeedbackMessageRow {
  id: string;
  thread_id: string;
  sender_type: FeedbackSenderType;
  message: string;
  attachments: Array<{ id: string; fileUrl: string; mimeType: string; size: number; createdAt: string }> | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

interface FeedbackAttachmentRow {
  id: string;
  file_url: string;
  mime_type: string;
  size: number;
  created_at: Date;
}

interface FeedbackSummaryRow extends FeedbackThreadRow {
  last_message_preview: string | null;
  last_sender_type: FeedbackSenderType | null;
  user_name: string | null;
  user_email: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  context_metadata: Record<string, unknown> | null;
}

function toAttachment(row: FeedbackAttachmentRow): FeedbackAttachment {
  return {
    id: row.id,
    fileUrl: row.file_url,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at.toISOString(),
  };
}

function toThread(row: FeedbackThreadRow): FeedbackThread {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    type: row.type,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    lastMessageAt: row.last_message_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizePlanName(planId: string | null): string | undefined {
  if (!planId) return undefined;
  if (planId === 'solo') return 'Starter';
  if (planId === 'agencia') return 'Pro';
  if (planId === 'pro') return 'Enterprise';
  return planId;
}

function toSummary(row: FeedbackSummaryRow): FeedbackThreadSummary {
  return {
    ...toThread(row),
    lastMessagePreview: row.last_message_preview,
    lastSenderType: row.last_sender_type,
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    planName: normalizePlanName(row.plan_id),
    subscriptionStatus: row.subscription_status,
    context: row.context_metadata ?? undefined,
  };
}

function toMessage(row: FeedbackMessageRow): FeedbackMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderType: row.sender_type,
    message: row.message,
    attachments: Array.isArray(row.attachments)
      ? row.attachments.map((attachment) => ({
        id: attachment.id,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
      }))
      : [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

async function listTenantMessages(tenantId: string, threadId: string): Promise<FeedbackMessage[]> {
  const { rows } = await tenantQuery<FeedbackMessageRow>(
    tenantId,
    `SELECT fm.id,
            fm.thread_id,
            fm.sender_type,
            fm.message,
            fm.attachments,
            fm.metadata,
            fm.created_at
       FROM feedback_messages fm
      WHERE fm.thread_id = $1
      ORDER BY fm.created_at ASC`,
    [threadId],
  );
  return rows.map(toMessage);
}

function buildScopedSummaryQuery(baseWhereSql: string): string {
  return `SELECT ft.id,
                 ft.tenant_id,
                 ft.user_id,
                 ft.type,
                 ft.subject,
                 ft.status,
                 ft.priority,
                 ft.last_message_at,
                 ft.created_at,
                 ft.updated_at,
                 last_message.message AS last_message_preview,
                 last_message.sender_type AS last_sender_type,
                 users.display_name AS user_name,
                 users.email AS user_email,
                 subscription.plan_id,
                 subscription.status AS subscription_status,
                 first_context.metadata AS context_metadata
            FROM feedback_threads ft
            JOIN users ON users.id = ft.user_id
       LEFT JOIN LATERAL (
              SELECT fm.message, fm.sender_type
                FROM feedback_messages fm
               WHERE fm.thread_id = ft.id
               ORDER BY fm.created_at DESC
               LIMIT 1
            ) AS last_message ON true
       LEFT JOIN LATERAL (
              SELECT s.plan_id, s.status
                FROM subscriptions s
               WHERE s.user_id = ft.user_id
               ORDER BY s.updated_at DESC
               LIMIT 1
            ) AS subscription ON true
       LEFT JOIN LATERAL (
              SELECT fm.metadata
                FROM feedback_messages fm
               WHERE fm.thread_id = ft.id
               ORDER BY fm.created_at ASC
               LIMIT 1
            ) AS first_context ON true
           ${baseWhereSql}`;
}

export const feedbackRepository = {
  async createThreadWithMessage(input: {
    tenantId: string;
    userId: string;
    type: FeedbackType;
    subject: string;
    status: FeedbackStatus;
    priority: FeedbackPriority;
    messageId: string;
    message: string;
    attachments: FeedbackAttachment[];
    metadata: Record<string, unknown>;
  }): Promise<FeedbackThreadDetail> {
    const threadId = randomUUID();

    await tenantTransaction(input.tenantId, async (client) => {
      await client.query(
        `INSERT INTO feedback_threads (
          id, tenant_id, user_id, type, subject, status, priority, last_message_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4::feedback_type, $5, $6::feedback_status, $7::feedback_priority, now(), now(), now())`,
        [threadId, input.tenantId, input.userId, input.type, input.subject, input.status, input.priority],
      );

      await client.query(
        `INSERT INTO feedback_messages (
          id, thread_id, sender_type, message, attachments, metadata, created_at
        ) VALUES ($1, $2, 'USER'::feedback_sender_type, $3, $4::jsonb, $5::jsonb, now())`,
        [input.messageId, threadId, input.message, JSON.stringify(input.attachments), JSON.stringify(input.metadata)],
      );

      for (const attachment of input.attachments) {
        await client.query(
          `INSERT INTO feedback_attachments (id, message_id, file_url, mime_type, size, created_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [attachment.id, input.messageId, attachment.fileUrl, attachment.mimeType, attachment.size],
        );
      }
    });

    const detail = await this.getTenantThreadDetail(input.tenantId, threadId);
    if (!detail) {
      throw new Error('Falha ao carregar feedback criado');
    }
    return detail;
  },

  async appendTenantMessage(input: {
    tenantId: string;
    threadId: string;
    senderType: 'USER';
    messageId: string;
    message: string;
    attachments: FeedbackAttachment[];
    metadata: Record<string, unknown>;
    nextStatus?: FeedbackStatus;
  }): Promise<FeedbackThreadDetail> {
    await tenantTransaction(input.tenantId, async (client) => {
      await client.query(
        `INSERT INTO feedback_messages (id, thread_id, sender_type, message, attachments, metadata, created_at)
         VALUES ($1, $2, $3::feedback_sender_type, $4, $5::jsonb, $6::jsonb, now())`,
        [input.messageId, input.threadId, input.senderType, input.message, JSON.stringify(input.attachments), JSON.stringify(input.metadata)],
      );

      await client.query(
        `UPDATE feedback_threads
            SET last_message_at = now(),
                updated_at = now(),
                status = COALESCE($1::feedback_status, status)
          WHERE id = $2`,
        [input.nextStatus ?? null, input.threadId],
      );

      for (const attachment of input.attachments) {
        await client.query(
          `INSERT INTO feedback_attachments (id, message_id, file_url, mime_type, size, created_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [attachment.id, input.messageId, attachment.fileUrl, attachment.mimeType, attachment.size],
        );
      }
    });

    const detail = await this.getTenantThreadDetail(input.tenantId, input.threadId);
    if (!detail) {
      throw new Error('Falha ao carregar feedback atualizado');
    }
    return detail;
  },

  async appendAdminMessage(input: {
    threadId: string;
    messageId: string;
    message: string;
    attachments: FeedbackAttachment[];
    metadata: Record<string, unknown>;
  }): Promise<FeedbackThreadDetail> {
    await systemTransaction(async (client) => {
      await client.query(
        `INSERT INTO feedback_messages (id, thread_id, sender_type, message, attachments, metadata, created_at)
         VALUES ($1, $2, 'ADMIN'::feedback_sender_type, $3, $4::jsonb, $5::jsonb, now())`,
        [input.messageId, input.threadId, input.message, JSON.stringify(input.attachments), JSON.stringify(input.metadata)],
      );

      await client.query(
        `UPDATE feedback_threads
            SET last_message_at = now(),
                updated_at = now(),
                status = CASE WHEN status IN ('RESOLVED', 'CLOSED') THEN 'IN_PROGRESS'::feedback_status ELSE status END
          WHERE id = $1`,
        [input.threadId],
      );

      for (const attachment of input.attachments) {
        await client.query(
          `INSERT INTO feedback_attachments (id, message_id, file_url, mime_type, size, created_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [attachment.id, input.messageId, attachment.fileUrl, attachment.mimeType, attachment.size],
        );
      }
    });

    const detail = await this.getAdminThreadDetail(input.threadId);
    if (!detail) {
      throw new Error('Falha ao carregar feedback atualizado');
    }
    return detail;
  },

  async listTenantThreads(tenantId: string): Promise<FeedbackThreadSummary[]> {
    const { rows } = await tenantQuery<FeedbackSummaryRow>(
      tenantId,
      `${buildScopedSummaryQuery('WHERE ft.tenant_id = $1')} ORDER BY ft.last_message_at DESC LIMIT 100`,
      [tenantId],
    );
    return rows.map(toSummary);
  },

  async getTenantThreadDetail(tenantId: string, threadId: string): Promise<FeedbackThreadDetail | null> {
    const { rows } = await tenantQuery<FeedbackSummaryRow>(
      tenantId,
      `${buildScopedSummaryQuery('WHERE ft.id = $1 AND ft.tenant_id = $2')} LIMIT 1`,
      [threadId, tenantId],
    );
    const row = rows[0];
    if (!row) return null;
    const messages = await listTenantMessages(tenantId, threadId);
    return {
      ...toSummary(row),
      messages,
    };
  },

  async listAdminThreads(filters: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    type?: FeedbackType;
    search?: string;
    limit: number;
  }): Promise<FeedbackThreadSummary[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`ft.status = $${params.length}::feedback_status`);
    }

    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`ft.priority = $${params.length}::feedback_priority`);
    }

    if (filters.type) {
      params.push(filters.type);
      conditions.push(`ft.type = $${params.length}::feedback_type`);
    }

    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      conditions.push(`(
        lower(ft.subject) LIKE $${params.length}
        OR lower(users.display_name) LIKE $${params.length}
        OR lower(users.email) LIKE $${params.length}
      )`);
    }

    params.push(filters.limit);
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await systemQuery<FeedbackSummaryRow>(
      `${buildScopedSummaryQuery(whereSql)} ORDER BY ft.last_message_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map(toSummary);
  },

  async getAdminThreadDetail(threadId: string): Promise<FeedbackThreadDetail | null> {
    const { rows } = await systemQuery<FeedbackSummaryRow>(
      `${buildScopedSummaryQuery('WHERE ft.id = $1')} LIMIT 1`,
      [threadId],
    );
    const row = rows[0];
    if (!row) return null;
    const messages = await systemQuery<FeedbackMessageRow>(
      `SELECT fm.id,
              fm.thread_id,
              fm.sender_type,
              fm.message,
              fm.attachments,
              fm.metadata,
              fm.created_at
         FROM feedback_messages fm
        WHERE fm.thread_id = $1
        ORDER BY fm.created_at ASC`,
      [threadId],
    );
    return {
      ...toSummary(row),
      messages: messages.rows.map(toMessage),
    };
  },

  async updateThreadStatus(threadId: string, status: FeedbackStatus): Promise<FeedbackThreadDetail | null> {
    const { rowCount } = await systemQuery(
      `UPDATE feedback_threads SET status = $1::feedback_status, updated_at = now() WHERE id = $2`,
      [status, threadId],
    );
    if (!rowCount) return null;
    return this.getAdminThreadDetail(threadId);
  },

  async updateThreadPriority(threadId: string, priority: FeedbackPriority): Promise<FeedbackThreadDetail | null> {
    const { rowCount } = await systemQuery(
      `UPDATE feedback_threads SET priority = $1::feedback_priority, updated_at = now() WHERE id = $2`,
      [priority, threadId],
    );
    if (!rowCount) return null;
    return this.getAdminThreadDetail(threadId);
  },

  async getAttachmentById(attachmentId: string): Promise<{ attachment: FeedbackAttachment; thread: FeedbackThread } | null> {
    const { rows } = await systemQuery<{
      attachment_id: string;
      file_url: string;
      mime_type: string;
      size: number;
      attachment_created_at: Date;
      thread_id: string;
      tenant_id: string;
      user_id: string;
      type: FeedbackType;
      subject: string;
      status: FeedbackStatus;
      priority: FeedbackPriority;
      last_message_at: Date;
      thread_created_at: Date;
      thread_updated_at: Date;
    }>(
      `SELECT fa.id AS attachment_id,
              fa.file_url,
              fa.mime_type,
              fa.size,
              fa.created_at AS attachment_created_at,
              ft.id AS thread_id,
              ft.tenant_id,
              ft.user_id,
              ft.type,
              ft.subject,
              ft.status,
              ft.priority,
              ft.last_message_at,
              ft.created_at AS thread_created_at,
              ft.updated_at AS thread_updated_at
         FROM feedback_attachments fa
         JOIN feedback_messages fm ON fm.id = fa.message_id
         JOIN feedback_threads ft ON ft.id = fm.thread_id
        WHERE fa.id = $1
        LIMIT 1`,
      [attachmentId],
    );

    const row = rows[0];
    if (!row) return null;

    return {
      attachment: {
        id: row.attachment_id,
        fileUrl: row.file_url,
        mimeType: row.mime_type,
        size: row.size,
        createdAt: row.attachment_created_at.toISOString(),
      },
      thread: {
        id: row.thread_id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        type: row.type,
        subject: row.subject,
        status: row.status,
        priority: row.priority,
        lastMessageAt: row.last_message_at.toISOString(),
        createdAt: row.thread_created_at.toISOString(),
        updatedAt: row.thread_updated_at.toISOString(),
      },
    };
  },

  async countSimilarThreads(type: FeedbackType, subject: string): Promise<number> {
    const normalizedSubject = subject.trim().toLowerCase();
    if (!normalizedSubject) {
      return 0;
    }

    const { rows } = await systemQuery<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM feedback_threads
        WHERE type = $1::feedback_type
          AND lower(subject) = $2`,
      [type, normalizedSubject],
    );

    return Number(rows[0]?.count ?? 0);
  },
};
