import { query } from '../db/pool';

export interface AuditLogInput {
  tenantId?: string;
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  status: 'success' | 'failed' | 'blocked' | 'replayed';
  details?: Record<string, unknown>;
}

export const auditLogService = {
  async record(input: AuditLogInput): Promise<void> {
    await query(
      `INSERT INTO audit_logs (
         tenant_id,
         actor_id,
         action,
         target_type,
         target_id,
         correlation_id,
         status,
         details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        input.tenantId ?? null,
        input.actorId ?? null,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.correlationId ?? null,
        input.status,
        JSON.stringify(input.details ?? {}),
      ],
    );
  },
};
