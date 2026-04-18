import { tenantQuery } from '../../db/pool';
import { Contact, ContactStatus } from '../../types/contacts.types';

const VALID_STATUSES: ContactStatus[] = ['new', 'contacted', 'negotiating', 'client', 'lost'];

interface ContactRow {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  status: string;
  notes: string;
  channel: string | null;
  last_message: string | null;
  last_message_at: Date | null;
  last_read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function sanitizeStatus(status: string | undefined): ContactStatus {
  return VALID_STATUSES.includes(status as ContactStatus) ? (status as ContactStatus) : 'contacted';
}

function normalizePhone(value: string): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function buildPhoneKeys(value: string): string[] {
  const normalized = normalizePhone(value);
  if (!normalized) return [];
  if (normalized.startsWith('55') && normalized.length > 11) {
    return [normalized, normalized.slice(2)];
  }
  return [normalized, normalized.length >= 10 ? `55${normalized}` : normalized];
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    company: row.company,
    status: sanitizeStatus(row.status),
    notes: row.notes,
    channel: row.channel as Contact['channel'],
    lastMessage: row.last_message ?? undefined,
    lastMessageAt: row.last_message_at?.toISOString() ?? undefined,
    lastReadAt: row.last_read_at?.toISOString() ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const contactsRepository = {
  async getAll(tenantId: string): Promise<Contact[]> {
    const { rows } = await tenantQuery<ContactRow>(tenantId, 'SELECT * FROM contacts ORDER BY created_at DESC');
    return rows.map(toContact);
  },

  async getById(tenantId: string, id: string): Promise<Contact | null> {
    const { rows } = await tenantQuery<ContactRow>(tenantId, 'SELECT * FROM contacts WHERE id = $1', [id]);
    return rows[0] ? toContact(rows[0]) : null;
  },

  async getByEmail(tenantId: string, email: string): Promise<Contact | null> {
    const { rows } = await tenantQuery<ContactRow>(
      tenantId,
      'SELECT * FROM contacts WHERE lower(email) = $1 LIMIT 1',
      [email.toLowerCase()],
    );
    return rows[0] ? toContact(rows[0]) : null;
  },

  async getByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    const keys = buildPhoneKeys(phone);
    if (keys.length === 0) return null;

    const { rows } = await tenantQuery<ContactRow>(
      tenantId,
      `SELECT *
       FROM contacts
       WHERE phone = ANY($1::text[])
       ORDER BY updated_at DESC
       LIMIT 1`,
      [keys],
    );
    return rows[0] ? toContact(rows[0]) : null;
  },

  async saveMany(tenantId: string, newContacts: Contact[]): Promise<{ saved: Contact[]; duplicates: number }> {
    if (newContacts.length === 0) return { saved: [], duplicates: 0 };

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const c of newContacts) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::contact_status, $${idx++}, $${idx++}::contact_channel, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
      );
      values.push(
        c.id, tenantId, c.email, c.name, c.phone, c.company,
        c.status, c.notes, c.channel || null, c.lastMessage || null,
        c.lastMessageAt || null, c.createdAt, c.updatedAt,
      );
    }

    const sql = `
      INSERT INTO contacts (id, tenant_id, email, name, phone, company, status, notes, channel, last_message, last_message_at, created_at, updated_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (tenant_id, lower(email)) WHERE email != '' DO UPDATE SET updated_at = now()
      RETURNING *
    `;

    const { rows } = await tenantQuery<ContactRow>(tenantId, sql, values);
    const saved = rows.map(toContact);
    return { saved, duplicates: newContacts.length - saved.length };
  },

  async update(tenantId: string, id: string, data: Partial<Pick<Contact, 'name' | 'phone' | 'company' | 'status' | 'notes' | 'channel' | 'lastMessage' | 'lastMessageAt' | 'lastReadAt'>>): Promise<Contact | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
    if (data.phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(data.phone); }
    if (data.company !== undefined) { sets.push(`company = $${idx++}`); params.push(data.company); }
    if (data.status !== undefined) { sets.push(`status = $${idx++}::contact_status`); params.push(data.status); }
    if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(data.notes); }
    if (data.channel !== undefined) { sets.push(`channel = $${idx++}::contact_channel`); params.push(data.channel); }
    if (data.lastMessage !== undefined) { sets.push(`last_message = $${idx++}`); params.push(data.lastMessage); }
    if (data.lastMessageAt !== undefined) { sets.push(`last_message_at = $${idx++}`); params.push(data.lastMessageAt); }
    if (data.lastReadAt !== undefined) { sets.push(`last_read_at = $${idx++}`); params.push(data.lastReadAt); }

    if (sets.length === 0) return this.getById(tenantId, id);

    sets.push(`updated_at = now()`);
    params.push(id);

    const { rows } = await tenantQuery<ContactRow>(
      tenantId,
      `UPDATE contacts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return rows[0] ? toContact(rows[0]) : null;
  },

  async upsertWhatsappContactByPhone(tenantId: string, input: {
    phone: string;
    name?: string;
    company?: string;
    status?: ContactStatus;
    lastMessage?: string;
    lastMessageAt?: string;
  }): Promise<Contact> {
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone) {
      throw new Error('Telefone inválido para upsert de contato WhatsApp');
    }

    const existing = await this.getByPhone(tenantId, normalizedPhone);
    if (existing) {
      const updated = await this.update(tenantId, existing.id, {
        phone: normalizedPhone,
        name: input.name ?? existing.name,
        company: input.company ?? existing.company,
        status: input.status ?? existing.status,
        channel: 'whatsapp',
        lastMessage: input.lastMessage,
        lastMessageAt: input.lastMessageAt,
      });
      if (!updated) {
        throw new Error('Falha ao atualizar contato WhatsApp existente');
      }
      return updated;
    }

    const { rows } = await tenantQuery<ContactRow>(
      tenantId,
      `INSERT INTO contacts (tenant_id, email, name, phone, company, status, notes, channel, last_message, last_message_at)
       VALUES ($1, '', $2, $3, $4, $5::contact_status, '', 'whatsapp'::contact_channel, $6, $7)
       RETURNING *`,
      [
        tenantId,
        input.name ?? '',
        normalizedPhone,
        input.company ?? '',
        input.status ?? 'contacted',
        input.lastMessage ?? null,
        input.lastMessageAt ?? null,
      ],
    );

    if (!rows[0]) {
      throw new Error('Falha ao criar contato WhatsApp');
    }

    return toContact(rows[0]);
  },

  async markRead(tenantId: string, id: string, readAt = new Date().toISOString()): Promise<Contact | null> {
    return this.update(tenantId, id, { lastReadAt: readAt });
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await tenantQuery(tenantId, 'DELETE FROM contacts WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },
};
