import { subscriptionService } from '../subscriptions/subscription.service';
import { waInstanceRepository } from '../whatsapp/whatsapp-instance.repository';
import { contactsRepository } from '../contacts/contacts.repository';
import { contactMessagesRepository } from '../contacts/contact-messages.repository';

export const webhookProcessorService = {
  async process(provider: 'mercadopago' | 'evolution', payload: Record<string, unknown>): Promise<void> {
    if (provider === 'mercadopago') {
      await subscriptionService.processWebhookPayload(payload);
      return;
    }

    await processEvolutionPayload(payload);
  },
};

async function processEvolutionPayload(payload: Record<string, unknown>): Promise<void> {
  const event = payload.event;
  const instance = payload.instance;
  const data = payload.data;
  const eventName = normalizeEventName(event);

  const instanceName = typeof instance === 'string'
    ? instance
    : (instance as Record<string, unknown> | undefined)?.instanceName;

  if (typeof instanceName !== 'string' || instanceName.length === 0) {
    return;
  }

  const waInstance = await waInstanceRepository.findByInstanceName(instanceName);
  if (!waInstance) {
    return;
  }

  if (eventName === 'connection.update') {
    const obj = (data as Record<string, unknown> | undefined) ?? {};
    const state = typeof obj.state === 'string'
      ? obj.state
      : (typeof obj.status === 'string' ? obj.status : '');
    const wid = typeof obj.wid === 'string' ? obj.wid : '';
    const phone = wid.replace(/@.*$/, '') || null;

    const status = state === 'open'
      ? 'connected'
      : state === 'connecting'
        ? 'connecting'
        : 'disconnected';

    await waInstanceRepository.updateStatus(instanceName, status, phone || undefined);
    if (status === 'connected') {
      await waInstanceRepository.clearQrCode(waInstance.tenantId);
    }
    return;
  }

  if (eventName === 'qrcode.updated') {
    const obj = (data as Record<string, unknown> | undefined) ?? {};
    const qrCode = typeof obj.qrcode === 'string'
      ? obj.qrcode
      : (typeof obj.base64 === 'string' ? obj.base64 : '');

    if (qrCode) {
      await waInstanceRepository.setQrCode(waInstance.tenantId, qrCode);
    }
    return;
  }

  if (eventName === 'messages.upsert') {
    const messages = extractMessages(data);
    for (const msg of messages) {
      if (!msg.content || !msg.phone) continue;

      const contact = await contactsRepository.upsertWhatsappContactByPhone(waInstance.tenantId, {
        phone: msg.phone,
        status: 'contacted',
        lastMessage: msg.content,
        lastMessageAt: msg.sentAt,
      });

      await contactMessagesRepository.create(waInstance.tenantId, {
        contactId: contact.id,
        channel: 'whatsapp',
        direction: msg.fromMe ? 'outbound' : 'inbound',
        content: msg.content,
        sentAt: msg.sentAt,
        externalId: msg.externalId,
      });
    }
  }
}

function normalizeEventName(event: unknown): string {
  if (typeof event !== 'string') return '';
  return event.trim().toLowerCase().replace(/_/g, '.');
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function extractTextFromMessage(msg: Record<string, unknown>): string {
  const message = (msg.message as Record<string, unknown> | undefined) ?? msg;

  const fromConversation = typeof message.conversation === 'string' ? message.conversation : '';
  if (fromConversation) return fromConversation;

  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (extended && typeof extended.text === 'string') return extended.text;

  const image = message.imageMessage as Record<string, unknown> | undefined;
  if (image && typeof image.caption === 'string') return image.caption;

  const video = message.videoMessage as Record<string, unknown> | undefined;
  if (video && typeof video.caption === 'string') return video.caption;

  const text = typeof msg.text === 'string' ? msg.text : '';
  return text;
}

function pickBestRemoteJid(item: Record<string, unknown>, key: Record<string, unknown>): string {
  const jidCandidates = [
    typeof key.remoteJidAlt === 'string' ? key.remoteJidAlt : '',
    typeof item.remoteJidAlt === 'string' ? item.remoteJidAlt : '',
    typeof key.remoteJid === 'string' ? key.remoteJid : '',
    typeof item.remoteJid === 'string' ? item.remoteJid : '',
  ].filter(Boolean);

  // Prefer canonical WhatsApp jid when Evolution sends LID + alternate jid.
  const canonicalJid = jidCandidates.find((jid) => jid.endsWith('@s.whatsapp.net'));
  if (canonicalJid) return canonicalJid;

  return jidCandidates.find((jid) => !jid.endsWith('@g.us')) || '';
}

function extractMessages(data: unknown): Array<{
  phone: string;
  content: string;
  fromMe: boolean;
  sentAt: string;
  externalId: string;
}> {
  const source = (data as Record<string, unknown> | undefined) ?? {};
  const candidates: Record<string, unknown>[] = [];

  if (Array.isArray(data)) {
    candidates.push(...data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'));
  }

  const listLike = [source, source.message, source.messages, source.data, source.payload]
    .filter((item): item is unknown[] => Array.isArray(item));
  for (const arr of listLike) {
    candidates.push(...arr.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'));
  }

  if (candidates.length === 0 && typeof source === 'object' && source) {
    candidates.push(source);
  }

  const out: Array<{ phone: string; content: string; fromMe: boolean; sentAt: string; externalId: string }> = [];
  for (const item of candidates) {
    const key = (item.key as Record<string, unknown> | undefined) ?? item;
    const remoteJidRaw = pickBestRemoteJid(item, key);
    if (!remoteJidRaw || remoteJidRaw.endsWith('@g.us')) continue;

    const phone = normalizePhone(remoteJidRaw.replace(/@.*$/, ''));
    if (!phone) continue;

    const content = extractTextFromMessage(item).trim();
    if (!content) continue;

    const fromMe = Boolean((typeof key.fromMe === 'boolean' ? key.fromMe : item.fromMe));

    const tsCandidate =
      (typeof item.messageTimestamp === 'number' ? item.messageTimestamp : null)
      ?? (typeof item.messageTimestamp === 'string' ? Number(item.messageTimestamp) : null)
      ?? (typeof item.timestamp === 'number' ? item.timestamp : null)
      ?? (typeof item.timestamp === 'string' ? Number(item.timestamp) : null);

    const sentAt = Number.isFinite(tsCandidate) && tsCandidate && tsCandidate > 0
      ? new Date((tsCandidate > 1_000_000_000_000 ? tsCandidate : tsCandidate * 1000)).toISOString()
      : new Date().toISOString();

    const externalId = String(
      (typeof key.id === 'string' ? key.id : '')
      || (typeof item.id === 'string' ? item.id : '')
      || `${phone}:${sentAt}:${content.slice(0, 16)}`,
    );

    out.push({ phone, content, fromMe, sentAt, externalId });
  }

  return out;
}
