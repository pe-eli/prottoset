import { v4 as uuid } from 'uuid';
import { tenantQuery } from '../../db/pool';
import { ActivityType, ContactActivity } from '../../types/contacts.types';

interface ActivityRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toActivity(row: ActivityRow): ContactActivity {
  return {
    id: row.id,
    contactId: row.contact_id,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

export const contactActivitiesRepository = {
  async listByContact(tenantId: string, contactId: string, limit = 50): Promise<ContactActivity[]> {
    const safeLimit = Math.max(1, Math.min(200, limit));
    const { rows } = await tenantQuery<ActivityRow>(
      tenantId,
      `SELECT * FROM contact_activities
       WHERE tenant_id = $1 AND contact_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, contactId, safeLimit],
    );
    return rows.map(toActivity).reverse();
  },

  async create(tenantId: string, input: {
    contactId: string;
    type: ActivityType;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ContactActivity> {
    const { rows } = await tenantQuery<ActivityRow>(
      tenantId,
      `INSERT INTO contact_activities (id, tenant_id, contact_id, type, title, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        uuid(),
        tenantId,
        input.contactId,
        input.type,
        input.title,
        input.description ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    if (!rows[0]) throw new Error('Failed to create activity');
    return toActivity(rows[0]);
  },

  async createMany(tenantId: string, inputs: Array<{
    contactId: string;
    type: ActivityType;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<void> {
    if (inputs.length === 0) return;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const input of inputs) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(
        uuid(),
        tenantId,
        input.contactId,
        input.type,
        input.title,
        input.description ?? null,
        JSON.stringify(input.metadata ?? {}),
      );
    }
    await tenantQuery(
      tenantId,
      `INSERT INTO contact_activities (id, tenant_id, contact_id, type, title, description, metadata)
       VALUES ${placeholders.join(', ')}`,
      values,
    );
  },

  async updateFollowupDone(tenantId: string, activityId: string, done: boolean): Promise<ContactActivity | null> {
    const { rows } = await tenantQuery<ActivityRow>(
      tenantId,
      `UPDATE contact_activities
       SET metadata = metadata || $1::jsonb
       WHERE id = $2 AND tenant_id = $3 AND type = 'FOLLOWUP_CREATED'
       RETURNING *`,
      [JSON.stringify({ done }), activityId, tenantId],
    );
    return rows[0] ? toActivity(rows[0]) : null;
  },
};
