import { query } from '../db/pool';

type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

interface FraudEventInput {
  tenantId?: string;
  eventType: string;
  severity?: FraudSeverity;
  details?: Record<string, unknown>;
}

interface TenantBlockRow {
  reason: string;
  blocked_until: Date;
}

interface AggregateRow {
  total: string;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const AI_SPIKE_WINDOW_MINUTES = readIntEnv('FRAUD_AI_SPIKE_WINDOW_MINUTES', 5);
const AI_SPIKE_THRESHOLD = readIntEnv('FRAUD_AI_SPIKE_THRESHOLD', 3000);
const INVALID_WEBHOOK_LIMIT = readIntEnv('FRAUD_INVALID_WEBHOOK_LIMIT', 20);
const REQUEST_BURST_LIMIT = readIntEnv('FRAUD_REQUEST_BURST_LIMIT', 30);

export const fraudService = {
  async recordEvent(input: FraudEventInput): Promise<void> {
    await query(
      `INSERT INTO fraud_events (tenant_id, event_type, severity, details)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        input.tenantId ?? null,
        input.eventType,
        input.severity ?? 'medium',
        JSON.stringify(input.details ?? {}),
      ],
    );
  },

  async blockTenant(tenantId: string, reason: string, minutes = 15): Promise<void> {
    await query(
      `INSERT INTO tenant_security_blocks (tenant_id, reason, blocked_until, created_at, updated_at)
       VALUES ($1, $2, now() + make_interval(mins => $3::int), now(), now())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         reason = EXCLUDED.reason,
         blocked_until = EXCLUDED.blocked_until,
         updated_at = now()`,
      [tenantId, reason.slice(0, 300), minutes],
    );

    await this.recordEvent({
      tenantId,
      eventType: 'tenant_temporarily_blocked',
      severity: 'critical',
      details: { reason, minutes },
    });
  },

  async isTenantBlocked(tenantId: string): Promise<{ blocked: boolean; reason?: string; blockedUntil?: string }> {
    const { rows } = await query<TenantBlockRow>(
      `SELECT reason, blocked_until
       FROM tenant_security_blocks
       WHERE tenant_id = $1 AND blocked_until > now()
       LIMIT 1`,
      [tenantId],
    );

    if (!rows[0]) {
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: rows[0].reason,
      blockedUntil: rows[0].blocked_until.toISOString(),
    };
  },

  async detectAiSpikeAndBlock(tenantId: string): Promise<void> {
    const { rows } = await query<AggregateRow>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM billing_consumptions
       WHERE tenant_id = $1
         AND consumption_type = 'AI'
         AND status = 'processed'
         AND processed_at >= now() - make_interval(mins => $2::int)`,
      [tenantId, AI_SPIKE_WINDOW_MINUTES],
    );

    const total = Number(rows[0]?.total || '0');
    if (total < AI_SPIKE_THRESHOLD) {
      return;
    }

    await this.recordEvent({
      tenantId,
      eventType: 'ai_usage_spike',
      severity: 'high',
      details: {
        total,
        threshold: AI_SPIKE_THRESHOLD,
        windowMinutes: AI_SPIKE_WINDOW_MINUTES,
      },
    });

    await this.blockTenant(tenantId, 'Spike de uso de IA detectado', 15);
  },

  async detectInvalidWebhookBurst(provider: string): Promise<void> {
    const { rows } = await query<AggregateRow>(
      `SELECT COUNT(*)::text AS total
       FROM fraud_events
       WHERE event_type = 'webhook_invalid_signature'
         AND created_at >= now() - interval '10 minutes'
         AND details->>'provider' = $1`,
      [provider],
    );
    const total = Number(rows[0]?.total || '0');
    if (total < INVALID_WEBHOOK_LIMIT) {
      return;
    }

    await this.recordEvent({
      eventType: 'webhook_invalid_burst',
      severity: 'critical',
      details: {
        provider,
        total,
        threshold: INVALID_WEBHOOK_LIMIT,
      },
    });
  },

  async detectRequestBurstAndBlock(tenantId: string): Promise<void> {
    const { rows } = await query<AggregateRow>(
      `SELECT COUNT(*)::text AS total
       FROM fraud_events
       WHERE tenant_id = $1
         AND event_type = 'rate_limit_blocked'
         AND created_at >= now() - interval '2 minutes'`,
      [tenantId],
    );

    const total = Number(rows[0]?.total || '0');
    if (total < REQUEST_BURST_LIMIT) {
      return;
    }

    await this.blockTenant(tenantId, 'Burst anômalo de requisições detectado', 10);
  },
};
