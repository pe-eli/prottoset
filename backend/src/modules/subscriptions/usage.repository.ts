import { query } from '../../db/pool';

type UsageColumn = 'leads_used' | 'whatsapp_used' | 'emails_used' | 'quotes_used' | 'ai_credits_used';

export interface UsageRow {
  id: string;
  user_id: string;
  month: Date;
  leads_used: number;
  whatsapp_used: number;
  emails_used: number;
  quotes_used: number;
  ai_credits_used: number;
}

export interface Usage {
  leadsUsed: number;
  whatsappUsed: number;
  emailsUsed: number;
  quotesUsed: number;
  aiCreditsUsed: number;
}

function toUsage(row: UsageRow | undefined): Usage {
  return {
    leadsUsed: row?.leads_used ?? 0,
    whatsappUsed: row?.whatsapp_used ?? 0,
    emailsUsed: row?.emails_used ?? 0,
    quotesUsed: row?.quotes_used ?? 0,
    aiCreditsUsed: row?.ai_credits_used ?? 0,
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

  /**
   * Atomically consume feature usage respecting an optional hard limit.
   * Returns true if usage was consumed, false when over limit.
   */
  async consumeFeatureUsage(userId: string, column: UsageColumn, amount: number, limit: number | null): Promise<boolean> {
    if (amount <= 0) return true;

    if (limit === null) {
      await this.incrementUsage(userId, column, amount);
      return true;
    }

    // Early guard for obvious impossible requests.
    if (amount > limit) {
      return false;
    }

    const { rowCount } = await query(
      `INSERT INTO subscription_usage (user_id, month, ${column})
       VALUES ($1, date_trunc('month', CURRENT_DATE)::date, $2)
       ON CONFLICT (user_id, month)
       DO UPDATE SET ${column} = subscription_usage.${column} + EXCLUDED.${column}
       WHERE subscription_usage.${column} + EXCLUDED.${column} <= $3`,
      [userId, amount, limit],
    );

    return (rowCount ?? 0) > 0;
  },

  /**
   * Atomically check-and-deduct AI credits.
   * Returns true if the deduction succeeded (user had enough credits).
   * Returns false if the user doesn't have enough credits.
   * For unlimited plans (limit === null), always succeeds and just records usage.
   */
  async deductAiCredits(userId: string, amount: number, limit: number | null): Promise<boolean> {
    return this.consumeFeatureUsage(userId, 'ai_credits_used', amount, limit);
  },

  /**
   * Refund previously reserved/consumed usage atomically.
   * This is used by orchestrators to rollback failed actions.
   */
  async releaseFeatureUsage(userId: string, column: UsageColumn, amount: number): Promise<void> {
    if (amount <= 0) return;

    await query(
      `UPDATE subscription_usage
       SET ${column} = GREATEST(0, ${column} - $2)
       WHERE user_id = $1
         AND month = date_trunc('month', CURRENT_DATE)::date`,
      [userId, amount],
    );
  },
};
