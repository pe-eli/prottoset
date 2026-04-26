import { systemQuery, tenantQuery } from '../../db/pool';

export interface WhatsAppInstance {
  id: string;
  tenantId: string;
  instanceName: string;
  status: 'created' | 'connecting' | 'connected' | 'disconnected' | 'webhook_pending';
  phone: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InstanceRow {
  id: string;
  tenant_id: string;
  instance_name: string;
  status: 'created' | 'connecting' | 'connected' | 'disconnected' | 'webhook_pending';
  phone: string | null;
  qr_code: string | null;
  qr_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: InstanceRow): WhatsAppInstance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    instanceName: row.instance_name,
    status: row.status,
    phone: row.phone,
    qrCode: row.qr_code,
    qrExpiresAt: row.qr_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const waInstanceRepository = {
  async findByTenant(tenantId: string): Promise<WhatsAppInstance | null> {
    const { rows } = await tenantQuery<InstanceRow>(
      tenantId,
      'SELECT * FROM whatsapp_instances WHERE tenant_id = $1',
      [tenantId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async findByInstanceName(instanceName: string): Promise<WhatsAppInstance | null> {
    const { rows } = await systemQuery<InstanceRow>(
      'SELECT * FROM whatsapp_instances WHERE instance_name = $1',
      [instanceName],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async upsert(
    tenantId: string,
    data: { instanceName?: string; status?: WhatsAppInstance['status']; phone?: string | null },
  ): Promise<WhatsAppInstance> {
    const instanceName = data.instanceName || `user_${tenantId}`;
    const { rows } = await tenantQuery<InstanceRow>(
      tenantId,
      `INSERT INTO whatsapp_instances (tenant_id, instance_name, status, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE SET
         instance_name = COALESCE(EXCLUDED.instance_name, whatsapp_instances.instance_name),
         status = COALESCE(EXCLUDED.status, whatsapp_instances.status),
         phone = COALESCE(EXCLUDED.phone, whatsapp_instances.phone),
         updated_at = now()
       RETURNING *`,
      [tenantId, instanceName, data.status || 'connecting', data.phone || null],
    );
    return mapRow(rows[0]);
  },

  async updateStatus(
    instanceName: string,
    status: WhatsAppInstance['status'],
    phone?: string | null,
  ): Promise<void> {
    await systemQuery(
      `UPDATE whatsapp_instances
       SET status = $2, phone = COALESCE($3, phone), updated_at = now()
       WHERE instance_name = $1`,
      [instanceName, status, phone ?? null],
    );
  },

  async setQrCode(tenantId: string, qrCode: string): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE whatsapp_instances
       SET qr_code = $2, qr_expires_at = now() + interval '45 seconds', updated_at = now()
       WHERE tenant_id = $1`,
      [tenantId, qrCode],
    );
  },

  async clearQrCode(tenantId: string): Promise<void> {
    await tenantQuery(
      tenantId,
      `UPDATE whatsapp_instances
       SET qr_code = NULL, qr_expires_at = NULL, updated_at = now()
       WHERE tenant_id = $1`,
      [tenantId],
    );
  },

  async deleteByTenant(tenantId: string): Promise<void> {
    await tenantQuery(tenantId, 'DELETE FROM whatsapp_instances WHERE tenant_id = $1', [tenantId]);
  },
};
