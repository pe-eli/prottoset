import { tenantQuery } from '../../db/pool';
import { ContactChannel, ContactMessage, ContactMessageDirection } from '../../types/contacts.types';

interface ContactMessageRow {
  id: string;
  contact_id: string;
  channel: ContactChannel;
  direction: ContactMessageDirection;
  content: string;
  sent_at: Date;
  created_at: Date;
}

function toContactMessage(row: ContactMessageRow): ContactMessage {
  return {
    id: row.id,
    contactId: row.contact_id,
    channel: row.channel,
    direction: row.direction,
    content: row.content,
    sentAt: row.sent_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export const contactMessagesRepository = {
  async listByContact(tenantId: string, contactId: string, limit = 200): Promise<ContactMessage[]> {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const { rows } = await tenantQuery<ContactMessageRow>(
      tenantId,
      `SELECT id, contact_id, channel, direction, content, sent_at, created_at
       FROM contact_messages
       WHERE contact_id = $1
       ORDER BY sent_at ASC
       LIMIT $2`,
      [contactId, safeLimit],
    );
    return rows.map(toContactMessage);
  },

  async create(tenantId: string, input: {
    contactId: string;
    channel: ContactChannel;
    direction: ContactMessageDirection;
    content: string;
    sentAt?: string;
    externalId?: string;
  }): Promise<ContactMessage | null> {
    const { rows } = await tenantQuery<ContactMessageRow>(
      tenantId,
      `INSERT INTO contact_messages (tenant_id, contact_id, channel, direction, content, sent_at, external_id)
       VALUES ($1, $2, $3::contact_channel, $4::contact_message_direction, $5, COALESCE($6::timestamptz, now()), COALESCE($7, ''))
       ON CONFLICT (tenant_id, contact_id, external_id) WHERE external_id != '' DO NOTHING
       RETURNING id, contact_id, channel, direction, content, sent_at, created_at`,
      [
        tenantId,
        input.contactId,
        input.channel,
        input.direction,
        input.content,
        input.sentAt ?? null,
        input.externalId ?? '',
      ],
    );

    return rows[0] ? toContactMessage(rows[0]) : null;
  },
};
