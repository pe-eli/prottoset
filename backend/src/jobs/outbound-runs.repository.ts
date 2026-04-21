import { tenantQuery } from '../db/pool';

export type OutboundChannel = 'email' | 'whatsapp';
export type OutboundRunStatus = 'queued' | 'validating' | 'running' | 'completed' | 'failed' | 'cancelled';
export type OutboundItemStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

interface OutboundRunRow {
  id: string;
  tenant_id: string;
  channel: OutboundChannel;
  status: OutboundRunStatus;
  phase: string;
  subject: string | null;
  body: string | null;
  prompt_base: string | null;
  message_mode: 'ai' | 'manual';
  manual_message: string | null;
  personalization_enabled: boolean;
  personalization_fields: string[];
  pain_points: string[];
  batch_size: number;
  interval_min_seconds: number;
  interval_max_seconds: number;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  current_batch: number | null;
  total_batches: number | null;
  current_message: string | null;
  validation_error: string | null;
  last_error: string | null;
  cancel_requested: boolean;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

interface OutboundRunItemRow {
  id: number;
  run_id: string;
  tenant_id: string;
  target: string;
  status: OutboundItemStatus;
  error: string | null;
  message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AggregateRow {
  sent: string;
  failed: string;
  skipped: string;
}

export interface OutboundRun {
  id: string;
  tenantId: string;
  channel: OutboundChannel;
  status: OutboundRunStatus;
  phase: string;
  subject?: string;
  body?: string;
  messageMode: 'ai' | 'manual';
  promptBase?: string;
  manualMessage?: string;
  personalizationEnabled: boolean;
  personalizationFields: string[];
  painPoints: string[];
  batchSize: number;
  intervalMinSeconds: number;
  intervalMaxSeconds: number;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  currentBatch?: number;
  totalBatches?: number;
  currentMessage?: string;
  validationError?: string;
  lastError?: string;
  cancelRequested: boolean;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
}

export interface OutboundRunItem {
  id: number;
  runId: string;
  target: string;
  status: OutboundItemStatus;
  error?: string;
  message?: string;
  updatedAt: string;
}

function toRun(row: OutboundRunRow): OutboundRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    channel: row.channel,
    status: row.status,
    phase: row.phase,
    subject: row.subject || undefined,
    body: row.body || undefined,
    messageMode: row.message_mode,
    promptBase: row.prompt_base || undefined,
    manualMessage: row.manual_message || undefined,
    personalizationEnabled: row.personalization_enabled,
    personalizationFields: Array.isArray(row.personalization_fields) ? row.personalization_fields : [],
    painPoints: Array.isArray(row.pain_points) ? row.pain_points : [],
    batchSize: row.batch_size,
    intervalMinSeconds: row.interval_min_seconds,
    intervalMaxSeconds: row.interval_max_seconds,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    currentBatch: row.current_batch || undefined,
    totalBatches: row.total_batches || undefined,
    currentMessage: row.current_message || undefined,
    validationError: row.validation_error || undefined,
    lastError: row.last_error || undefined,
    cancelRequested: row.cancel_requested,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString(),
    finishedAt: row.finished_at?.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toItem(row: OutboundRunItemRow): OutboundRunItem {
  return {
    id: row.id,
    runId: row.run_id,
    target: row.target,
    status: row.status,
    error: row.error || undefined,
    message: row.message || undefined,
    updatedAt: row.updated_at.toISOString(),
  };
}

async function updateRun(tenantId: string, runId: string, updates: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const sets: string[] = [];
  const values: unknown[] = [];
  let index = 1;
  for (const [column, value] of entries) {
    sets.push(`${column} = $${index++}`);
    values.push(value);
  }
  sets.push(`updated_at = now()`);
  values.push(runId);

  await tenantQuery(tenantId, `UPDATE outbound_runs SET ${sets.join(', ')} WHERE id = $${index}`, values);
}

export const outboundRunsRepository = {
  async createEmailRun(tenantId: string, input: { runId: string; targets: string[]; subject: string; body: string; batchSize: number; intervalMinSeconds: number; intervalMaxSeconds: number }): Promise<void> {
    await tenantQuery(
      tenantId,
      `INSERT INTO outbound_runs (id, tenant_id, channel, status, phase, subject, body, batch_size, interval_min_seconds, interval_max_seconds, total, total_batches)
       VALUES ($1, $2, 'email', 'queued', 'queued', $3, $4, $5, $6, $7, $8, $9)`,
      [input.runId, tenantId, input.subject, input.body, input.batchSize, input.intervalMinSeconds, input.intervalMaxSeconds, input.targets.length, Math.ceil(input.targets.length / input.batchSize)],
    );

    await Promise.all(input.targets.map((target) =>
      tenantQuery(
        tenantId,
        `INSERT INTO outbound_run_items (run_id, tenant_id, target, status) VALUES ($1, $2, $3, 'pending')`,
        [input.runId, tenantId, target],
      ),
    ));
  },

  async createWhatsAppRun(tenantId: string, input: {
    runId: string;
    targets: string[];
    messageMode: 'ai' | 'manual';
    promptBase?: string;
    manualMessage?: string;
    personalizationEnabled?: boolean;
    personalizationFields?: string[];
    painPoints?: string[];
    batchSize: number;
    intervalMinSeconds: number;
    intervalMaxSeconds: number;
  }): Promise<void> {
    await tenantQuery(
      tenantId,
      `INSERT INTO outbound_runs (
        id, tenant_id, channel, status, phase, prompt_base, message_mode, manual_message,
        personalization_enabled, personalization_fields, pain_points,
        batch_size, interval_min_seconds, interval_max_seconds, total, total_batches
      )
       VALUES ($1, $2, 'whatsapp', 'queued', 'queued', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        input.runId,
        tenantId,
        input.promptBase || null,
        input.messageMode,
        input.manualMessage || null,
        Boolean(input.personalizationEnabled),
        input.personalizationFields || [],
        input.painPoints || [],
        input.batchSize,
        input.intervalMinSeconds,
        input.intervalMaxSeconds,
        input.targets.length,
        Math.ceil(input.targets.length / input.batchSize),
      ],
    );

    await Promise.all(input.targets.map((target) =>
      tenantQuery(
        tenantId,
        `INSERT INTO outbound_run_items (run_id, tenant_id, target, status) VALUES ($1, $2, $3, 'pending')`,
        [input.runId, tenantId, target],
      ),
    ));
  },

  async getRun(tenantId: string, runId: string): Promise<OutboundRun | null> {
    const { rows } = await tenantQuery<OutboundRunRow>(tenantId, 'SELECT * FROM outbound_runs WHERE id = $1', [runId]);
    return rows[0] ? toRun(rows[0]) : null;
  },

  async getItems(tenantId: string, runId: string): Promise<OutboundRunItem[]> {
    const { rows } = await tenantQuery<OutboundRunItemRow>(tenantId, 'SELECT * FROM outbound_run_items WHERE run_id = $1 ORDER BY id ASC', [runId]);
    return rows.map(toItem);
  },

  async getRunSnapshot(tenantId: string, runId: string): Promise<(OutboundRun & { items: OutboundRunItem[] }) | null> {
    const [run, items] = await Promise.all([
      this.getRun(tenantId, runId),
      this.getItems(tenantId, runId),
    ]);
    return run ? { ...run, items } : null;
  },

  async markStarted(tenantId: string, runId: string, phase: string): Promise<void> {
    await updateRun(tenantId, runId, { status: phase === 'validating' ? 'validating' : 'running', phase, started_at: new Date().toISOString() });
  },

  async setPhase(tenantId: string, runId: string, phase: string, extra: Record<string, unknown> = {}): Promise<void> {
    const status: OutboundRunStatus = phase === 'validating' ? 'validating' : 'running';
    await updateRun(tenantId, runId, { phase, status, ...extra });
  },

  async setCurrentBatch(tenantId: string, runId: string, currentBatch: number, currentMessage?: string): Promise<void> {
    await updateRun(tenantId, runId, { current_batch: currentBatch, current_message: currentMessage || null });
  },

  async setValidationError(tenantId: string, runId: string, message: string): Promise<void> {
    await updateRun(tenantId, runId, { validation_error: message, last_error: message, status: 'failed', phase: 'failed', finished_at: new Date().toISOString() });
  },

  async setFailure(tenantId: string, runId: string, message: string): Promise<void> {
    await updateRun(tenantId, runId, { last_error: message, status: 'failed', phase: 'failed', finished_at: new Date().toISOString() });
  },

  async updateItem(tenantId: string, runId: string, target: string, status: OutboundItemStatus, extras: { error?: string | null; message?: string | null } = {}): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE outbound_run_items
       SET status = $1::outbound_item_status,
           error = $2,
           message = $3,
           updated_at = now()
       WHERE run_id = $4 AND target = $5`,
      [status, extras.error || null, extras.message || null, runId, target],
    );
  },

  async markMany(tenantId: string, runId: string, targets: string[], status: OutboundItemStatus, error: string): Promise<void> {
    if (targets.length === 0) return;
    await tenantQuery(
      tenantId,
      `UPDATE outbound_run_items
       SET status = $1::outbound_item_status,
           error = $2,
           updated_at = now()
       WHERE run_id = $3 AND target = ANY($4)`,
      [status, error, runId, targets],
    );
  },

  async refreshSummary(tenantId: string, runId: string): Promise<void> {
    const { rows } = await tenantQuery<AggregateRow>(
      tenantId,
      `SELECT
         COUNT(*) FILTER (WHERE status = 'sent')::text AS sent,
         COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
         COUNT(*) FILTER (WHERE status = 'skipped')::text AS skipped
       FROM outbound_run_items
       WHERE run_id = $1`,
      [runId],
    );
    const sent = parseInt(rows[0]?.sent || '0', 10);
    const failed = parseInt(rows[0]?.failed || '0', 10);
    const skipped = parseInt(rows[0]?.skipped || '0', 10);
    await updateRun(tenantId, runId, { sent, failed, skipped });
  },

  async requestCancel(tenantId: string, runId: string): Promise<boolean> {
    const run = await this.getRun(tenantId, runId);
    if (!run || run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return false;
    }
    await updateRun(tenantId, runId, { cancel_requested: true });
    return true;
  },

  async isCancelRequested(tenantId: string, runId: string): Promise<boolean> {
    const run = await this.getRun(tenantId, runId);
    return Boolean(run?.cancelRequested);
  },

  async finalize(tenantId: string, runId: string, status: 'completed' | 'failed' | 'cancelled', lastError?: string): Promise<void> {
    await this.refreshSummary(tenantId, runId);
    await updateRun(tenantId, runId, {
      status,
      phase: status,
      last_error: lastError || null,
      finished_at: new Date().toISOString(),
    });
  },
};