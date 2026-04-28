import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { AuthUser } from '../features/auth/auth.api';
import { feedbackAPI } from '../features/feedback/feedback.api';
import { canAccessFeedbackAdmin, captureFeedbackContext } from '../features/feedback/feedback.utils';
import type { FeedbackAttachmentDraft, FeedbackThreadDetail, FeedbackThreadSummary, FeedbackType } from '../features/feedback/feedback.types';
import { useSubscription } from './useSubscription';
import { useToast } from './useToast';

interface FeedbackContextValue {
  adminEnabled: boolean;
  isOpen: boolean;
  threads: FeedbackThreadSummary[];
  activeThread: FeedbackThreadDetail | null;
  activeThreadId: string | null;
  loading: boolean;
  detailLoading: boolean;
  submitting: boolean;
  open: () => void;
  close: () => void;
  refreshThreads: (options?: { silent?: boolean }) => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  createThread: (input: { type: FeedbackType; message: string; attachment?: FeedbackAttachmentDraft }) => Promise<void>;
  replyToThread: (input: { threadId: string; message: string; attachment?: FeedbackAttachmentDraft }) => Promise<void>;
}

const POLL_INTERVAL_MS = 3 * 60 * 1000;

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function upsertThread(summaryList: FeedbackThreadSummary[], detail: FeedbackThreadDetail): FeedbackThreadSummary[] {
  const nextSummary: FeedbackThreadSummary = {
    id: detail.id,
    tenantId: detail.tenantId,
    userId: detail.userId,
    type: detail.type,
    subject: detail.subject,
    status: detail.status,
    priority: detail.priority,
    lastMessageAt: detail.lastMessageAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    lastMessagePreview: detail.messages.at(-1)?.message ?? detail.lastMessagePreview,
    lastSenderType: detail.messages.at(-1)?.senderType ?? detail.lastSenderType,
    userName: detail.userName,
    userEmail: detail.userEmail,
    planName: detail.planName,
    subscriptionStatus: detail.subscriptionStatus,
    context: detail.context,
    similarCount: detail.similarCount,
  };

  return [nextSummary, ...summaryList.filter((thread) => thread.id !== detail.id)]
    .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());
}

export function FeedbackProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const location = useLocation();
  const { subscription } = useSubscription();
  const { show: showToast } = useToast();
  const adminEnabled = useMemo(() => canAccessFeedbackAdmin(user), [user]);
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<FeedbackThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<FeedbackThreadDetail | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bootstrappedRef = useRef(false);
  const lastSeenAdminReplyRef = useRef<string | null>(null);

  const buildContext = useCallback(() => captureFeedbackContext({
    route: location.pathname,
    planName: subscription?.planName ?? null,
  }), [location.pathname, subscription?.planName]);

  const refreshThreads = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const { data } = await feedbackAPI.listMine();
      const nextThreads = Array.isArray(data.threads) ? data.threads : [];
      setThreads(nextThreads);

      const latestAdminReply = nextThreads
        .filter((thread) => thread.lastSenderType === 'ADMIN')
        .map((thread) => thread.lastMessageAt)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

      if (!bootstrappedRef.current) {
        lastSeenAdminReplyRef.current = latestAdminReply;
        bootstrappedRef.current = true;
      } else if (latestAdminReply && latestAdminReply !== lastSeenAdminReplyRef.current) {
        lastSeenAdminReplyRef.current = latestAdminReply;
        showToast('Você recebeu uma resposta do suporte', 'info');
      }

      if (activeThreadId) {
        const updated = nextThreads.find((thread) => thread.id === activeThreadId);
        if (!updated) {
          setActiveThread(null);
          setActiveThreadId(null);
        }
      }
    } catch {
      if (!options?.silent) {
        showToast('Não foi possível carregar a central de feedback.', 'error');
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [activeThreadId, showToast]);

  const selectThread = useCallback(async (threadId: string) => {
    setActiveThreadId(threadId);
    setDetailLoading(true);
    try {
      const { data } = await feedbackAPI.getMine(threadId);
      setActiveThread(data.thread);
    } catch {
      showToast('Não foi possível abrir essa conversa.', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  const createThread = useCallback(async (input: { type: FeedbackType; message: string; attachment?: FeedbackAttachmentDraft }) => {
    setSubmitting(true);
    try {
      const { data } = await feedbackAPI.create({
        type: input.type,
        message: input.message,
        attachment: input.attachment,
        context: buildContext(),
      });
      setActiveThread(data.thread);
      setActiveThreadId(data.thread.id);
      setThreads((previous) => upsertThread(previous, data.thread));
      showToast(data.message ?? 'Recebemos sua mensagem 🚀', 'success');
      setIsOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar seu feedback.';
      showToast(message, 'error');
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [buildContext, showToast]);

  const replyToThread = useCallback(async (input: { threadId: string; message: string; attachment?: FeedbackAttachmentDraft }) => {
    setSubmitting(true);
    try {
      const { data } = await feedbackAPI.replyMine(input.threadId, {
        message: input.message,
        attachment: input.attachment,
        context: buildContext(),
      });
      setActiveThread(data.thread);
      setThreads((previous) => upsertThread(previous, data.thread));
      showToast('Mensagem enviada com sucesso.', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível responder agora.';
      showToast(message, 'error');
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [buildContext, showToast]);

  useEffect(() => {
    void refreshThreads({ silent: false });
  }, [refreshThreads]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshThreads({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshThreads({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshThreads]);

  const value = useMemo<FeedbackContextValue>(() => ({
    adminEnabled,
    isOpen,
    threads,
    activeThread,
    activeThreadId,
    loading,
    detailLoading,
    submitting,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    refreshThreads,
    selectThread,
    createThread,
    replyToThread,
  }), [adminEnabled, isOpen, threads, activeThread, activeThreadId, loading, detailLoading, submitting, refreshThreads, selectThread, createThread, replyToThread]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
}
