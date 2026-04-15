import { query } from '../../db/pool';

type UsageColumn = 'leads_used' | 'whatsapp_used' | 'emails_used' | 'quotes_used';

export interface UsageRow {
  id: string;
  user_id: string;
  month: Date;
  leads_used: number;
  whatsapp_used: number;
  emails_used: number;
  quotes_used: number;
}

export interface Usage {
  leadsUsed: number;
  whatsappUsed: number;
  emailsUsed: number;
  quotesUsed: number;
}

function toUsage(row: UsageRow | undefined): Usage {
  return {
    leadsUsed: row?.leads_used ?? 0,
    whatsappUsed: row?.whatsapp_used ?? 0,
    emailsUsed: row?.emails_used ?? 0,
    quotesUsed: row?.quotes_used ?? 0,
  };
}

export const usageRepository = {
  async getUsageForMonth(userId: string): Promise<Usage> {
    const { rows } = await query<UsageRow>(
      `SELECT * FROM subscription_usage
       WHERE user_id = $1 AND month = date_trunc('month', CURRENT_DATE)::date
       LIMIT 1`,
      [userId],
    );
    return toUsage(rows[0]);
  },

  async incrementUsage(userId: string, column: UsageColumn, amount = 1): Promise<void> {
    await query(
      `INSERT INTO subscription_usage (user_id, month, ${column})
       VALUES ($1, date_trunc('month', CURRENT_DATE)::date, $2)
       ON CONFLICT (user_id, month)
       DO UPDATE SET ${column} = subscription_usage.${column} + EXCLUDED.${column}`,
      [userId, amount],
    );
  },
};
