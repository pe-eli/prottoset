import { tenantQuery, tenantTransaction } from '../../db/pool';
import { PhoneQueue } from '../../types/queues.types';

interface QueueRow {
  id: string;
  tenant_id: string;
  name: string;
  created_at: Date;
  phones: string[] | null;
}

function toQueue(row: QueueRow): PhoneQueue {
  return {
    id: row.id,
    name: row.name,
    phones: row.phones ?? [],
    createdAt: row.created_at.toISOString(),
  };
}

const SELECT_WITH_PHONES = `
  SELECT q.*, COALESCE(array_agg(qp.phone) FILTER (WHERE qp.phone IS NOT NULL), '{}') AS phones
  FROM queues q
  LEFT JOIN queue_phones qp ON q.id = qp.queue_id
`;

export const queuesRepository = {
  async getAll(tenantId: string): Promise<PhoneQueue[]> {
    const { rows } = await tenantQuery<QueueRow>(
      tenantId,
      `${SELECT_WITH_PHONES} GROUP BY q.id ORDER BY q.created_at ASC`,
    );
    return rows.map(toQueue);
  },

  async getById(tenantId: string, id: string): Promise<PhoneQueue | null> {
    const { rows } = await tenantQuery<QueueRow>(
      tenantId,
      `${SELECT_WITH_PHONES} WHERE q.id = $1 GROUP BY q.id`,
      [id],
    );
    return rows[0] ? toQueue(rows[0]) : null;
  },

  async create(tenantId: string, queue: PhoneQueue): Promise<PhoneQueue> {
    await tenantQuery(
      tenantId,
      'INSERT INTO queues (id, tenant_id, name, created_at) VALUES ($1, $2, $3, $4)',
      [queue.id, tenantId, queue.name, queue.createdAt],
    );
    return { ...queue, phones: [] };
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await tenantQuery(tenantId, 'DELETE FROM queues WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  async addPhones(tenantId: string, id: string, phones: string[]): Promise<PhoneQueue | null> {
    if (phones.length === 0) return this.getById(tenantId, id);

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const phone of phones) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
      values.push(id, phone, tenantId);
    }

    await tenantQuery(
      tenantId,
      `INSERT INTO queue_phones (queue_id, phone, tenant_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values,
    );
    return this.getById(tenantId, id);
  },

  async removePhone(tenantId: string, id: string, phone: string): Promise<PhoneQueue | null> {
    await tenantQuery(
      tenantId,
      'DELETE FROM queue_phones WHERE queue_id = $1 AND phone = $2',
      [id, phone],
    );
    return this.getById(tenantId, id);
  },

  async rename(tenantId: string, id: string, name: string): Promise<PhoneQueue | null> {
    const { rowCount } = await tenantQuery(
      tenantId,
      'UPDATE queues SET name = $1 WHERE id = $2',
      [name, id],
    );
    if ((rowCount ?? 0) === 0) return null;
    return this.getById(tenantId, id);
  },

  async merge(tenantId: string, sourceIds: string[], targetName: string): Promise<PhoneQueue | null> {
    return tenantTransaction(tenantId, async (client) => {
      // Verify all sources exist
      const { rows: sources } = await client.query<{ id: string }>(
        'SELECT id FROM queues WHERE id = ANY($1)',
        [sourceIds],
      );
      if (sources.length < 2) return null;

      const targetId = sourceIds[0];
      const otherIds = sourceIds.slice(1);

      // Move phones from other queues to target
      await client.query(
        'UPDATE queue_phones SET queue_id = $1 WHERE queue_id = ANY($2) AND phone NOT IN (SELECT phone FROM queue_phones WHERE queue_id = $1)',
        [targetId, otherIds],
      );

      // Delete remaining phones from sources (duplicates)
      await client.query(
        'DELETE FROM queue_phones WHERE queue_id = ANY($1)',
        [otherIds],
      );

      // Delete source queues
      await client.query('DELETE FROM queues WHERE id = ANY($1)', [otherIds]);

      // Rename target
      await client.query('UPDATE queues SET name = $1 WHERE id = $2', [targetName, targetId]);

      // Read result
      const { rows } = await client.query<QueueRow>(
        `SELECT q.*, COALESCE(array_agg(qp.phone) FILTER (WHERE qp.phone IS NOT NULL), '{}') AS phones
         FROM queues q LEFT JOIN queue_phones qp ON q.id = qp.queue_id
         WHERE q.id = $1 GROUP BY q.id`,
        [targetId],
      );
      return rows[0] ? toQueue(rows[0]) : null;
    });
  },
};
