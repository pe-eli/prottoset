import { API_BASE_URL } from '../../lib/axios';
import type { AuthUser } from '../auth/auth.api';
import type { FeedbackAttachmentDraft, FeedbackContextSnapshot, FeedbackPriority, FeedbackStatus, FeedbackType } from './feedback.types';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION ?? 'dev').trim() || 'dev';
const SUPPORT_ADMIN_EMAILS = (import.meta.env.VITE_SUPPORT_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter(Boolean);

export function canAccessFeedbackAdmin(user: AuthUser): boolean {
  return SUPPORT_ADMIN_EMAILS.includes(user.email.toLowerCase()) || (import.meta.env.DEV && user.role === 'owner');
}

export function captureFeedbackContext(input: { route: string; planName?: string | null }): FeedbackContextSnapshot {
  const nav = window.navigator;
  return {
    route: input.route,
    url: window.location.href,
    browser: nav.userAgent,
    device: /mobile|android|iphone|ipad/i.test(nav.userAgent) ? 'mobile' : 'desktop',
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    plan: input.planName ?? undefined,
  };
}

export async function fileToFeedbackAttachment(file: File): Promise<FeedbackAttachmentDraft> {
  const mimeType = file.type as FeedbackAttachmentDraft['mimeType'];
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    throw new Error('Formato inválido. Use PNG, JPG, JPEG ou WEBP.');
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o screenshot.'));
    reader.readAsDataURL(file);
  });

  return {
    fileName: file.name,
    mimeType,
    size: file.size,
    base64,
  };
}

export function formatFeedbackType(type: FeedbackType): string {
  return {
    BUG: 'Bug',
    SUGGESTION: 'Sugestão',
    QUESTION: 'Dúvida',
    PROBLEM: 'Problema',
    FEATURE_REQUEST: 'Feature request',
    GENERAL: 'Feedback geral',
  }[type];
}

export function formatFeedbackStatus(status: FeedbackStatus): string {
  return {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Resolvido',
    CLOSED: 'Fechado',
  }[status];
}

export function formatFeedbackPriority(priority: FeedbackPriority): string {
  return {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
  }[priority];
}

export function formatFeedbackDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function resolveFeedbackAssetUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    const base = new URL(API_BASE_URL);
    return new URL(fileUrl, `${base.origin}/`).toString();
  }

  return fileUrl;
}

export function statusTone(status: FeedbackStatus): string {
  return {
    OPEN: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
    IN_PROGRESS: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    RESOLVED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    CLOSED: 'border-border-light bg-surface-secondary text-text-secondary',
  }[status];
}

export function priorityTone(priority: FeedbackPriority): string {
  return {
    LOW: 'border-border-light bg-surface-secondary text-text-secondary',
    MEDIUM: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    HIGH: 'border-orange-400/30 bg-orange-500/10 text-orange-200',
    CRITICAL: 'border-red-400/30 bg-red-500/10 text-red-200',
  }[priority];
}
