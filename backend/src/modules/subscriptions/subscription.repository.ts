import { systemQuery, userQuery } from '../../db/pool';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  scheduled_plan: string | null;
  cancel_at_period_end: boolean;
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
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  scheduledPlan: string | null;
  cancelAtPeriodEnd: boolean;
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
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    scheduledPlan: row.scheduled_plan,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? false,
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
    const { rows } = await userQuery<SubscriptionRow>(
      userId,
      `SELECT * FROM subscriptions
       WHERE user_id = $1
         AND lower(status) IN ('active','authorized','approved','trialing','in_trial','pending','in_process','past_due')
       ORDER BY CASE WHEN lower(status) IN ('active','authorized','approved','trialing','in_trial') THEN 0 ELSE 1 END,
                updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const { rows } = await systemQuery<SubscriptionRow>(
      `SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [stripeSubscriptionId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    const { rows } = await systemQuery<SubscriptionRow>(
      `SELECT * FROM subscriptions WHERE stripe_customer_id = $1
       ORDER BY CASE WHEN lower(status) IN ('active','trialing') THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
      [stripeCustomerId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  async findByMpSubscriptionId(mpSubscriptionId: string): Promise<Subscription | null> {
    const { rows } = await systemQuery<SubscriptionRow>(
      `SELECT * FROM subscriptions WHERE mp_subscription_id = $1 LIMIT 1`,
      [mpSubscriptionId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  /** Find subscriptions where a scheduled downgrade has passed its period end. */
  async findExpiredWithScheduledPlan(): Promise<Subscription[]> {
    const { rows } = await systemQuery<SubscriptionRow>(
      `SELECT * FROM subscriptions
       WHERE scheduled_plan IS NOT NULL
         AND lower(status) IN ('active','trialing')
         AND current_period_end IS NOT NULL
         AND current_period_end <= now()`,
    );
    return rows.map(toSubscription);
  },

  async create(data: {
    userId: string;
    planId: string;
    status?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    cancelAtPeriodEnd?: boolean;
    mpSubscriptionId?: string;
    mpPayerId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<Subscription> {
    const { rows } = await userQuery<SubscriptionRow>(
      data.userId,
      `INSERT INTO subscriptions (
        user_id, plan_id, status,
        stripe_customer_id, stripe_subscription_id, stripe_price_id,
        cancel_at_period_end, mp_subscription_id, mp_payer_id,
        current_period_start, current_period_end
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        data.userId,
        data.planId,
        data.status ?? 'pending',
        data.stripeCustomerId ?? null,
        data.stripeSubscriptionId ?? null,
        data.stripePriceId ?? null,
        data.cancelAtPeriodEnd ?? false,
        data.mpSubscriptionId ?? null,
        data.mpPayerId ?? null,
        data.currentPeriodStart ?? null,
        data.currentPeriodEnd ?? null,
      ],
    );
    return toSubscription(rows[0]);
  },

  async updateStatus(userId: string, id: string, status: string): Promise<Subscription | null> {
    const { rows } = await userQuery<SubscriptionRow>(
      userId,
      `UPDATE subscriptions
       SET status = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, id, userId],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  /** Upsert by stripe_subscription_id — idempotent, used in webhook handlers. */
  async upsertByStripeSubscriptionId(data: {
    userId: string;
    planId: string;
    status: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<Subscription> {
    const { rows } = await systemQuery<SubscriptionRow>(
      `INSERT INTO subscriptions (
        user_id, plan_id, status,
        stripe_customer_id, stripe_subscription_id, stripe_price_id,
        cancel_at_period_end, current_period_start, current_period_end
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL
      DO UPDATE SET
        plan_id              = EXCLUDED.plan_id,
        status               = EXCLUDED.status,
        stripe_customer_id   = EXCLUDED.stripe_customer_id,
        stripe_price_id      = EXCLUDED.stripe_price_id,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end   = EXCLUDED.current_period_end,
        updated_at           = now()
      RETURNING *`,
      [
        data.userId, data.planId, data.status,
        data.stripeCustomerId, data.stripeSubscriptionId, data.stripePriceId,
        data.cancelAtPeriodEnd, data.currentPeriodStart, data.currentPeriodEnd,
      ],
    );
    return toSubscription(rows[0]);
  },

  async updateByStripeSubscriptionId(
    stripeSubscriptionId: string,
    updates: {
      planId?: string;
      status?: string;
      stripePriceId?: string;
      scheduledPlan?: string | null;
      cancelAtPeriodEnd?: boolean;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    },
  ): Promise<Subscription | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.planId !== undefined) { sets.push(`plan_id = $${idx++}`); params.push(updates.planId); }
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); params.push(updates.status); }
    if (updates.stripePriceId !== undefined) { sets.push(`stripe_price_id = $${idx++}`); params.push(updates.stripePriceId); }
    if (updates.scheduledPlan !== undefined) { sets.push(`scheduled_plan = $${idx++}`); params.push(updates.scheduledPlan); }
    if (updates.cancelAtPeriodEnd !== undefined) { sets.push(`cancel_at_period_end = $${idx++}`); params.push(updates.cancelAtPeriodEnd); }
    if (updates.currentPeriodStart !== undefined) { sets.push(`current_period_start = $${idx++}`); params.push(updates.currentPeriodStart); }
    if (updates.currentPeriodEnd !== undefined) { sets.push(`current_period_end = $${idx++}`); params.push(updates.currentPeriodEnd); }

    params.push(stripeSubscriptionId);

    const { rows } = await systemQuery<SubscriptionRow>(
      `UPDATE subscriptions SET ${sets.join(', ')} WHERE stripe_subscription_id = $${idx} RETURNING *`,
      params,
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },

  /** Cancel all non-Stripe active subscriptions for a user (called after Stripe checkout). */
  async cancelAllLegacyActiveForUser(userId: string, exceptStripeSubId: string): Promise<void> {
    await systemQuery(
      `UPDATE subscriptions
       SET status = 'cancelled', updated_at = now()
       WHERE user_id = $1
         AND (stripe_subscription_id IS NULL OR stripe_subscription_id != $2)
         AND lower(status) IN ('active','authorized','approved','trialing','in_trial','pending','in_process')`,
      [userId, exceptStripeSubId],
    );
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

    if (updates.status) { sets.push(`status = $${idx++}`); params.push(updates.status); }
    if (updates.currentPeriodStart) { sets.push(`current_period_start = $${idx++}`); params.push(updates.currentPeriodStart); }
    if (updates.currentPeriodEnd) { sets.push(`current_period_end = $${idx++}`); params.push(updates.currentPeriodEnd); }
    if (updates.mpPayerId) { sets.push(`mp_payer_id = $${idx++}`); params.push(updates.mpPayerId); }

    params.push(mpSubscriptionId);

    const { rows } = await systemQuery<SubscriptionRow>(
      `UPDATE subscriptions SET ${sets.join(', ')} WHERE mp_subscription_id = $${idx} RETURNING *`,
      params,
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  },
};
