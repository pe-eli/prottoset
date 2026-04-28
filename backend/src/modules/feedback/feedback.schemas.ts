import { z } from 'zod';
import {
  FEEDBACK_ATTACHMENT_MIME_TYPES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
  MAX_FEEDBACK_MESSAGE_LENGTH,
} from './feedback.types';

const attachmentPayloadSchema = z.object({
  fileName: z.string().trim().max(120).optional(),
  mimeType: z.enum(FEEDBACK_ATTACHMENT_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FEEDBACK_ATTACHMENT_BYTES),
  base64: z.string().min(16).max(MAX_FEEDBACK_ATTACHMENT_BYTES * 4),
});

const viewportSchema = z.object({
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
});

const feedbackContextSchema = z.object({
  route: z.string().trim().max(200).optional(),
  url: z.string().trim().max(1000).optional(),
  browser: z.string().trim().max(300).optional(),
  device: z.string().trim().max(120).optional(),
  viewport: viewportSchema.optional(),
  timestamp: z.string().trim().max(80).optional(),
  appVersion: z.string().trim().max(40).optional(),
  plan: z.string().trim().max(80).optional(),
});

export const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(5).max(MAX_FEEDBACK_MESSAGE_LENGTH),
  context: feedbackContextSchema.optional(),
  attachment: attachmentPayloadSchema.optional(),
});

export const createFeedbackMessageSchema = z.object({
  message: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
  context: feedbackContextSchema.optional(),
  attachment: attachmentPayloadSchema.optional(),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

export const updateFeedbackPrioritySchema = z.object({
  priority: z.enum(FEEDBACK_PRIORITIES),
});

export const adminFeedbackQuerySchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  type: z.enum(FEEDBACK_TYPES).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const feedbackMetadataSchema = z.record(z.string(), z.unknown());
