import { tenantQuery } from '../../db/pool';
import { LeadFolder } from '../../types/lead-folders.types';

const PALETTE = ['blue', 'emerald', 'amber', 'violet', 'rose', 'sky', 'teal', 'orange'] as const;

interface FolderRow {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: Date;
  lead_ids: string[] | null;
}

function toFolder(row: FolderRow): LeadFolder {
  return {
    id: row.id,
    name: row.name,
    leadIds: row.lead_ids ?? [],
    color: row.color,
    createdAt: row.created_at.toISOString(),
  };
}

export const leadFoldersRepository = {
  async getAll(tenantId: string): Promise<LeadFolder[]> {
    const { rows } = await tenantQuery<FolderRow>(
      tenantId,
      `SELECT lf.*, COALESCE(array_agg(lfl.lead_id) FILTER (WHERE lfl.lead_id IS NOT NULL), '{}') AS lead_ids
       FROM lead_folders lf
       LEFT JOIN lead_folder_leads lfl ON lf.id = lfl.folder_id
       WHERE lf.tenant_id = $1
       GROUP BY lf.id
       ORDER BY lf.created_at ASC`,
      [tenantId],
    );
    return rows.map(toFolder);
  },

  async getById(tenantId: string, id: string): Promise<LeadFolder | null> {
    const { rows } = await tenantQuery<FolderRow>(
      tenantId,
      `SELECT lf.*, COALESCE(array_agg(lfl.lead_id) FILTER (WHERE lfl.lead_id IS NOT NULL), '{}') AS lead_ids
       FROM lead_folders lf
       LEFT JOIN lead_folder_leads lfl ON lf.id = lfl.folder_id
       WHERE lf.id = $1 AND lf.tenant_id = $2
       GROUP BY lf.id`,
      [id, tenantId],
    );
    return rows[0] ? toFolder(rows[0]) : null;
  },

  async create(tenantId: string, folder: LeadFolder): Promise<LeadFolder> {
    const countResult = await tenantQuery<{ count: string }>(
      tenantId,
      'SELECT count(*) FROM lead_folders WHERE tenant_id = $1',
      [tenantId],
    );
    const count = parseInt(countResult.rows[0].count, 10);
    const color = PALETTE[count % PALETTE.length];

    const { rows } = await tenantQuery<FolderRow>(
      tenantId,
      `INSERT INTO lead_folders (id, tenant_id, name, color, created_at)
       VALUES ($1, $2, $3, $4::folder_color, $5)
       RETURNING *, '{}'::text[] AS lead_ids`,
      [folder.id, tenantId, folder.name, color, folder.createdAt],
    );
    return toFolder(rows[0]);
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await tenantQuery(tenantId, 'DELETE FROM lead_folders WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return (rowCount ?? 0) > 0;
  },

  async addLeads(tenantId: string, folderId: string, leadIds: string[]): Promise<LeadFolder | null> {
    if (leadIds.length === 0) return this.getById(tenantId, folderId);

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const leadId of leadIds) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
      values.push(folderId, leadId, tenantId);
    }

    await tenantQuery(
      tenantId,
      `INSERT INTO lead_folder_leads (folder_id, lead_id, tenant_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values,
    );
    return this.getById(tenantId, folderId);
  },

  async removeLeads(tenantId: string, folderId: string, leadIds: string[]): Promise<LeadFolder | null> {
    if (leadIds.length === 0) return this.getById(tenantId, folderId);
    await tenantQuery(
      tenantId,
      'DELETE FROM lead_folder_leads WHERE folder_id = $1 AND lead_id = ANY($2) AND tenant_id = $3',
      [folderId, leadIds, tenantId],
    );
    return this.getById(tenantId, folderId);
  },

  async removeLead(tenantId: string, leadId: string): Promise<void> {
    await tenantQuery(tenantId, 'DELETE FROM lead_folder_leads WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
  },
};
