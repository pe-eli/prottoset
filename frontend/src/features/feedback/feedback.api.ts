import { api } from '../../lib/axios';
import type {
  FeedbackAttachmentDraft,
  FeedbackContextSnapshot,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackThreadDetail,
  FeedbackThreadSummary,
  FeedbackType,
} from './feedback.types';

interface FeedbackThreadResponse {
  thread: FeedbackThreadDetail;
  message?: string;
}

interface FeedbackThreadsResponse {
  threads: FeedbackThreadSummary[];
}

export const feedbackAPI = {
  create: (payload: {
    type: FeedbackType;
    message: string;
    context?: FeedbackContextSnapshot;
    attachment?: FeedbackAttachmentDraft;
  }) => api.post<FeedbackThreadResponse>('/feedback', payload),

  listMine: () => api.get<FeedbackThreadsResponse>('/feedback'),

  getMine: (threadId: string) => api.get<FeedbackThreadResponse>(`/feedback/${threadId}`),

  replyMine: (threadId: string, payload: {
    message: string;
    context?: FeedbackContextSnapshot;
    attachment?: FeedbackAttachmentDraft;
  }) => api.post<FeedbackThreadResponse>(`/feedback/${threadId}/messages`, payload),

  listAdmin: (params?: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    type?: FeedbackType;
    search?: string;
    limit?: number;
  }) => api.get<FeedbackThreadsResponse>('/admin/feedback', { params }),

  getAdmin: (threadId: string) => api.get<FeedbackThreadResponse>(`/admin/feedback/${threadId}`),

  updateStatus: (threadId: string, status: FeedbackStatus) => api.patch<FeedbackThreadResponse>(`/admin/feedback/${threadId}/status`, { status }),

  updatePriority: (threadId: string, priority: FeedbackPriority) => api.patch<FeedbackThreadResponse>(`/admin/feedback/${threadId}/priority`, { priority }),

  replyAdmin: (threadId: string, payload: {
    message: string;
    context?: FeedbackContextSnapshot;
    attachment?: FeedbackAttachmentDraft;
  }) => api.post<FeedbackThreadResponse>(`/admin/feedback/${threadId}/reply`, payload),
};
