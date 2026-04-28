export const FEEDBACK_TYPE_OPTIONS = [
  { value: 'BUG', label: '🐞 Bug' },
  { value: 'SUGGESTION', label: '💡 Sugestão' },
  { value: 'QUESTION', label: '❓ Dúvida' },
  { value: 'PROBLEM', label: '⚠ Problema' },
  { value: 'FEATURE_REQUEST', label: '🚀 Feature request' },
  { value: 'GENERAL', label: '❤️ Feedback geral' },
] as const;

export const FEEDBACK_STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const FEEDBACK_PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type FeedbackType = typeof FEEDBACK_TYPE_OPTIONS[number]['value'];
export type FeedbackStatus = typeof FEEDBACK_STATUS_OPTIONS[number];
export type FeedbackPriority = typeof FEEDBACK_PRIORITY_OPTIONS[number];
export type FeedbackSenderType = 'USER' | 'ADMIN' | 'SYSTEM';

export interface FeedbackViewport {
  width: number;
  height: number;
}

export interface FeedbackContextSnapshot {
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
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
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

export interface FeedbackThreadSummary {
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
