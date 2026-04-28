import { promises as fs } from 'fs';
import path from 'path';
import {
  type FeedbackAttachmentDraft,
  type FeedbackAttachmentMimeType,
  MAX_FEEDBACK_ATTACHMENT_BYTES,
} from './feedback.types';

const STORAGE_ROOT = path.resolve(process.cwd(), 'generated', 'feedback-uploads');

const MIME_EXTENSIONS: Record<FeedbackAttachmentMimeType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

function ensureDataUrlPrefixRemoved(base64: string): string {
  const trimmed = base64.trim();
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

function validateMagicBytes(buffer: Buffer, mimeType: FeedbackAttachmentMimeType): boolean {
  if (mimeType === 'image/png') {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47;
  }

  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;
  }

  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  return false;
}

async function ensureStorageRoot(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

function resolveAttachmentPath(attachmentId: string, mimeType: string): string {
  const extension = MIME_EXTENSIONS[mimeType as FeedbackAttachmentMimeType];
  if (!extension) {
    throw new Error('Tipo de arquivo não suportado');
  }
  return path.join(STORAGE_ROOT, `${attachmentId}${extension}`);
}

export const feedbackStorage = {
  async saveAttachment(attachmentId: string, draft: FeedbackAttachmentDraft): Promise<{ size: number }> {
    const raw = ensureDataUrlPrefixRemoved(draft.base64);
    const buffer = Buffer.from(raw, 'base64');

    if (buffer.length === 0 || buffer.length > MAX_FEEDBACK_ATTACHMENT_BYTES) {
      throw new Error('Arquivo excede o limite permitido');
    }

    if (Math.abs(buffer.length - draft.size) > 64) {
      throw new Error('Tamanho do arquivo inválido');
    }

    if (!validateMagicBytes(buffer, draft.mimeType)) {
      throw new Error('Formato do arquivo inválido');
    }

    await ensureStorageRoot();
    const filePath = resolveAttachmentPath(attachmentId, draft.mimeType);
    await fs.writeFile(filePath, buffer);
    return { size: buffer.length };
  },

  async removeAttachment(attachmentId: string, mimeType: string): Promise<void> {
    try {
      await fs.unlink(resolveAttachmentPath(attachmentId, mimeType));
    } catch {
      // Best-effort cleanup.
    }
  },

  async readAttachment(attachmentId: string, mimeType: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(resolveAttachmentPath(attachmentId, mimeType));
    } catch {
      return null;
    }
  },
};
