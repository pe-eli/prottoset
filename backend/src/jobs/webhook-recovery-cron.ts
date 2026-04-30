import { webhookRecoveryService } from '../modules/webhooks/webhook-recovery.service';
import { tryAcquireDistributedLock } from '../infrastructure/distributed-lock';

const WEBHOOK_RECOVERY_INTERVAL_MS = 2 * 60 * 1000;
const WEBHOOK_RECOVERY_LOCK_TTL_MS = 90_000;

export function startWebhookRecoveryCron(): void {
  void runWebhookRecoveryCycle();

  setInterval(() => {
    void runWebhookRecoveryCycle();
  }, WEBHOOK_RECOVERY_INTERVAL_MS);
}

async function runWebhookRecoveryCycle(): Promise<void> {
  const lock = await tryAcquireDistributedLock('cron-webhook-recovery', WEBHOOK_RECOVERY_LOCK_TTL_MS);
  if (!lock) {
    return;
  }

  try {
    const replay = await webhookRecoveryService.replayStale({
      provider: 'stripe',
      statuses: ['pending', 'failed'],
      olderThanMinutes: 2,
      limit: 100,
    });

    const health = await webhookRecoveryService.getHealth('stripe');
    if (health.backlog.failed > 0 || health.backlog.pending > 25) {
      console.error('[WebhookRecovery] Stripe backlog alert', {
        pending: health.backlog.pending,
        failed: health.backlog.failed,
        replayed: replay.replayed,
      });
    } else if (replay.replayed > 0) {
      console.log('[WebhookRecovery] Replayed stale webhook events', replay);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[WebhookRecovery] cycle failed:', message);
  } finally {
    await lock.release();
  }
}
