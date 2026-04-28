export const FEEDBACK_TYPES = ['BUG', 'SUGGESTION', 'QUESTION', 'PROBLEM', 'FEATURE_REQUEST', 'GENERAL'] as const;
export const FEEDBACK_SENDER_TYPES = ['USER', 'ADMIN', 'SYSTEM'] as const;
export const FEEDBACK_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const FEEDBACK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const FEEDBACK_ATTACHMENT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_FEEDBACK_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_FEEDBACK_MESSAGE_LENGTH = 4000;
export const DEFAULT_FEEDBACK_LIST_LIMIT = 50;

export type FeedbackType = typeof FEEDBACK_TYPES[number];
export type FeedbackSenderType = typeof FEEDBACK_SENDER_TYPES[number];
export type FeedbackStatus = typeof FEEDBACK_STATUSES[number];
export type FeedbackPriority = typeof FEEDBACK_PRIORITIES[number];
export type FeedbackAttachmentMimeType = typeof FEEDBACK_ATTACHMENT_MIME_TYPES[number];

export interface FeedbackViewport {
  width: number;
  height: number;
}

export interface FeedbackContextInput {
  route?: string;
  url?: string;
  browser?: string;
  device?: string;
  viewport?: FeedbackViewport;
  timestamp?: string;
  appVersion?: string;
  plan?: string;
}

export interface FeedbackAttachmentDraft {
  fileName?: string;
  mimeType: FeedbackAttachmentMimeType;
  size: number;
  base64: string;
}

export interface FeedbackAttachment {
  id: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface FeedbackMessage {
  id: string;
  threadId: string;
  senderType: FeedbackSenderType;
  message: string;
  attachments: FeedbackAttachment[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackThread {
  id: string;
  tenantId: string;
  userId: string;
  type: FeedbackType;
  subject: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackThreadSummary extends FeedbackThread {
  lastMessagePreview: string | null;
  lastSenderType: FeedbackSenderType | null;
  userName?: string;
  userEmail?: string;
  planName?: string;
  subscriptionStatus?: string | null;
  context?: Record<string, unknown>;
  similarCount?: number;
}

export interface FeedbackThreadDetail extends FeedbackThreadSummary {
  messages: FeedbackMessage[];
}
