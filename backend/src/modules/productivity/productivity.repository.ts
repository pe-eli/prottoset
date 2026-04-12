import { tenantQuery } from '../../db/pool';
import { DailyEntry, CreateDailyEntryParams } from '../../types/productivity.types';
import { v4 as uuid } from 'uuid';

interface ProductivityRow {
  id: string;
  tenant_id: string;
  date: string;
  week: string;
  prottocode_hours: string;
  alura_hours: string;
  dimouras_hours: string;
  focus: string;
  completion: number;
  notes: string;
  rating: string;
  created_at: Date;
  updated_at: Date;
}

function toEntry(row: ProductivityRow): DailyEntry {
  return {
    id: row.id,
    date: row.date,
    week: row.week,
    prottocodeHours: parseFloat(row.prottocode_hours) || 0,
    aluraHours: parseFloat(row.alura_hours) || 0,
    dimourasHours: parseFloat(row.dimouras_hours) || 0,
    focus: row.focus,
    completion: row.completion,
    notes: row.notes,
    rating: row.rating as DailyEntry['rating'],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function getWeekString(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + startOfYear.getDay()) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export const productivityRepository = {
  async getAll(tenantId: string): Promise<DailyEntry[]> {
    const { rows } = await tenantQuery<ProductivityRow>(tenantId, 'SELECT * FROM productivity ORDER BY date DESC');
    return rows.map(toEntry);
  },

  async getById(tenantId: string, id: string): Promise<DailyEntry | null> {
    const { rows } = await tenantQuery<ProductivityRow>(tenantId, 'SELECT * FROM productivity WHERE id = $1', [id]);
    return rows[0] ? toEntry(rows[0]) : null;
  },

  async getByWeek(tenantId: string, week: string): Promise<DailyEntry[]> {
    const { rows } = await tenantQuery<ProductivityRow>(
      tenantId,
      'SELECT * FROM productivity WHERE week = $1 ORDER BY date ASC',
      [week],
    );
    return rows.map(toEntry);
  },

  async create(tenantId: string, params: CreateDailyEntryParams): Promise<DailyEntry> {
    const id = uuid();
    const week = getWeekString(params.date);

    const { rows } = await tenantQuery<ProductivityRow>(
      tenantId,
      `INSERT INTO productivity (id, tenant_id, date, week, prottocode_hours, alura_hours, dimouras_hours, focus, completion, notes, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::daily_rating)
       RETURNING *`,
      [
        id, tenantId, params.date, week,
        params.prottocodeHours, params.aluraHours, params.dimourasHours,
        params.focus, params.completion, params.notes, params.rating,
      ],
    );
    return toEntry(rows[0]);
  },

  async update(tenantId: string, id: string, params: Partial<CreateDailyEntryParams>): Promise<DailyEntry | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.date !== undefined) {
      sets.push(`date = $${idx++}`); values.push(params.date);
      sets.push(`week = $${idx++}`); values.push(getWeekString(params.date));
    }
    if (params.prottocodeHours !== undefined) { sets.push(`prottocode_hours = $${idx++}`); values.push(params.prottocodeHours); }
    if (params.aluraHours !== undefined) { sets.push(`alura_hours = $${idx++}`); values.push(params.aluraHours); }
    if (params.dimourasHours !== undefined) { sets.push(`dimouras_hours = $${idx++}`); values.push(params.dimourasHours); }
    if (params.focus !== undefined) { sets.push(`focus = $${idx++}`); values.push(params.focus); }
    if (params.completion !== undefined) { sets.push(`completion = $${idx++}`); values.push(params.completion); }
    if (params.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(params.notes); }
    if (params.rating !== undefined) { sets.push(`rating = $${idx++}::daily_rating`); values.push(params.rating); }

    if (sets.length === 0) return this.getById(tenantId, id);

    sets.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await tenantQuery<ProductivityRow>(
      tenantId,
      `UPDATE productivity SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0] ? toEntry(rows[0]) : null;
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await tenantQuery(tenantId, 'DELETE FROM productivity WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },
};
