import { v4 as uuid } from 'uuid';
import { conversationsRepository } from './conversations.repository';
import { deepseekService, ABORDAGEM, QUALIFICACAO, GANCHO, DEMONSTRAÇÃO } from '../../services/deepseek.service';
import { evolutionService } from '../../services/evolution.service';
import type { Conversation, ConversationStage } from '../../types/conversations.types';

const STAGE_CONFIG: Record<string, { description: string; examples: string[] }> = {
  qualificacao: { description: QUALIFICACAO.description, examples: QUALIFICACAO.examples },
  gancho: { description: GANCHO.description, examples: GANCHO.examples },
  fechamento: { description: DEMONSTRAÇÃO.description, examples: DEMONSTRAÇÃO.examples },
};

// Rate limit: track last auto-reply timestamp per conversation ID
const lastReplyMap = new Map<string, number>();
const REPLY_COOLDOWN_MS = 60_000; // 1 minute

export const conversationsService = {
  /**
   * Start funnel conversations for a list of phones.
   * Picks a random ABORDAGEM message for each, sends via Evolution API, persists.
   */
  async startConversations(
    phones: string[],
    promptBase: string,
    config: { intervalMinSeconds: number; intervalMaxSeconds: number },
    signal: { cancelled: boolean },
    emitProgress?: (event: string, data: object) => void,
  ): Promise<{ sent: number; failed: number }> {
    const now = new Date().toISOString();
    let sent = 0;
    let failed = 0;

    // Normalize all phones first
    const normalizedPhones = phones.map((p) => {
      const clean = p.replace(/\D/g, '');
      return clean.startsWith('55') ? clean : '55' + clean;
    });

    const total = normalizedPhones.length;
    console.log(`[Funnel] Starting blast: ${total} phones, interval ${config.intervalMinSeconds}-${config.intervalMaxSeconds}s`);

    // Phase 1: Validate which numbers have WhatsApp
    emitProgress?.('validating', { total });
    console.log(`[Funnel] Validating ${total} numbers on WhatsApp...`);

    let validPhones: string[];
    try {
      const result = await evolutionService.checkNumbers(normalizedPhones);
      validPhones = result.valid;

      // Emit skip events for invalid numbers
      for (const invalidNum of result.invalid) {
        failed++;
        console.log(`[Funnel] ${invalidNum} — no WhatsApp`);
        emitProgress?.('progress', {
          phone: invalidNum, status: 'failed', index: 0, total,
          error: 'Número não possui WhatsApp',
        });
      }

      console.log(`[Funnel] Validation complete: ${validPhones.length} valid, ${result.invalid.length} invalid`);
      emitProgress?.('validated', {
        valid: validPhones.length,
        invalid: result.invalid.length,
        total,
      });
    } catch (err: any) {
      console.error(`[Funnel] Number validation failed: ${err.message} — sending to all numbers`);
      validPhones = normalizedPhones;
    }

    if (signal.cancelled) {
      emitProgress?.('cancelled', { sent, failed, total });
      return { sent, failed };
    }

    // Phase 2: Send messages to valid numbers
    for (let i = 0; i < validPhones.length; i++) {
      if (signal.cancelled) {
        console.log(`[Funnel] Blast cancelled at phone ${i + 1}/${validPhones.length}`);
        emitProgress?.('cancelled', { sent, failed, total });
        return { sent, failed };
      }

      const normalizedPhone = validPhones[i];

      // Check if conversation already exists
      const existing = await conversationsRepository.getByPhoneAny(normalizedPhone);
      if (existing) {
        console.log(`[Funnel] [${i + 1}/${validPhones.length}] ${normalizedPhone} — skipped (conversa existente)`);
        emitProgress?.('progress', {
          phone: normalizedPhone, status: 'skipped', index: i, total,
          error: 'Conversa já existe para este número',
        });
        continue;
      }

      // Pick random ABORDAGEM message
      const abordagemMsg = ABORDAGEM.examples[
        Math.floor(Math.random() * ABORDAGEM.examples.length)
      ];

      // Send via Evolution API
      console.log(`[Funnel] [${i + 1}/${validPhones.length}] ${normalizedPhone} — sending...`);
      emitProgress?.('progress', { phone: normalizedPhone, status: 'sending', index: i, total });
      const result = await evolutionService.sendMessage(normalizedPhone, abordagemMsg);

      if (result.success) {
        // Save conversation immediately (not at end) to prevent data loss
        const conversation: Conversation = {
          id: uuid(),
          phone: normalizedPhone,
          promptBase,
          stage: 'abordagem',
          messages: [{
            role: 'assistant',
            content: abordagemMsg,
            timestamp: new Date().toISOString(),
          }],
          autoReply: true,
          createdAt: now,
          updatedAt: now,
        };
        await conversationsRepository.createMany([conversation]);
        sent++;
        console.log(`[Funnel] [${i + 1}/${validPhones.length}] ${normalizedPhone} — sent ✓`);
        emitProgress?.('progress', { phone: normalizedPhone, status: 'sent', index: i, total });
      } else {
        failed++;
        console.error(`[Funnel] [${i + 1}/${validPhones.length}] ${normalizedPhone} — failed: ${result.error}`);
        emitProgress?.('progress', {
          phone: normalizedPhone, status: 'failed', index: i, total, error: result.error,
        });
      }

      // Anti-spam delay between sends
      if (i < validPhones.length - 1) {
        const delaySec = Math.floor(
          Math.random() * (config.intervalMaxSeconds - config.intervalMinSeconds + 1)
          + config.intervalMinSeconds,
        );
        console.log(`[Funnel] Waiting ${delaySec}s before next send...`);
        for (let remaining = delaySec; remaining > 0; remaining--) {
          if (signal.cancelled) break;
          emitProgress?.('tick', { remaining, total: delaySec });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    console.log(`[Funnel] Blast complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  },

  /**
   * Handle an incoming message from Evolution API webhook.
   * Finds the active conversation, analyzes funnel stage, generates and sends reply.
   */
  async handleIncomingMessage(phone: string, text: string, _skipSave = false): Promise<void> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Find active conversation for this phone
    let conversation = await conversationsRepository.getByPhone(cleanPhone);
    // WhatsApp JID includes country code (55), but user may have saved without it
    if (!conversation && cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      conversation = await conversationsRepository.getByPhone(cleanPhone.slice(2));
    }
    if (!conversation) {
      console.log(`[Funnel] No active conversation for ${cleanPhone}, ignoring`);
      return;
    }

    // Save client message only once (skip on rate-limit retry)
    if (!_skipSave) {
      await conversationsRepository.appendMessage(conversation.id, {
        role: 'client',
        content: text,
        timestamp: new Date().toISOString(),
      });
    }

    if (!conversation.autoReply) {
      console.log(`[Funnel] Auto-reply disabled for ${conversation.id}, saving message only`);
      return;
    }

    if (conversation.stage === 'concluido') {
      console.log(`[Funnel] Conversation ${conversation.id} concluded, saving message only`);
      return;
    }

    // Rate limit check
    const lastReply = lastReplyMap.get(conversation.id) || 0;
    const now = Date.now();
    if (now - lastReply < REPLY_COOLDOWN_MS) {
      console.log(`[Funnel] Rate-limited for ${conversation.id}, queuing reply`);
      await conversationsRepository.update(conversation.id, { rateLimited: true });
      // Retry after cooldown — skip saving the message again
      const waitMs = REPLY_COOLDOWN_MS - (now - lastReply);
      setTimeout(() => {
        conversationsRepository.update(conversation.id, { rateLimited: false });
        this.handleIncomingMessage(phone, text, true);
      }, waitMs);
      return;
    }

    // Remove rateLimited flag ao prosseguir
    await conversationsRepository.update(conversation.id, { rateLimited: false });

    // Re-read conversation to get updated messages
    const updatedConv = await conversationsRepository.getById(conversation.id);
    if (!updatedConv) return;

    // Aguarda intervalo aleatório antes de gerar resposta (DeepSeek)
    const minDelay = 15;
    const maxDelay = 25;
    const delaySec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await conversationsRepository.update(conversation.id, { replyDelaySeconds: delaySec });
    for (let remaining = delaySec; remaining > 0; remaining--) {
      await conversationsRepository.update(conversation.id, { replyDelaySeconds: remaining });
      await new Promise((r) => setTimeout(r, 1000));
    }
    await conversationsRepository.update(conversation.id, { replyDelaySeconds: 0 });

    try {
      // Analyze what funnel stage the client is in
      const newStage = await deepseekService.analyzeFunnelStage(
        updatedConv.messages.map((m) => ({ role: m.role, content: m.content })),
        updatedConv.promptBase,
        updatedConv.stage,
      );

      // If concluded, just update stage and stop
      if (newStage === 'concluido') {
        await conversationsRepository.update(updatedConv.id, {
          stage: 'concluido',
          autoReply: false,
        });
        console.log(`[Funnel] Conversation ${updatedConv.id} concluded`);
        return;
      }

      // Get config for the determined stage
      const stageConfig = STAGE_CONFIG[newStage] ?? STAGE_CONFIG.qualificacao;

      // Generate contextual response (DeepSeek)
      const reply = await deepseekService.generateFunnelResponse(
        updatedConv.messages.map((m) => ({ role: m.role, content: m.content })),
        newStage,
        stageConfig.description,
        stageConfig.examples,
      );

      // Send via Evolution API
      const sendResult = await evolutionService.sendMessage(updatedConv.phone, reply);

      if (sendResult.success) {
        // Save assistant message + advance stage
        await conversationsRepository.advanceStage(
          updatedConv.id,
          newStage as ConversationStage,
          true,
          { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
        );

        lastReplyMap.set(updatedConv.id, Date.now());
        console.log(`[Funnel] Replied to ${cleanPhone}, stage: ${newStage}`);
      } else {
        console.error(`[Funnel] Failed to send reply to ${cleanPhone}: ${sendResult.error}`);
      }
    } catch (err: any) {
      console.error(`[Funnel] Error processing reply for ${cleanPhone}: ${err.message}`);
    }
  },
};
