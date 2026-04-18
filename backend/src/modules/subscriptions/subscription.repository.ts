import { query } from '../../db/pool';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  mp_subscription_id: string | null;
  mp_payer_id: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  mpSubscriptionId: string | null;
  mpPayerId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    mpSubscriptionId: row.mp_subscription_id,
    mpPayerId: row.mp_payer_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const subscriptionRepository = {
  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const { rows } = await query<SubscriptionRow>(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
         AND lower(status) IN (
           'active',
           'authorized',
           'approved',
           'trialing',
           'in_trial',
           'pending',
           'in_process'
         )
       ORDER BY CASE WHEN lower(status) IN ('active', 'authorized', 'approved', 'trialing', 'in_trial') THEN 0 ELSE 1 END,
                updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  async create(data: {
    userId: string;
    planId: string;
    status?: string;
    mpSubscriptionId?: string;
    mpPayerId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<Subscription> {
    const { rows } = await query<SubscriptionRow>(
      `INSERT INTO subscriptions (
        user_id,
        plan_id,
        status,
        mp_subscription_id,
        mp_payer_id,
        current_period_start,
        current_period_end
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.userId,
        data.planId,
        data.status || 'pending',
        data.mpSubscriptionId || null,
        data.mpPayerId || null,
        data.currentPeriodStart || null,
        data.currentPeriodEnd || null,
      ],
    );
    return toSubscription(rows[0]);
  },

  async updateByMpSubscriptionId(
    mpSubscriptionId: string,
    updates: {
      status?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      mpPayerId?: string;
    },
  ): Promise<Subscription | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.status) {
      sets.push(`status = $${idx++}`);
      params.push(updates.status);
    }
    if (updates.currentPeriodStart) {
      sets.push(`current_period_start = $${idx++}`);
      params.push(updates.currentPeriodStart);
    }
    if (updates.currentPeriodEnd) {
      sets.push(`current_period_end = $${idx++}`);
      params.push(updates.currentPeriodEnd);
    }
    if (updates.mpPayerId) {
      sets.push(`mp_payer_id = $${idx++}`);
      params.push(updates.mpPayerId);
    }

    params.push(mpSubscriptionId);

    const { rows } = await query<SubscriptionRow>(
      `UPDATE subscriptions SET ${sets.join(', ')} WHERE mp_subscription_id = $${idx} RETURNING *`,
      params,
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  async updateStatus(id: string, status: string): Promise<Subscription | null> {
    const { rows } = await query<SubscriptionRow>(
      `UPDATE subscriptions SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  async findByMpSubscriptionId(mpSubscriptionId: string): Promise<Subscription | null> {
    const { rows } = await query<SubscriptionRow>(
      `SELECT * FROM subscriptions WHERE mp_subscription_id = $1 LIMIT 1`,
      [mpSubscriptionId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },
};
