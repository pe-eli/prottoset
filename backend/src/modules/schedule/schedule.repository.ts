import { tenantQuery } from '../../db/pool';
import { ScheduleItem, CreateScheduleItemParams } from '../../types/schedule.types';
import { v4 as uuid } from 'uuid';

interface ScheduleRow {
  id: string;
  tenant_id: string;
  title: string;
  category: string;
  start_time: string;
  end_time: string;
  date: string | null;
  recurrence_type: string | null;
  recurrence_day_of_week: number | null;
  created_at: Date;
  updated_at: Date;
}

function toItem(row: ScheduleRow): ScheduleItem {
  const item: ScheduleItem = {
    id: row.id,
    title: row.title,
    category: row.category as ScheduleItem['category'],
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (row.date) item.date = row.date;
  if (row.recurrence_type && row.recurrence_day_of_week !== null) {
    item.recurrence = { type: row.recurrence_type as 'weekly', dayOfWeek: row.recurrence_day_of_week };
  }
  return item;
}

export const scheduleRepository = {
  async getAll(tenantId: string): Promise<ScheduleItem[]> {
    const { rows } = await tenantQuery<ScheduleRow>(tenantId, 'SELECT * FROM schedule ORDER BY created_at DESC');
    return rows.map(toItem);
  },

  async getById(tenantId: string, id: string): Promise<ScheduleItem | null> {
    const { rows } = await tenantQuery<ScheduleRow>(tenantId, 'SELECT * FROM schedule WHERE id = $1', [id]);
    return rows[0] ? toItem(rows[0]) : null;
  },

  async create(tenantId: string, params: CreateScheduleItemParams): Promise<ScheduleItem> {
    const id = uuid();
    const { rows } = await tenantQuery<ScheduleRow>(
      tenantId,
      `INSERT INTO schedule (id, tenant_id, title, category, start_time, end_time, date, recurrence_type, recurrence_day_of_week)
       VALUES ($1, $2, $3, $4::schedule_category, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id, tenantId, params.title, params.category,
        params.startTime, params.endTime,
        params.date || null,
        params.recurrence?.type || null,
        params.recurrence?.dayOfWeek ?? null,
      ],
    );
    return toItem(rows[0]);
  },

  async update(tenantId: string, id: string, params: Partial<CreateScheduleItemParams>): Promise<ScheduleItem | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.title !== undefined) { sets.push(`title = $${idx++}`); values.push(params.title); }
    if (params.category !== undefined) { sets.push(`category = $${idx++}::schedule_category`); values.push(params.category); }
    if (params.startTime !== undefined) { sets.push(`start_time = $${idx++}`); values.push(params.startTime); }
    if (params.endTime !== undefined) { sets.push(`end_time = $${idx++}`); values.push(params.endTime); }
    if (params.date !== undefined) { sets.push(`date = $${idx++}`); values.push(params.date || null); }
    if (params.recurrence !== undefined) {
      sets.push(`recurrence_type = $${idx++}`);
      values.push(params.recurrence?.type || null);
      sets.push(`recurrence_day_of_week = $${idx++}`);
      values.push(params.recurrence?.dayOfWeek ?? null);
    }

    if (sets.length === 0) return this.getById(tenantId, id);

    sets.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await tenantQuery<ScheduleRow>(
      tenantId,
      `UPDATE schedule SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0] ? toItem(rows[0]) : null;
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const { rowCount } = await tenantQuery(tenantId, 'DELETE FROM schedule WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },
};
